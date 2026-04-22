import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Loader2, CalendarPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAppointments, useModalFocusTrap } from '../../hooks';
import { useDoctorWorkspace } from '../../contexts/DoctorWorkspaceContext';
import { ErrorState, EmptyState } from '../../components/common';
import { appointmentsApi, doctorsApi, type DoctorSlot } from '../../services';
import type { Appointment } from '../../types';

type Tab = 'upcoming' | 'past';

function appointmentTime(a: Appointment): number {
  const t = a.appointment_time || a.scheduled_at;
  return t ? new Date(t).getTime() : 0;
}

function localDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatSlotLabel(isoStart: string): string {
  const d = new Date(isoStart);
  if (Number.isNaN(d.getTime())) return isoStart;
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function selectedSlotIsFuture(isoStart: string): boolean {
  const d = new Date(isoStart);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

function isSlotInThePast(isoStart: string): boolean {
  const d = new Date(isoStart);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() <= Date.now();
}

function SlotsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-8 w-16 rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  );
}

export function DoctorAppointmentsPage() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { appointments, patients, loading, error, refetch } = useAppointments();
  const { isIndependent, selfDoctor, isReadOnly } = useDoctorWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const now = useMemo(() => Date.now(), []);
  const minBookDate = useMemo(() => localDateInputValue(new Date()), []);
  const todayCalendarStr = useMemo(() => localDateInputValue(new Date()), []);

  const { upcoming, past } = useMemo(() => {
    const u: Appointment[] = [];
    const p: Appointment[] = [];
    for (const a of appointments) {
      const t = appointmentTime(a);
      if (t >= now && (a.status === 'scheduled' || a.status === 'pending')) {
        u.push(a);
      } else {
        p.push(a);
      }
    }
    u.sort((a, b) => appointmentTime(a) - appointmentTime(b));
    p.sort((a, b) => appointmentTime(b) - appointmentTime(a));
    return { upcoming: u, past: p };
  }, [appointments, now]);

  const list = tab === 'upcoming' ? upcoming : past;

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [bookDate, setBookDate] = useState('');
  const [patientId, setPatientId] = useState('');
  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingIdempotencyKey, setBookingIdempotencyKey] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scheduleOpenedRef = useRef(false);

  useModalFocusTrap(dialogRef, scheduleOpen);

  const closeSchedule = useCallback(() => {
    abortRef.current?.abort();
    setScheduleOpen(false);
    setBookDate('');
    setPatientId('');
    setSlots([]);
    setSlotsError(null);
    setSelectedSlotStart(null);
    setSubmitting(false);
    setBookingIdempotencyKey('');
    if (location.state && typeof location.state === 'object' && 'openSchedule' in location.state) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: location.hash },
        { replace: true, state: {} }
      );
    }
  }, [location.hash, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const st = location.state as { openSchedule?: boolean } | null;
    if (st?.openSchedule && isIndependent && !scheduleOpenedRef.current) {
      scheduleOpenedRef.current = true;
      setBookingIdempotencyKey(crypto.randomUUID());
      setScheduleOpen(true);
    }
  }, [location.state, isIndependent]);

  const selfId = selfDoctor != null ? String(selfDoctor.id) : '';

  const fetchSlots = useCallback(
    async (signal: AbortSignal | undefined) => {
      if (!selfId || !bookDate || !patientId) return;
      setSlotsLoading(true);
      setSlotsError(null);
      setSelectedSlotStart(null);
      try {
        const list = await doctorsApi.getSlots(selfId, bookDate, { signal });
        if (signal?.aborted) return;
        setSlots(list);
      } catch (e) {
        if (axios.isCancel(e)) return;
        if (signal?.aborted) return;
        setSlotsError('Unable to load available slots.');
        setSlots([]);
      } finally {
        if (!signal?.aborted) setSlotsLoading(false);
      }
    },
    [selfId, bookDate, patientId]
  );

  useEffect(() => {
    if (!scheduleOpen || !selfId || !bookDate || !patientId) {
      setSlots([]);
      setSlotsLoading(false);
      setSlotsError(null);
      return;
    }
    const ac = new AbortController();
    void fetchSlots(ac.signal);
    return () => ac.abort();
  }, [scheduleOpen, selfId, bookDate, patientId, fetchSlots]);

  const slotOk = selectedSlotStart != null && selectedSlotIsFuture(selectedSlotStart);
  const canConfirm = Boolean(patientId && bookDate && bookingIdempotencyKey && slotOk);

  const confirmSchedule = async () => {
    if (!selfId || !patientId || !bookingIdempotencyKey) {
      toast.error('Select a patient, date, and time.');
      return;
    }
    if (!canConfirm) {
      toast.error('Choose a valid future time slot.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await appointmentsApi.create(
        {
          doctor_id: selfId,
          patient_id: patientId,
          appointment_time: selectedSlotStart!,
        },
        { idempotencyKey: bookingIdempotencyKey }
      );
      toast.success('Appointment scheduled');
      closeSchedule();
      void refetch();
    } catch (err) {
      const detail =
        axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object'
          ? String((err.response.data as { detail?: unknown }).detail ?? '')
          : '';
      toast.error(detail || 'Could not create appointment', { duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return <ErrorState title="Could not load appointments" description="" error={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isReadOnly
              ? 'Upcoming and past visits assigned to you (read only).'
              : 'Upcoming and past visits.'}
          </p>
        </div>
        {isIndependent && selfDoctor && selfDoctor.has_availability_windows !== false && (
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => {
              setBookingIdempotencyKey(crypto.randomUUID());
              setScheduleOpen(true);
            }}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Schedule
          </Button>
        )}
      </div>

      {isIndependent && selfDoctor?.has_availability_windows === false && (
        <p className="text-sm text-muted-foreground rounded-lg border border-border px-3 py-2">
          Set your weekly availability in <strong>Availability</strong> before scheduling visits in this portal.
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant={tab === 'upcoming' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('upcoming')}
          className={cn(tab === 'upcoming' && 'shadow-sm')}
        >
          Upcoming
        </Button>
        <Button
          type="button"
          variant={tab === 'past' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('past')}
        >
          Past
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && list.length === 0 && (
        <EmptyState
          title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
          description="Your schedule will show here."
        />
      )}

      {!loading &&
        list.map((a) => (
          <Card key={String(a.id)}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {(a.appointment_time || a.scheduled_at || '').replace('T', ' ').slice(0, 16)}
              </span>
              <span className="text-muted-foreground capitalize">{a.status}</span>
            </CardContent>
          </Card>
        ))}

      {scheduleOpen && selfId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !submitting && closeSchedule()}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sched-title"
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-lg outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-4 py-3">
              <h2 id="sched-title" className="text-lg font-semibold">
                Schedule visit
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">For your practice, using your published slots.</p>
            </div>
            <div className="space-y-4 px-4 py-4">
              <div>
                <label htmlFor="sched-patient" className="text-xs font-medium text-muted-foreground">
                  Patient
                </label>
                <select
                  id="sched-patient"
                  className="mt-1 flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select patient</option>
                  {patients.map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {p.name || 'Patient'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sched-date" className="text-xs font-medium text-muted-foreground">
                  Date
                </label>
                <Input
                  id="sched-date"
                  type="date"
                  min={minBookDate}
                  className="mt-1"
                  value={bookDate}
                  onChange={(e) => {
                    setBookDate(e.target.value);
                    setSelectedSlotStart(null);
                  }}
                  disabled={!patientId || submitting}
                />
              </div>
              {slotsError && (
                <p className="text-sm text-destructive" role="alert">
                  {slotsError}
                </p>
              )}
              {bookDate && patientId && slotsLoading && <SlotsSkeleton />}
              {bookDate && patientId && !slotsLoading && !slotsError && slots.length === 0 && (
                <p className="text-sm text-muted-foreground">No slots for this date.</p>
              )}
              {bookDate && patientId && !slotsLoading && slots.length > 0 && (
                <div role="listbox" aria-label="Available times">
                  <p className="text-xs font-medium text-muted-foreground">Time</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.map((slot) => {
                      const pastOnToday = bookDate === todayCalendarStr && isSlotInThePast(slot.start);
                      return (
                        <Button
                          key={slot.start}
                          type="button"
                          size="sm"
                          variant={selectedSlotStart === slot.start ? 'default' : 'outline'}
                          disabled={!slot.available || submitting || pastOnToday}
                          onClick={() => setSelectedSlotStart(slot.start)}
                          className="min-w-[4.5rem]"
                        >
                          {formatSlotLabel(slot.start)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
              <Button type="button" variant="outline" onClick={closeSchedule} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void confirmSchedule()} disabled={submitting || !canConfirm}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
