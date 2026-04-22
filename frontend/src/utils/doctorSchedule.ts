import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Calendar YYYY-MM-DD for the given instant in an IANA zone (e.g. doctor "today"). */
export function ymdInTimeZone(iana: string, d: Date = new Date()): string {
  const tz = iana || 'UTC';
  try {
    return dayjs(d).tz(tz).format('YYYY-MM-DD');
  } catch {
    return dayjs(d).format('YYYY-MM-DD');
  }
}

export function addDaysYmd(ymd: string, iana: string, deltaDays: number): string {
  const tz = iana || 'UTC';
  try {
    return dayjs.tz(`${ymd} 12:00:00`, tz).add(deltaDays, 'day').format('YYYY-MM-DD');
  } catch {
    const d = new Date(ymd + 'T12:00:00');
    d.setDate(d.getDate() + deltaDays);
    return dayjs(d).format('YYYY-MM-DD');
  }
}

/** True 9:00 → 17:00 window for that calendar day in the zone (DST-safe total length). */
export function getCalendarViewWindow(
  dateYmd: string,
  iana: string,
  startWall = '09:00',
  endWall = '17:00'
): { viewStart: Dayjs; viewEnd: Dayjs; totalMinutes: number } {
  const tz = iana || 'UTC';
  const viewStart = dayjs.tz(`${dateYmd} ${startWall}`, tz);
  const viewEnd = dayjs.tz(`${dateYmd} ${endWall}`, tz);
  const raw = viewEnd.diff(viewStart, 'minute', true);
  const totalMinutes = Math.max(1 / 60, raw);
  return { viewStart, viewEnd, totalMinutes };
}

function later(a: Dayjs, b: Dayjs): Dayjs {
  return a.isAfter(b) ? a : b;
}

function earlier(a: Dayjs, b: Dayjs): Dayjs {
  return a.isBefore(b) ? a : b;
}

export type SlotBlockInViewResult = {
  clippedOut: boolean;
  topPct: number;
  heightPct: number;
  visualStart: Dayjs;
  visualEnd: Dayjs;
};

/** Map a slot (UTC ISO + duration) into the 9–17 view; uses real instants, not fixed 480 min. */
export function slotBlockInView(
  iso: string,
  durationMinutes: number,
  viewStart: Dayjs,
  viewEnd: Dayjs,
  totalMinutes: number
): SlotBlockInViewResult {
  const slotStart = dayjs.utc(iso);
  const slotEnd = slotStart.add(durationMinutes, 'minute');
  const clipStart = later(slotStart, viewStart);
  const clipEnd = earlier(slotEnd, viewEnd);
  if (!clipStart.isBefore(clipEnd)) {
    return {
      clippedOut: true,
      topPct: 0,
      heightPct: 0,
      visualStart: clipStart,
      visualEnd: clipEnd,
    };
  }
  const topMin = clipStart.diff(viewStart, 'minute', true);
  const heightMin = clipEnd.diff(clipStart, 'minute', true);
  return {
    clippedOut: false,
    topPct: (topMin / totalMinutes) * 100,
    heightPct: (heightMin / totalMinutes) * 100,
    visualStart: clipStart,
    visualEnd: clipEnd,
  };
}

/** Position of "now" in the same view (0–100), or null if outside the window. */
export function nowLinePercentInView(
  dateYmd: string,
  doctorTodayYmd: string,
  viewStart: Dayjs,
  viewEnd: Dayjs,
  totalMinutes: number
): number | null {
  if (dateYmd !== doctorTodayYmd) return null;
  const now = dayjs();
  if (now.isBefore(viewStart) || now.isAfter(viewEnd)) return null;
  const m = now.diff(viewStart, 'minute', true);
  return (m / totalMinutes) * 100;
}

