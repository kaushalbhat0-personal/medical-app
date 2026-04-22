import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  appointmentsApi,
  doctorsApi,
  invalidateDoctorSlotsClientCache,
  shouldSyncSlotsCrossTab,
  SLOTS_CROSS_TAB_BROADCAST,
  type DoctorSlot,
} from '../../services';
import { dedupeDoctorSlots, slotKey } from '../../utils/doctorSchedule';
import { useLinkedPatient, useModalFocusTrap } from '../../hooks';
import type { Doctor } from '../../types';
import { formatDoctorName } from '../../utils';
import { ErrorState } from '../../components/common';
import { PATIENT_BOOKING_PENDING_STORAGE_KEY } from '../../constants/patient';

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
    <div className="grid grid-cols-3 gap-2" aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="min-h-[44px] rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function DoctorsGridSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="min-h-[44px] w-full rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}

export function PatientDoctors() {
  const navigate = useNavigate();
  const { patientId, loading: patientLoading, error: patientError, refresh: refreshPatient } = useLinkedPatient();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [bookDate, setBookDate] = useState('');
  const [slots, setSlots] = useState<DoctorSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingIdempotencyKey, setBookingIdempotencyKey] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const abortCreateRef = useRef<AbortController | null>(null);
  const slotsRequestIdRef = useRef(0);
  const slotsFetchAbortRef = useRef<AbortController | null>(null);

  const minBookDate = useMemo(() => localDateInputValue(new Date()), []);
  const todayCalendarStr = localDateInputValue(new Date());

  useModalFocusTrap(dialogRef, confirmOpen && Boolean(bookingDoctor));

  const slotOk = selectedSlotStart != null && selectedSlotIsFuture(selectedSlotStart);
  const bookingReady =
    Boolean(patientId) && Boolean(bookDate) && Boolean(bookingIdempotencyKey) && slotOk;

  const exitBookingFlow = useCallback(() => {
    abortCreateRef.current?.abort();
    abortCreateRef.current = null;
    slotsFetchAbortRef.current?.abort();
    slotsFetchAbortRef.current = null;
    setConfirmOpen(false);
    setBookingDoctor(null);
    setBookDate('');
    setSlots([]);
    setSlotsLoading(false);
    setSlotsError(null);
    setSelectedSlotStart(null);
    setSubmitting(false);
    setBookingIdempotencyKey('');
  }, []);

  const closeConfirmOnly = useCallback(() => {
    if (submitting) return;
    setConfirmOpen(false);
  }, [submitting]);

  useEffect(() => {
    return () => {
      abortCreateRef.current?.abort();
      abortCreateRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!bookingDoctor || confirmOpen) return;
    const id = requestAnimationFrame(() => {
      document.getElementById('book-date')?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [bookingDoctor?.id, confirmOpen]);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault();
        closeConfirmOnly();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen, submitting, closeConfirmOnly]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await doctorsApi.getAll();
        if (!cancelled) setDoctors(list);
      } catch {
        if (!cancelled) setError('Unable to load doctors.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSlots = useCallback(
    async (mode: 'initial' | 'poll') => {
      if (!bookingDoctor || !bookDate || !patientId) return;
      const reqId = ++slotsRequestIdRef.current;
      let signal: AbortSignal | undefined;
      if (mode === 'initial') {
        slotsFetchAbortRef.current?.abort();
        const ac = new AbortController();
        slotsFetchAbortRef.current = ac;
        signal = ac.signal;
        setSlotsLoading(true);
        setSlotsError(null);
        setSelectedSlotStart(null);
      }
      try {
        const list = await doctorsApi.getSlots(String(bookingDoctor.id), bookDate, {
          signal,
          skipCache: mode === 'poll',
        });
        if (reqId !== slotsRequestIdRef.current) return;
        setSlots(dedupeDoctorSlots(list));
        if (mode === 'poll') setSlotsError(null);
      } catch (e) {
        if (axios.isCancel(e)) return;
        if (signal?.aborted) return;
        if (reqId !== slotsRequestIdRef.current) return;
        if (mode === 'initial') {
          setSlotsError('Unable to load available slots.');
          setSlots([]);
        }
      } finally {
        if (mode === 'initial' && (!signal || !signal.aborted) && reqId === slotsRequestIdRef.current) {
          setSlotsLoading(false);
        }
      }
    },
    [bookingDoctor?.id, bookDate, patientId]
  );

  useEffect(() => {
    if (!bookingDoctor || !bookDate || !patientId) {
      setSlots([]);
      setSlotsLoading(false);
      setSlotsError(null);
      setSelectedSlotStart(null);
      return;
    }
    void fetchSlots('initial');
    return () => slotsFetchAbortRef.current?.abort();
  }, [bookingDoctor?.id, bookDate, patientId, fetchSlots]);

  useEffect(() => {
    if (!bookingDoctor || !bookDate || !patientId) return;

    let intervalId: ReturnType<typeof window.setInterval> | undefined;

    const clearPoll = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const startPollIfVisible = () => {
      clearPoll();
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      intervalId = window.setInterval(() => {
        void fetchSlots('poll');
      }, 30_000);
    };

    startPollIfVisible();

    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        void fetchSlots('poll');
        startPollIfVisible();
      } else {
        clearPoll();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearPoll();
    };
  }, [bookingDoctor?.id, bookDate, patientId, fetchSlots]);

  useEffect(() => {
    if (!bookingDoctor) return;
    const onOtherTab = () => {
      if (!shouldSyncSlotsCrossTab()) return;
      void fetchSlots('poll');
    };
    window.addEventListener(SLOTS_CROSS_TAB_BROADCAST, onOtherTab);
    return () => window.removeEventListener(SLOTS_CROSS_TAB_BROADCAST, onOtherTab);
  }, [bookingDoctor, fetchSlots]);

  const selectDoctor = (d: Doctor) => {
    setBookingIdempotencyKey(crypto.randomUUID());
    setBookingDoctor(d);
    setBookDate(minBookDate);
    setSlots([]);
    setSlotsError(null);
    setSelectedSlotStart(null);
    setConfirmOpen(false);
  };

  const confirmBooking = async () => {
    if (!bookingDoctor || !patientId) {
      toast.error('Unable to resolve patient profile. Use Retry or contact the clinic.');
      return;
    }
    if (!bookingIdempotencyKey) {
      toast.error('Please reopen the booking dialog.');
      return;
    }
    if (!bookDate || !selectedSlotStart) {
      toast.error('Please select a date and time slot.');
      return;
    }
    if (!selectedSlotIsFuture(selectedSlotStart)) {
      toast.error('Choose a valid time in the future.');
      return;
    }
    if (submitting) return;

    abortCreateRef.current?.abort();
    const ac = new AbortController();
    abortCreateRef.current = ac;

    setSubmitting(true);
    try {
      const { appointment: created, idempotentReplay } = await appointmentsApi.create(
        {
          doctor_id: String(bookingDoctor.id),
          patient_id: patientId,
          appointment_time: selectedSlotStart,
        },
        { idempotencyKey: bookingIdempotencyKey, signal: ac.signal }
      );
      try {
        sessionStorage.setItem(PATIENT_BOOKING_PENDING_STORAGE_KEY, JSON.stringify(created));
      } catch {
        /* storage full / disabled */
      }
      exitBookingFlow();
      toast.success(
        idempotentReplay ? 'Appointment already booked successfully.' : 'Appointment booked.'
      );
      navigate('/patient/appointments', { state: { seedAppointment: created } });
    } catch (err) {
      if (axios.isCancel(err)) return;
      const detail =
        axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object'
          ? String((err.response.data as { detail?: unknown }).detail ?? '')
          : '';
      if (detail.includes('Slot already booked')) {
        toast.error('That slot was just taken. Choose another time.');
        setSelectedSlotStart(null);
        if (bookDate && bookingDoctor) {
          invalidateDoctorSlotsClientCache(String(bookingDoctor.id), bookDate);
          setSlotsLoading(true);
          try {
            const list = await doctorsApi.getSlots(String(bookingDoctor.id), bookDate, { skipCache: true });
            setSlots(dedupeDoctorSlots(list));
          } catch {
            setSlotsError('Unable to load available slots.');
          } finally {
            setSlotsLoading(false);
          }
        }
      } else {
        toast.error('Booking failed. Try another time or contact the clinic.', { duration: 5000 });
      }
    } finally {
      if (abortCreateRef.current === ac) {
        abortCreateRef.current = null;
      }
      setSubmitting(false);
    }
  };

  if (error) {
    return <ErrorState title="Could not load doctors" description={error} />;
  }

  const inTimeStep = Boolean(bookingDoctor) && !confirmOpen;
  const stickyBookEnabled =
    Boolean(patientId) && slotOk && !slotsLoading && !submitting && !slotsError && slots.length > 0;

  return (
    <div className={cn('space-y-4', inTimeStep && 'pb-24')}>
      {!bookingDoctor ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight">Book a visit</h1>
          <p className="text-xs text-muted-foreground">Step 1 — Doctor</p>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 -ml-2 h-11 w-11"
            aria-label="Back to doctors"
            onClick={() => exitBookingFlow()}
            disabled={submitting}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight truncate">{formatDoctorName(bookingDoctor)}</h1>
            <p className="text-xs text-muted-foreground">Step 2 — Time</p>
          </div>
        </div>
      )}

      {patientError && (
        <p className="text-sm text-destructive" role="alert">
          {patientError}{' '}
          <button type="button" className="underline font-medium" onClick={() => void refreshPatient()}>
            Retry
          </button>
        </p>
      )}

      {!bookingDoctor && (loading || patientLoading) && <DoctorsGridSkeleton />}

      {!bookingDoctor && !loading && !patientLoading && (
        <div className="grid gap-2">
          {doctors.map((d) => {
            const spec = d.specialization || d.specialty;
            const noAvailability = d.has_availability_windows === false;
            return (
              <button
                key={String(d.id)}
                type="button"
                disabled={!patientId || noAvailability}
                onClick={() => selectDoctor(d)}
                className={cn(
                  'min-h-[44px] w-full rounded-lg border border-input bg-background px-4 py-3 text-left text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'disabled:pointer-events-none disabled:opacity-50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <span className="block truncate">{formatDoctorName(d)}</span>
                {spec ? <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{spec}</span> : null}
              </button>
            );
          })}
        </div>
      )}

      {!loading && !patientLoading && !bookingDoctor && doctors.length === 0 && (
        <p className="text-sm text-muted-foreground">No doctors available.</p>
      )}

      {inTimeStep && bookingDoctor && (
        <>
          {!patientId && (
            <p className="text-sm text-destructive" role="alert">
              Profile required to book. Retry above.
            </p>
          )}

          <Input
            id="book-date"
            type="date"
            min={minBookDate}
            className="h-11"
            value={bookDate}
            onChange={(e) => {
              setBookDate(e.target.value);
              setSelectedSlotStart(null);
            }}
            disabled={!patientId || submitting}
          />

          {slotsError && (
            <p className="text-sm text-destructive" role="alert">
              {slotsError}
            </p>
          )}

          {bookDate && patientId && slotsLoading && <SlotsSkeleton />}

          {bookDate && patientId && !slotsLoading && !slotsError && slots.length === 0 && (
            <p className="text-sm text-muted-foreground">No slots this day.</p>
          )}

          {bookDate && patientId && !slotsLoading && slots.length > 0 && (
            <div role="listbox" aria-label="Times" className="grid grid-cols-3 gap-2">
              {slots.map((slot) => {
                const pastOnToday = bookDate === todayCalendarStr && isSlotInThePast(slot.start);
                const sk = slotKey(slot.start);
                const selected = selectedSlotStart != null && slotKey(selectedSlotStart) === sk;
                const disabled = !slot.available || submitting || pastOnToday;
                return (
                  <button
                    key={sk}
                    type="button"
                    data-testid="slot-button"
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-disabled={disabled}
                    onClick={() => setSelectedSlotStart(sk)}
                    className={cn(
                      'min-h-[44px] rounded-lg border px-2 text-sm font-medium tabular-nums transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'disabled:cursor-not-allowed disabled:opacity-45',
                      selected
                        ? 'border-primary bg-primary text-white hover:bg-primary/90'
                        : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {formatSlotLabel(slot.start)}
                  </button>
                );
              })}
            </div>
          )}

          <div
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-sm"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <Button
              type="button"
              className="h-12 w-full min-h-[44px] text-base font-semibold"
              disabled={!stickyBookEnabled}
              onClick={() => setConfirmOpen(true)}
            >
              Book Appointment
            </Button>
          </div>
        </>
      )}

      {confirmOpen && bookingDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          aria-busy={submitting}
          onClick={() => {
            if (!submitting) closeConfirmOnly();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-appt-title"
            className="w-full max-w-md rounded-t-xl border border-border bg-card shadow-lg outline-none sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-4 py-3">
              <h2 id="book-appt-title" className="text-lg font-semibold">
                Step 3 — Confirm
              </h2>
            </div>
            <div className="space-y-4 px-4 py-4">
              <p className="text-sm">
                <span className="font-medium">{formatDoctorName(bookingDoctor)}</span>
                <br />
                <span className="text-muted-foreground">
                  {bookDate} · {selectedSlotStart ? formatSlotLabel(selectedSlotStart) : '—'}
                </span>
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="min-h-[44px] w-full sm:w-auto" onClick={closeConfirmOnly} disabled={submitting}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] w-full sm:w-auto"
                  onClick={() => void confirmBooking()}
                  disabled={submitting || !bookingReady}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Booking…
                    </>
                  ) : (
                    'Confirm'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}