import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { appointmentsApi, doctorsApi, type DoctorSlot } from '../../services';
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
    <div className="flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-8 w-16 rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function DoctorsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="space-y-2">
            <div className="h-5 w-48 max-w-[70%] rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-28 rounded-md bg-muted animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-6 w-24 rounded-md bg-muted animate-pulse" />
            <div className="h-3 w-full rounded-md bg-muted animate-pulse" />
          </CardContent>
          <CardFooter>
            <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
          </CardFooter>
        </Card>
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

  const [modalOpen, setModalOpen] = useState(false);
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

  const minBookDate = useMemo(() => localDateInputValue(new Date()), []);
  const todayCalendarStr = localDateInputValue(new Date());

  useModalFocusTrap(dialogRef, modalOpen && Boolean(bookingDoctor));

  const slotOk = selectedSlotStart != null && selectedSlotIsFuture(selectedSlotStart);
  const bookingReady =
    Boolean(patientId) && Boolean(bookDate) && Boolean(bookingIdempotencyKey) && slotOk;

  const closeModal = useCallback(() => {
    abortCreateRef.current?.abort();
    abortCreateRef.current = null;
    setModalOpen(false);
    setBookingDoctor(null);
    setBookDate('');
    setSlots([]);
    setSlotsLoading(false);
    setSlotsError(null);
    setSelectedSlotStart(null);
    setSubmitting(false);
    setBookingIdempotencyKey('');
  }, []);

  useEffect(() => {
    return () => {
      abortCreateRef.current?.abort();
      abortCreateRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!modalOpen || !bookingDoctor) return;
    const id = requestAnimationFrame(() => {
      document.getElementById('book-date')?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [modalOpen, bookingDoctor?.id]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault();
        closeModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, submitting, closeModal]);

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
    async (signal: AbortSignal | undefined, mode: 'initial' | 'poll') => {
      if (!bookingDoctor || !bookDate || !patientId) return;
      if (mode === 'initial') {
        setSlotsLoading(true);
        setSlotsError(null);
        setSelectedSlotStart(null);
      }
      try {
        const list = await doctorsApi.getSlots(String(bookingDoctor.id), bookDate, { signal });
        if (signal?.aborted) return;
        setSlots(list);
        if (mode === 'poll') setSlotsError(null);
      } catch (e) {
        if (axios.isCancel(e)) return;
        if (signal?.aborted) return;
        if (mode === 'initial') {
          setSlotsError('Unable to load available slots.');
          setSlots([]);
        }
      } finally {
        if (mode === 'initial' && !signal?.aborted) setSlotsLoading(false);
      }
    },
    [bookingDoctor?.id, bookDate, patientId]
  );

  useEffect(() => {
    if (!modalOpen || !bookingDoctor || !bookDate || !patientId) {
      setSlots([]);
      setSlotsLoading(false);
      setSlotsError(null);
      setSelectedSlotStart(null);
      return;
    }
    const ac = new AbortController();
    void fetchSlots(ac.signal, 'initial');
    return () => ac.abort();
  }, [modalOpen, bookingDoctor?.id, bookDate, patientId, fetchSlots]);

  useEffect(() => {
    if (!modalOpen || !bookingDoctor || !bookDate || !patientId) return;

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
        void fetchSlots(undefined, 'poll');
      }, 30_000);
    };

    startPollIfVisible();

    const onVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        void fetchSlots(undefined, 'poll');
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
  }, [modalOpen, bookingDoctor?.id, bookDate, patientId, fetchSlots]);

  const openBookModal = (d: Doctor) => {
    setBookingIdempotencyKey(crypto.randomUUID());
    setBookingDoctor(d);
    setBookDate('');
    setSlots([]);
    setSlotsError(null);
    setSelectedSlotStart(null);
    setModalOpen(true);
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
      const created = await appointmentsApi.create(
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
      closeModal();
      toast.success('Appointment booked.');
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
          setSlotsLoading(true);
          try {
            const list = await doctorsApi.getSlots(String(bookingDoctor.id), bookDate);
            setSlots(list);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Doctors</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse providers and book an appointment.</p>
      </div>

      {patientError && (
        <p className="text-sm text-destructive" role="alert">
          {patientError}{' '}
          <button type="button" className="underline font-medium" onClick={() => void refreshPatient()}>
            Retry
          </button>
        </p>
      )}

      {loading || patientLoading ? (
        <DoctorsGridSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {doctors.map((d) => {
            const spec = d.specialization || d.specialty;
            const noAvailability = d.has_availability_windows === false;
            return (
              <Card key={String(d.id)} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg">{formatDoctorName(d)}</CardTitle>
                  <CardDescription>
                    {d.experience_years != null ? `${d.experience_years}+ yrs experience` : 'Provider'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  {spec && (
                    <Badge variant="secondary" className="text-xs">
                      {spec}
                    </Badge>
                  )}
                  {d.license_number && (
                    <p className="text-xs text-muted-foreground">License: {d.license_number}</p>
                  )}
                  {noAvailability && (
                    <p className="text-sm text-muted-foreground" role="status">
                      Doctor has not set availability
                    </p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => openBookModal(d)}
                    disabled={!patientId || noAvailability}
                  >
                    Book appointment
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !patientLoading && doctors.length === 0 && (
        <p className="text-sm text-muted-foreground">No doctors are available right now.</p>
      )}

      {modalOpen && bookingDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          aria-busy={submitting}
          onClick={() => {
            if (!submitting) closeModal();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-appt-title"
            aria-busy={submitting}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-lg outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-4 py-3">
              <h2 id="book-appt-title" className="text-lg font-semibold">
                Book appointment
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">{formatDoctorName(bookingDoctor)}</p>
            </div>
            <div className="space-y-4 px-4 py-4">
              {!patientId && (
                <p className="text-sm text-destructive" role="alert">
                  Unable to resolve patient profile. Use Retry on this page or contact the clinic.
                </p>
              )}
              <div>
                <label htmlFor="book-date" className="text-xs font-medium text-muted-foreground">
                  Date
                </label>
                <Input
                  id="book-date"
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

              {bookDate &&
                patientId &&
                !slotsLoading &&
                !slotsError &&
                slots.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {bookingDoctor?.has_availability_windows === false
                        ? 'Doctor has not set availability'
                        : 'No slots available for this date.'}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={submitting}
                      onClick={() => {
                        closeModal();
                      }}
                    >
                      Try another doctor
                    </Button>
                  </div>
                )}

              {bookDate && patientId && !slotsLoading && slots.length > 0 && (
                <div role="listbox" aria-label="Available appointment times">
                  <p className="text-xs font-medium text-muted-foreground">Time</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.map((slot) => {
                      const pastOnToday =
                        bookDate === todayCalendarStr && isSlotInThePast(slot.start);
                      return (
                        <Button
                          key={slot.start}
                          type="button"
                          data-testid="slot-button"
                          size="sm"
                          variant={selectedSlotStart === slot.start ? 'default' : 'outline'}
                          disabled={!slot.available || submitting || pastOnToday}
                          aria-pressed={selectedSlotStart === slot.start}
                          aria-disabled={!slot.available || pastOnToday}
                          className="min-w-[4.5rem]"
                          onClick={() => setSelectedSlotStart(slot.start)}
                        >
                          {formatSlotLabel(slot.start)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={closeModal} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  type="button"
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