/** Every wall hour 9…17 that falls in [viewStart, viewEnd] with % from view top. */
export function listHourGridTicks(
  dateYmd: string,
  iana: string,
  viewStart: Dayjs,
  viewEnd: Dayjs,
  totalMinutes: number
): { hour: number; label: string; topPct: number }[] {
  const tz = iana || 'UTC';
  const out: { hour: number; label: string; topPct: number }[] = [];
  for (let h = 9; h <= 17; h += 1) {
    const t = dayjs.tz(`${dateYmd} ${String(h).padStart(2, '0')}:00:00`, tz);
    if (t.isBefore(viewStart, 'minute')) continue;
    if (t.isAfter(viewEnd, 'minute')) break;
    const min = t.diff(viewStart, 'minute', true);
    const topPct = (min / totalMinutes) * 100;
    out.push({ hour: h, label: t.format('h:mm A'), topPct });
  }
  return out;
}

/** Minutes from local midnight in `iana` for the UTC instant `iso` (slot start from API). */
export function wallMinutesInZone(iso: string, iana: string): number {
  const tz = iana || 'UTC';
  try {
    const x = dayjs.utc(iso).tz(tz);
    return x.hour() * 60 + x.minute() + x.second() / 60;
  } catch {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 0;
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }
}

/** Short timezone label for a wall time (e.g. IST, EST). Uses the instant for DST correctness. */
export function timeZoneAbbreviation(iana: string, refMs?: number): string {
  const z = (iana || 'UTC').trim() || 'UTC';
  const ref = refMs != null && !Number.isNaN(refMs) ? refMs : Date.now();
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: z, timeZoneName: 'short' }).formatToParts(
      new Date(ref)
    );
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? z.replace(/_/g, ' ');
  } catch {
    return z.replace(/_/g, ' ');
  }
}

/** Calendar YYYY-MM-DD in the doctor zone for a UTC instant from the API. */
export function appointmentCalendarDayYmd(iso: string, iana: string): string {
  const tz = iana || 'UTC';
  try {
    return dayjs.utc(iso).tz(tz).format('YYYY-MM-DD');
  } catch {
    return ymdInTimeZone(tz, new Date(iso));
  }
}

/** Format a slot start for display in the doctor's local zone (API times are UTC). */
export function formatSlotTime(iso: string, iana: string): string {
  if (!iso?.trim()) return '—';
  const tz = iana || 'UTC';
  try {
    return dayjs.utc(iso).tz(tz).format('h:mm A');
  } catch {
    return '—';
  }
}

export function formatSlotTimeWithZoneLabel(iso: string, iana: string): string {
  if (!iso?.trim()) return '—';
  const time = formatSlotTime(iso, iana);
  const abbr = timeZoneAbbreviation(iana, new Date(iso).getTime());
  return `${time} (${abbr})`;
}

export function formatSlotDateTimeLine(iso: string, iana: string): string {
  if (!iso?.trim()) return '—';
  const tz = iana || 'UTC';
  try {
    return dayjs.utc(iso).tz(tz).format('ddd, MMM D — h:mm A');
  } catch {
    return '—';
  }
}

/** Longer line for lists: date, time, and short zone (e.g. Wed, Apr 23 — 10:00 AM (IST)). */
export function formatAppointmentDateTimeWithZoneLabel(iso: string, iana: string): string {
  if (!iso?.trim()) return '—';
  const line = formatSlotDateTimeLine(iso, iana);
  const abbr = timeZoneAbbreviation(iana, new Date(iso).getTime());
  return `${line} (${abbr})`;
}

/**
 * "Today" / "Yesterday" / long date for grouping headings, using the doctor's calendar
 * (not the browser's local date).
 */
export function relativeCalendarDayHeadingInZone(iso: string, iana: string): string {
  const tz = iana || 'UTC';
  try {
    const d = dayjs.utc(iso).tz(tz);
    const todayYmd = ymdInTimeZone(tz, new Date());
    const ymd = d.format('YYYY-MM-DD');
    const yestYmd = addDaysYmd(todayYmd, iana, -1);
    if (ymd === todayYmd) return 'Today';
    if (ymd === yestYmd) return 'Yesterday';
    return d.format('dddd, MMMM D, YYYY');
  } catch {
    return 'Unknown date';
  }
}

