import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ChevronLeft, ChevronRight, LayoutGrid, List, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  doctorsApi,
  invalidateDoctorSlotsClientCache,
  shouldSyncSlotsCrossTab,
  SLOTS_CROSS_TAB_BROADCAST,
  type DoctorSlot,
} from '../../../services';
import type { Patient } from '../../../types';
import {
  dedupeDoctorSlots,
  formatNextAvailablePhrase,
  formatSlotTime,
  formatTimeZoneCaption,
  getCalendarViewWindow,
  isSlotInPast,
  listHourGridTicks,
  nowLinePercentInView,
  parseAndClampDateParam,
  slotBlockInView,
  slotKey,
  ymdInTimeZone,
} from '../../../utils/doctorSchedule';
import { BookingModal } from './BookingModal';

const CALENDAR_VIEW_STORAGE_KEY = 'calendar_view';
type CalendarViewMode = 'grid' | 'list';

/** Date math for the browser date input when shifting by days. */
function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type PlacedSlot = {
  slot: DoctorSlot;
  topPct: number;
  heightPct: number;
  clippedOut: boolean;
  lane: number;
  laneCount: number;
};

function assignPlacementLanes(
  sorted: DoctorSlot[],
  viewStart: import('dayjs').Dayjs,
  viewEnd: import('dayjs').Dayjs,
  totalMinutes: number
): PlacedSlot[] {
  const laneEnds: number[] = [];
  const out: PlacedSlot[] = [];
  for (const s of sorted) {
    const dur = s.duration_minutes ?? 30;
    const t0 = new Date(s.start).getTime();
    const t1 = t0 + dur * 60_000;
    const block = slotBlockInView(s.start, dur, viewStart, viewEnd, totalMinutes);
    if (block.clippedOut) {
      out.push({
        slot: s,
        topPct: 0,
        heightPct: 0,
        clippedOut: true,
        lane: 0,
        laneCount: 1,
      });
      continue;
    }
    let lane = laneEnds.findIndex((end) => end <= t0);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(t1);
    } else {
      laneEnds[lane] = t1;
    }
    out.push({
      slot: s,
      topPct: block.topPct,
      heightPct: block.heightPct,
      clippedOut: false,
      lane,
      laneCount: Math.max(1, laneEnds.length),
    });
  }
  const maxLanes = out.reduce((m, p) => (p.clippedOut ? m : Math.max(m, p.laneCount)), 1);
  return out.map((p) => (p.clippedOut ? p : { ...p, laneCount: maxLanes }));
}

function placeSlotsInView(slots: DoctorSlot[], viewStart: import('dayjs').Dayjs, viewEnd: import('dayjs').Dayjs, totalMinutes: number): PlacedSlot[] {
  const sorted = dedupeDoctorSlots(slots).sort((a, b) => slotKey(a.start).localeCompare(slotKey(b.start)));
  return assignPlacementLanes(sorted, viewStart, viewEnd, totalMinutes);
}

function slotTimeRangeMs(s: DoctorSlot): { t0: number; t1: number } {
  const dur = s.duration_minutes ?? 30;
  const t0 = new Date(s.start).getTime();
  return { t0, t1: t0 + dur * 60_000 };
}

/** Overlapping slots in the same time band, ordered by lane (for Left/Right focus). */
function overlapLaneKeys(placed: PlacedSlot[], currentKey: string): string[] {
  const p =
    placed.find((x) => !x.clippedOut && slotKey(x.slot.start) === currentKey) ??
    placed.find((x) => slotKey(x.slot.start) === currentKey);
  if (!p) return [currentKey];
  const { t0, t1 } = slotTimeRangeMs(p.slot);
  return placed
    .filter((q) => !q.clippedOut)
    .filter((q) => {
      const r = slotTimeRangeMs(q.slot);
      return t0 < r.t1 && t1 > r.t0;
    })
    .sort((a, b) => a.lane - b.lane)
    .map((g) => slotKey(g.slot.start));
}

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const f = () => setDesktop(mq.matches);
    mq.addEventListener('change', f);
    f();
    return () => mq.removeEventListener('change', f);
  }, []);
  return desktop;
}

function CalendarGridSkeleton() {
  return (
    <div className="flex min-h-[28rem] gap-0 rounded-lg border border-border bg-muted/20 p-0 overflow-hidden" aria-hidden>
      <div className="w-12 shrink-0 space-y-6 border-r border-border py-2 pr-2 pl-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-3 w-8 rounded bg-muted animate-pulse" />
        ))}
      </div>
      <div className="flex-1 space-y-3 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 w-full rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 w-full rounded-md border border-border bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}

