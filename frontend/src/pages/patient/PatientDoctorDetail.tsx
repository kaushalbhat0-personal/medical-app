import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import axios from 'axios';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { doctorsApi, publicDiscoveryApi, type DoctorScheduleDay, type DoctorSlot } from '../../services';
import type { Doctor, PublicDoctorProfile } from '../../types';
import { useLinkedPatient } from '../../hooks';
import { usePatientDoctorBookingPanel } from '../../hooks/patient/usePatientDoctorBookingPanel';
import { ErrorState } from '../../components/common';
import { formatDoctorName } from '../../utils';
import { DoctorSlotPicker } from '../../components/patient/DoctorSlotPicker';
import {
  DoctorProfileAbout,
  DoctorProfileAvailabilitySummary,
  DoctorProfileClinic,
  DoctorProfileHero,
} from '../../components/patient/DoctorPublicProfileBlocks';
import { formatSlotTimeWithZoneLabel } from '../../utils/doctorSchedule';
import { DISPLAY_TIMEZONE } from '../../constants/time';
import { ymdAddDaysInIana, ymdNowInIana } from '../../utils/doctorSchedule';
import { PATIENT_BOOKING_PENDING_STORAGE_KEY, PATIENT_CLINIC_BOOKING_SCOPE_KEY } from '../../constants/patient';
import { Button } from '@/components/ui/button';