export function relativeCalendarDayTitleInZone(iso: string, iana: string): string {
  const h = relativeCalendarDayHeadingInZone(iso, iana);
  if (h === 'Today') return 'TODAY';
  if (h === 'Yesterday') return 'YESTERDAY';
  return h;
}

/** e.g. "All times in IST (Asia/Kolkata)" for the schedule footnote. */
export function formatTimeZoneCaption(iana: string): string {
  const z = (iana || 'UTC').trim();
  let short = z;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: z, timeZoneName: 'short' }).formatToParts(
      new Date()
    );
    const tzName = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (tzName) short = tzName;
  } catch {
    short = z.replace(/_/g, ' ');
  }
  return `All times in ${short} (${z})`;
}

export function formatNextAvailablePhrase(iso: string, slotDayYmd: string, doctorTodayYmd: string, iana: string): string {
  const time = formatSlotTime(iso, iana);
  if (slotDayYmd === doctorTodayYmd) return `Today at ${time}`;
  if (addDaysYmd(doctorTodayYmd, iana, 1) === slotDayYmd) return `Tomorrow at ${time}`;
  try {
    const day = dayjs.utc(iso).tz(iana).format('ddd, MMM D');
    return `${day} at ${time}`;
  } catch {
    return time;
  }
}

/** @deprecated use listHourGridTicks; kept for any imports */
export function formatHourLabelForDate(hour: number, dateYmd: string, iana: string): string {
  const tz = iana || 'UTC';
  const pad = (n: number) => String(n).padStart(2, '0');
  const s = `${dateYmd} ${pad(hour)}:00:00`;
  try {
    return dayjs.tz(s, tz).format('h:mm A');
  } catch {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
}

export function isSlotInPast(isoStart: string, selectedYmd: string, doctorTodayYmd: string): boolean {
  if (selectedYmd < doctorTodayYmd) return true;
  if (selectedYmd > doctorTodayYmd) return false;
  const t = new Date(isoStart).getTime();
  if (Number.isNaN(t)) return true;
  return t <= Date.now();
}

/** "Now" as minutes from midnight in the doctor's zone. */
export function nowWallMinutes(iana: string): number {
  const tz = iana || 'UTC';
  try {
    const x = dayjs().tz(tz);
    return x.hour() * 60 + x.minute() + x.second() / 60;
  } catch {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60;
  }
}

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00'));
}

export function parseAndClampDateParam(raw: string | null, minYmd: string): string | null {
  if (!raw || !isYmd(raw)) return null;
  if (raw < minYmd) return minYmd;
  return raw;
}

/**
 * Canonical UTC instant key aligned with backend `normalize_appointment_time_utc`
 * (second and sub-second parts zeroed). Use for slot identity in UI state merges.
 */
export function slotKey(iso: string): string {
  return dayjs.utc(iso).second(0).millisecond(0).toISOString();
}

export function dedupeDoctorSlots<T extends { start: string }>(slots: T[]): T[] {
  const m = new Map<string, T>();
  for (const s of slots) {
    m.set(slotKey(s.start), s);
  }
  return [...m.values()].sort((a, b) => slotKey(a.start).localeCompare(slotKey(b.start)));
}

/** Pure overlap lane assignment for interval scheduling (ms since epoch). */
export function assignOverlapLanesPure(
  intervals: { start: number; end: number }[]
): { lane: number; laneCount: number }[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const laneByIndex: number[] = [];
  for (const s of sorted) {
    let lane = laneEnds.findIndex((end) => end <= s.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.end);
    } else {
      laneEnds[lane] = s.end;
    }
    laneByIndex.push(lane);
  }
  const laneCount = Math.max(1, laneEnds.length);
  return laneByIndex.map((lane) => ({ lane, laneCount }));
}