export interface DayCalendarProps {
  doctorId: string | null;
  isInteractive: boolean;
  patients: Patient[];
  /** When set, booking flow pre-selects this patient in the modal. */
  bookPatientId?: string | null;
  hasAvailabilityWindows?: boolean;
  doctorTimeZone?: string;
  onBooked?: () => void;
  className?: string;
}

export function DayCalendar({
  doctorId,
  isInteractive,
  patients,
  bookPatientId = null,
  hasAvailabilityWindows,
  doctorTimeZone = 'UTC',
  onBooked,
  className,
}: DayCalendarProps) {
  const tz = doctorTimeZone || 'UTC';
  const isDesktop = useIsDesktop();
  const [searchParams, setSearchParams] = useSearchParams();
  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullDayTimeOff, setFullDayTimeOff] = useState<boolean | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [nextAvail, setNextAvail] = useState<{ label: string; dayYmd: string } | null | undefined>(undefined);
  const [nextAvailLoading, setNextAvailLoading] = useState(false);
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    if (typeof window === 'undefined') return 'grid';
    return window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  });

  const dayLoadIdRef = useRef(0);
  const dayLoadAbortRef = useRef<AbortController | null>(null);
  const slotBtnRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  useEffect(() => {
    try {
      window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, viewMode);
    } catch {
      /* quota / disabled */
    }
  }, [viewMode]);

  const doctorTodayYmd = useMemo(() => {
    void nowTick;
    return ymdInTimeZone(tz);
  }, [tz, nowTick]);

  const minYmd = doctorTodayYmd;
  const date = useMemo(() => {
    const raw = searchParams.get('date');
    return parseAndClampDateParam(raw, minYmd) ?? minYmd;
  }, [searchParams, minYmd, tz]);

  const setDateParam = useCallback(
    (d: string) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('date', d);
          return p;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (!searchParams.get('date')) {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('date', minYmd);
          return p;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams, minYmd]);

  const { viewStart, viewEnd, totalMinutes } = useMemo(() => getCalendarViewWindow(date, tz), [date, tz]);
  const hourTicks = useMemo(
    () => listHourGridTicks(date, tz, viewStart, viewEnd, totalMinutes),
    [date, tz, viewStart, viewEnd, totalMinutes]
  );

  const isToday = date === doctorTodayYmd;

  useEffect(() => {
    if (!isToday) return;
    const id = window.setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [isToday]);

  const nowLinePct = useMemo(
    () => nowLinePercentInView(date, doctorTodayYmd, viewStart, viewEnd, totalMinutes),
    [date, doctorTodayYmd, viewStart, viewEnd, totalMinutes, nowTick]
  );

  const applyNextFromResponse = useCallback(
    (slot: DoctorSlot | null) => {
      if (hasAvailabilityWindows === false) {
        setNextAvail(undefined);
        setNextAvailLoading(false);
        return;
      }
      if (!slot || !slot.available) {
        setNextAvail(null);
        setNextAvailLoading(false);
        return;
      }
      const refToday = ymdInTimeZone(tz);
      const dayYmd = ymdInTimeZone(tz, new Date(slot.start));
      if (isSlotInPast(slot.start, dayYmd, refToday)) {
        setNextAvail(null);
        setNextAvailLoading(false);
        return;
      }
      setNextAvail({
        label: formatNextAvailablePhrase(slot.start, dayYmd, refToday, tz),
        dayYmd,
      });
      setNextAvailLoading(false);
    },
    [hasAvailabilityWindows, tz]
  );

  const loadDaySchedule = useCallback(
    async (opts?: { skipSlotsCache?: boolean }) => {
      if (!doctorId) return;
      if (hasAvailabilityWindows === false) {
        setNextAvail(undefined);
        setNextAvailLoading(false);
      } else {
        setNextAvailLoading(true);
      }
      const reqId = ++dayLoadIdRef.current;
      dayLoadAbortRef.current?.abort();
      const ac = new AbortController();
      dayLoadAbortRef.current = ac;
      setLoading(true);
      setError(null);
      const fromYmd = ymdInTimeZone(tz);
      try {
        const data = await doctorsApi.getScheduleDay(doctorId, date, {
          fromYmd,
          horizonDays: 14,
          signal: ac.signal,
          skipSlotsCache: opts?.skipSlotsCache,
        });
        if (reqId !== dayLoadIdRef.current) return;
        if (ac.signal.aborted) return;
        setSlots(dedupeDoctorSlots(data.slots));
        setFullDayTimeOff(data.full_day_time_off);
        applyNextFromResponse(data.next_available);
      } catch (e) {
        if (axios.isCancel(e)) return;
        if (ac.signal.aborted) return;
        if (reqId !== dayLoadIdRef.current) return;
        setError('Could not load slots for this day.');
        setSlots([]);
        if (hasAvailabilityWindows !== false) {
          setNextAvail(null);
        }
        setNextAvailLoading(false);
      } finally {
        if (!ac.signal.aborted && reqId === dayLoadIdRef.current) {
          setLoading(false);
        }
      }
    },
    [doctorId, date, tz, hasAvailabilityWindows, applyNextFromResponse]
  );

  useEffect(() => {
    if (!doctorId) {
      setSlots([]);
      setLoading(false);
      setFullDayTimeOff(null);
      return;
    }
    void loadDaySchedule();
    return () => dayLoadAbortRef.current?.abort();
  }, [doctorId, date, loadDaySchedule]);

  useEffect(() => {
    if (!doctorId) return;
    const onBroadcast = () => {
      if (!shouldSyncSlotsCrossTab()) return;
      void loadDaySchedule();
    };
    window.addEventListener(SLOTS_CROSS_TAB_BROADCAST, onBroadcast);
    return () => window.removeEventListener(SLOTS_CROSS_TAB_BROADCAST, onBroadcast);
  }, [doctorId, loadDaySchedule]);

  const placed = useMemo(
    () => placeSlotsInView(slots, viewStart, viewEnd, totalMinutes),
    [slots, viewStart, viewEnd, totalMinutes]
  );

  const onBookingSuccess = useCallback(
    (bookedStart?: string) => {
      const canon = bookedStart ? slotKey(bookedStart) : null;
      if (canon) {
        setSlots((prev) =>
          prev.map((s) => (slotKey(s.start) === canon ? { ...s, available: false } : s))
        );
      }
      if (!doctorId) return;
      invalidateDoctorSlotsClientCache(doctorId, date);
      onBooked?.();
      void loadDaySchedule({ skipSlotsCache: true });
    },
    [doctorId, date, onBooked, loadDaySchedule]
  );

  const sortedSlots = useMemo(
    () => dedupeDoctorSlots(slots).sort((a, b) => slotKey(a.start).localeCompare(slotKey(b.start))),
    [slots]
  );

  const navSlotKeys = useMemo(() => sortedSlots.map((s) => slotKey(s.start)), [sortedSlots]);

  const focusNeighborSlot = useCallback(
    (fromKey: string, delta: number) => {
      const keys = navSlotKeys;
      const n = keys.length;
      if (n === 0) return;
      const idx = keys.indexOf(fromKey);
      if (idx < 0) return;
      const next = keys[(idx + delta + n) % n];
      slotBtnRefs.current.get(next)?.focus();
    },
    [navSlotKeys]
  );

  const focusNeighborLane = useCallback(
    (fromKey: string, delta: 1 | -1) => {
      const group = overlapLaneKeys(placed, fromKey);
      if (group.length === 0) return;
      const idx = group.indexOf(fromKey);
      if (idx < 0) return;
      const n = group.length;
      const next = group[(idx + delta + n) % n];
      slotBtnRefs.current.get(next)?.focus();
    },
    [placed]
  );

  const focusFirstSlot = useCallback(() => {
    const keys = navSlotKeys;
    if (keys.length === 0) return;
    slotBtnRefs.current.get(keys[0])?.focus();
  }, [navSlotKeys]);

  const focusLastSlot = useCallback(() => {
    const keys = navSlotKeys;
    if (keys.length === 0) return;
    slotBtnRefs.current.get(keys[keys.length - 1])?.focus();
  }, [navSlotKeys]);

  const shiftDate = (delta: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setDateParam(ymdFromLocalDate(d));
  };

  const showGrid = isDesktop && viewMode === 'grid';

  if (!doctorId) {
    return (
      <div
        className={cn('rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground', className)}
      >
        Set up your doctor profile to see the schedule.
      </div>
    );
  }

  if (hasAvailabilityWindows === false) {
    return (
      <div className={cn('rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-foreground', className)}>
        <p className="font-medium">No availability is configured</p>
        <p className="mt-1 text-muted-foreground">
          Add your weekly hours under <strong>Availability</strong> to publish bookable time slots.
        </p>
      </div>
    );
  }

  const renderSlotButton = (p: PlacedSlot) => {
    if (p.clippedOut) return null;
    const k = slotKey(p.slot.start);
    const past = isSlotInPast(p.slot.start, date, doctorTodayYmd);
    const selected = Boolean(modalOpen && selectedStart != null && slotKey(selectedStart) === k);
    const disabled = !p.slot.available || !isInteractive || past || bookingBusy;
    const { lane, laneCount } = p;
    const colPct = 100 / laneCount;
    const gutter = 0.5;
    return (
      <button
        key={k}
        type="button"
        data-testid="doctor-schedule-slot"
        ref={(el) => {
          if (el) slotBtnRefs.current.set(k, el);
          else slotBtnRefs.current.delete(k);
        }}
        style={{
          top: `${p.topPct}%`,
          height: `${Math.max(p.heightPct, 3)}%`,
          left: `calc(${lane * colPct}% + ${gutter}%)`,
          width: `calc(${colPct}% - ${gutter * 2}%)`,
        }}
        className={cn(
          'absolute z-10 box-border flex min-h-[1.5rem] flex-col items-stretch justify-center overflow-hidden rounded-md border px-2 py-0.5 text-left text-xs transition-colors sm:text-sm',
          past && 'cursor-not-allowed border-border bg-muted/30 text-muted-foreground opacity-45',
          !past && !p.slot.available &&
            'cursor-not-allowed border-rose-500/35 bg-rose-950/20 text-rose-950/90 dark:text-rose-100/90',
          !past && p.slot.available && !selected &&
            'cursor-pointer border-emerald-600/50 bg-emerald-500/15 text-emerald-950 hover:bg-emerald-500/25 dark:text-emerald-50',
          !past && p.slot.available && selected && 'z-[15] ring-2 ring-primary border-primary bg-primary/20 text-foreground shadow-sm',
          isInteractive && p.slot.available && !past && !bookingBusy && 'active:scale-[0.99]'
        )}
        disabled={disabled}
        onClick={() => {
          if (modalOpen) return;
          if (bookingBusy) return;
          if (!isInteractive || !p.slot.available) return;
          if (past) return;
          setSelectedStart(k);
          setModalOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Home') {
            e.preventDefault();
            focusFirstSlot();
            return;
          }
          if (e.key === 'End') {
            e.preventDefault();
            focusLastSlot();
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            focusNeighborSlot(k, e.key === 'ArrowDown' ? 1 : -1);
            return;
          }
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            focusNeighborLane(k, e.key === 'ArrowRight' ? 1 : -1);
          }
        }}
        aria-disabled={disabled}
      >
        <span className="font-medium tabular-nums">{formatSlotTime(p.slot.start, tz)}</span>
        <span className="truncate text-[10px] leading-tight sm:text-xs">
          {past ? 'Past' : p.slot.available ? 'Available' : 'Booked'}
        </span>
      </button>
    );
  };

  const listSlotItem = (s: DoctorSlot) => {
    const k = slotKey(s.start);
    const past = isSlotInPast(s.start, date, doctorTodayYmd);
    const selected = Boolean(modalOpen && selectedStart != null && slotKey(selectedStart) === k);
    const disabled = !s.available || !isInteractive || past || bookingBusy;
    return (
      <button
        key={k}
        type="button"
        data-testid="doctor-schedule-slot"
        ref={(el) => {
          if (el) slotBtnRefs.current.set(k, el);
          else slotBtnRefs.current.delete(k);
        }}
        className={cn(
          'w-full flex flex-col items-stretch justify-center rounded-md border px-3 py-2 text-left text-sm transition-colors',
          past && 'border-border bg-muted/30 text-muted-foreground opacity-50',
          !past && !s.available && 'border-rose-500/35 bg-rose-950/15 text-rose-950/90 dark:text-rose-100/90',
          !past && s.available && !selected && 'border-emerald-600/50 bg-emerald-500/10 hover:bg-emerald-500/20',
          !past && s.available && selected && 'ring-2 ring-primary border-primary bg-primary/15',
          isInteractive && s.available && !past && !bookingBusy && 'active:scale-[0.99]'
        )}
        disabled={disabled}
        onClick={() => {
          if (modalOpen) return;
          if (bookingBusy) return;
          if (!isInteractive || !s.available || past) return;
          setSelectedStart(k);
          setModalOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Home') {
            e.preventDefault();
            focusFirstSlot();
            return;
          }
          if (e.key === 'End') {
            e.preventDefault();
            focusLastSlot();
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            focusNeighborSlot(k, e.key === 'ArrowDown' ? 1 : -1);
            return;
          }
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            focusNeighborLane(k, e.key === 'ArrowRight' ? 1 : -1);
          }
        }}
        aria-disabled={disabled}
      >
        <span className="font-medium tabular-nums">{formatSlotTime(s.start, tz)}</span>
        <span className="text-xs text-muted-foreground">
          {s.duration_minutes != null ? `${s.duration_minutes} min` : ''} · {past ? 'Past' : s.available ? 'Available' : 'Booked'}
        </span>
      </button>
    );
  };

  return (
    <div className={cn('space-y-3', className)}>
      {doctorId && hasAvailabilityWindows && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
          {nextAvailLoading && (
            <>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">Finding next open slot…</span>
            </>
          )}
          {!nextAvailLoading && nextAvail && (
            <span>
              <span className="text-muted-foreground">Next available: </span>
              <span className="font-medium text-foreground">{nextAvail.label}</span>
            </span>
          )}
          {!nextAvailLoading && nextAvail === null && (
            <span className="text-muted-foreground">No free slots in the next 14 days (check time off and hours).</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => shiftDate(-1)}
            disabled={date <= minYmd}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => shiftDate(1)} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="h-8 w-auto min-w-[10rem] text-sm"
            value={date}
            min={minYmd}
            onChange={(e) => setDateParam(e.target.value)}
          />
          <Button type="button" variant="secondary" size="sm" className="h-8" onClick={() => setDateParam(minYmd)}>
            Today
          </Button>
          {isDesktop && (
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5" role="group" aria-label="Calendar view">
              <Button
                type="button"
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1 px-2"
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                Grid
              </Button>
              <Button
                type="button"
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1 px-2"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
              >
                <List className="h-3.5 w-3.5" aria-hidden />
                List
              </Button>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{formatTimeZoneCaption(tz)}</p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading && (showGrid ? <CalendarGridSkeleton /> : <ListSkeleton />)}

      {!loading && !error && slots.length === 0 && (
        <div
          className={cn(
            'flex min-h-[10rem] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground',
            fullDayTimeOff ? 'bg-muted/25' : 'bg-muted/10'
          )}
          role="status"
        >
          <p className="font-medium text-foreground">
            {fullDayTimeOff ? 'Doctor is unavailable on this day' : 'No time slots for this day'}
          </p>
          <p className="text-muted-foreground max-w-sm">
            {fullDayTimeOff
              ? 'Full-day time off is blocking this date. Pick another day or update the calendar.'
              : 'Your weekly hours may not include this weekday, or time off and other blocks are covering the day. Pick another date or update availability.'}
          </p>
        </div>
      )}

      {!loading && !error && slots.length > 0 && !showGrid && (
        <div className="space-y-2" role="list" aria-label="Appointment slots">
          {sortedSlots.map((s) => listSlotItem(s))}
        </div>
      )}

      {!loading && !error && slots.length > 0 && showGrid && (
        <div
          className={cn(
            'flex gap-0 overflow-hidden rounded-lg border border-border bg-background',
            fullDayTimeOff && 'bg-muted/20'
          )}
        >
          <div className="w-12 shrink-0 select-none border-r border-border py-0 text-right text-[10px] leading-none text-muted-foreground sm:text-xs">
            <div className="relative min-h-[28rem] w-full" style={{ height: 'min(70vh, 32rem)' }}>
              {hourTicks.map((t) => (
                <div key={t.hour} className="absolute right-1 -translate-y-1/2" style={{ top: `${t.topPct}%` }}>
                  {t.label}
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[28rem] min-w-0 flex-1" style={{ height: 'min(70vh, 32rem)' }}>
            {hourTicks.slice(1).map((t) => (
              <div
                key={`g-${t.hour}`}
                className="pointer-events-none absolute right-0 left-0 z-0 border-t border-border/60"
                style={{ top: `${t.topPct}%` }}
              />
            ))}
            {nowLinePct != null && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-primary"
                style={{ top: `${nowLinePct}%` }}
                role="presentation"
                title="Current time"
              />
            )}
            {nowLinePct != null && (
              <div
                className="pointer-events-none absolute -left-1 z-20 size-2 rounded-full bg-primary"
                style={{ top: `calc(${nowLinePct}% - 4px)` }}
                aria-hidden
              />
            )}
            {placed.filter((p) => !p.clippedOut).map((p) => renderSlotButton(p))}
          </div>
        </div>
      )}

      {isInteractive && (
        <BookingModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedStart(null);
            setBookingBusy(false);
          }}
          slotStart={selectedStart}
          doctorId={doctorId}
          patients={patients}
          defaultPatientId={bookPatientId}
          onSuccess={onBookingSuccess}
          timeZone={tz}
          onSubmittingChange={setBookingBusy}
        />
      )}
    </div>
  );
}