function publicToBookingDoctor(p: PublicDoctorProfile): Doctor {
  return {
    id: p.id,
    name: p.full_name,
    specialization: p.specialization,
    experience_years: p.experience,
    verification_status: p.verification_status,
    verified: p.verified,
    has_availability_windows: p.has_availability_windows,
    timezone: p.timezone,
  };
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4 pb-28">
      <div className="flex gap-4">
        <div className="h-24 w-24 shrink-0 animate-pulse rounded-2xl bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-36 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export function PatientDoctorDetail() {
  const { id, doctorId } = useParams<{ id?: string; doctorId?: string }>();
  const rawParam = doctorId ?? id;
  const navigate = useNavigate();
  const { state: routeState } = useLocation();
  const tenantFromRoute = (routeState as { tenantId?: string } | null)?.tenantId;
  const { patientId, loading: patientLoading, error: patientError, refresh: refreshPatient } = useLinkedPatient();
  const [publicDoctor, setPublicDoctor] = useState<PublicDoctorProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avLoading, setAvLoading] = useState(false);
  const [avError, setAvError] = useState<string | null>(null);
  const [todayYmd, setTodayYmd] = useState('');
  const [tomorrowYmd, setTomorrowYmd] = useState('');
  const [summaryDay, setSummaryDay] = useState<DoctorScheduleDay | null>(null);
  const [tomorrowSlots, setTomorrowSlots] = useState<DoctorSlot[]>([]);

  const bookingDoctor = useMemo(
    () => (publicDoctor ? publicToBookingDoctor(publicDoctor) : null),
    [publicDoctor]
  );

  const booking = usePatientDoctorBookingPanel(
    patientId,
    bookingDoctor,
    () => {},
    (created) => {
      try {
        sessionStorage.setItem(PATIENT_BOOKING_PENDING_STORAGE_KEY, JSON.stringify(created));
      } catch {
        /* */
      }
      navigate('/patient/appointments', { state: { seedAppointment: created } });
    },
    publicDoctor?.timezone ?? null
  );

  useEffect(() => {
    if (tenantFromRoute) {
      try {
        sessionStorage.setItem(PATIENT_CLINIC_BOOKING_SCOPE_KEY, tenantFromRoute);
      } catch {
        /* */
      }
    }
  }, [tenantFromRoute]);

  useEffect(() => {
    if (!rawParam) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setPublicDoctor(null);
      try {
        const p = await publicDiscoveryApi.getDoctor(rawParam);
        if (!cancelled) setPublicDoctor(p);
      } catch (e) {
        if (axios.isCancel(e)) return;
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          if (!cancelled) {
            setLoadError('This doctor is not available for booking.');
            setPublicDoctor(null);
          }
        } else if (!cancelled) {
          setLoadError('Could not load this doctor.');
          setPublicDoctor(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawParam]);

  useEffect(() => {
    if (!publicDoctor) return;
    const tz = publicDoctor.timezone;
    const t0 = ymdNowInIana(tz);
    const t1 = ymdAddDaysInIana(t0, tz, 1);
    setTodayYmd(t0);
    setTomorrowYmd(t1);
    let cancelled = false;
    (async () => {
      setAvLoading(true);
      setAvError(null);
      setSummaryDay(null);
      setTomorrowSlots([]);
      try {
        const [day, tom] = await Promise.all([
          doctorsApi.getScheduleDay(publicDoctor.id, t0, { fromYmd: t0, skipSlotsCache: true }),
          doctorsApi.getSlots(publicDoctor.id, t1, { skipCache: true }),
        ]);
        if (cancelled) return;
        setSummaryDay(day);
        setTomorrowSlots(tom);
      } catch {
        if (!cancelled) setAvError('Could not load availability.');
      } finally {
        if (!cancelled) setAvLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicDoctor?.id, publicDoctor?.timezone]);

  if (!rawParam) {
    return <ErrorState title="Missing doctor" description="Go back to search for a provider." />;
  }

  if (loadError) {
    return <ErrorState title="Doctor not available" description={loadError} />;
  }

  if (loading || !publicDoctor) {
    return <ProfileSkeleton />;
  }

  if (publicDoctor.verification_status !== 'approved') {
    return <ErrorState title="Doctor not available" description="This provider is not on the public network." />;
  }

  const name = formatDoctorName(bookingDoctor!);
  const blocked =
    !patientId || publicDoctor.has_availability_windows === false;

  return (
    <div className="space-y-6 pb-28">
      <div className="flex items-start gap-2">
        <Link
          to="/patient/doctors"
          state={{ browseAllDoctors: true }}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'mt-0.5 shrink-0 -ml-2 rounded-xl')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <DoctorProfileHero doctor={publicDoctor} />
        </div>
      </div>

      {patientError && (
        <p className="text-sm text-destructive" role="alert">
          {patientError}{' '}
          <button type="button" className="font-medium underline" onClick={() => void refreshPatient()}>
            Retry
          </button>
        </p>
      )}

      <DoctorProfileAbout doctor={publicDoctor} />
      <DoctorProfileClinic doctor={publicDoctor} />

      <DoctorProfileAvailabilitySummary
        loading={avLoading}
        error={avError}
        nextAvailable={summaryDay?.next_available ?? null}
        todayYmd={todayYmd}
        tomorrowYmd={tomorrowYmd}
        todaySlots={summaryDay?.slots ?? []}
        tomorrowSlots={tomorrowSlots}
        selectedStart={booking.selectedSlotStart}
        onPickSlot={(iso, ymd) => {
          booking.setBookDate(ymd);
          booking.setSelectedSlotStart(iso);
        }}
      />

      {blocked && (
        <p className="text-sm text-amber-800" role="status">
          {publicDoctor.has_availability_windows === false
            ? 'This doctor has not set online hours yet. Try another provider or call the clinic.'
            : 'Connect your profile to book.'}
        </p>
      )}

      {!blocked && !patientLoading && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Pick a time</h2>
          <Input
            id="book-date"
            type="date"
            min={booking.doctorTodayYmd}
            className="h-11 rounded-xl"
            value={booking.bookDate}
            onChange={(e) => booking.setBookDate(e.target.value)}
            disabled={!patientId || booking.submitting}
          />
          {booking.slotsError && (
            <p className="text-sm text-destructive" role="alert">
              {booking.slotsError}
            </p>
          )}
          {booking.bookDate && patientId && booking.slotsLoading && (
            <div className="grid grid-cols-3 gap-2" aria-hidden>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="min-h-[48px] animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          )}
          {booking.bookDate && patientId && !booking.slotsLoading && !booking.slotsError && booking.slots.length === 0 && (
            <p className="text-sm text-muted-foreground">No slots this day.</p>
          )}
          {booking.bookDate && patientId && !booking.slotsLoading && booking.slots.length > 0 && (
            <DoctorSlotPicker
              slots={booking.slots}
              bookDate={booking.bookDate}
              doctorTodayYmd={booking.doctorTodayYmd}
              selectedSlotStart={booking.selectedSlotStart}
              onSelect={booking.setSelectedSlotStart}
              disabled={booking.submitting}
              nextAvailableKey={booking.nextAvailableKey}
            />
          )}
        </section>
      )}

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <Button
          type="button"
          className="h-12 w-full min-h-[48px] text-base font-semibold"
          disabled={!booking.stickyBookEnabled}
          onClick={() => booking.setConfirmOpen(true)}
        >
          Book Appointment
        </Button>
      </div>

      {booking.confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          aria-busy={booking.submitting}
          onClick={() => {
            if (!booking.submitting) booking.closeConfirmOnly();
          }}
        >
          <div
            ref={booking.dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-appt-title-detail"
            className="w-full max-w-md rounded-t-xl border border-border bg-card text-foreground shadow-lg outline-none sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-4 py-3">
              <h2 id="book-appt-title-detail" className="text-lg font-semibold">
                Confirm
              </h2>
            </div>
            <div className="space-y-4 px-4 py-4">
              <p className="text-sm">
                <span className="font-medium">{name}</span>
                <br />
                <span className="text-muted-foreground">
                  {booking.bookDate} ·{' '}
                  {booking.selectedSlotStart
                    ? formatSlotTimeWithZoneLabel(booking.selectedSlotStart, DISPLAY_TIMEZONE)
                    : '—'}
                </span>
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[48px] w-full rounded-xl sm:w-auto"
                  onClick={booking.closeConfirmOnly}
                  disabled={booking.submitting}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="min-h-[48px] w-full rounded-xl sm:w-auto"
                  onClick={() => void booking.confirmBooking()}
                  disabled={booking.submitting || !booking.bookingReady}
                >
                  {booking.submitting ? (
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
