import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Star } from 'lucide-react';
import axios from 'axios';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { doctorsApi } from '../../services';
import type { Doctor } from '../../types';
import { useLinkedPatient } from '../../hooks';
import { usePatientDoctorBookingPanel } from '../../hooks/patient/usePatientDoctorBookingPanel';
import { ErrorState } from '../../components/common';
import { formatDoctorName } from '../../utils';
import { DoctorSlotPicker } from '../../components/patient/DoctorSlotPicker';
import { formatSlotTimeWithZoneLabel } from '../../utils/doctorSchedule';
import { DISPLAY_TIMEZONE } from '../../constants/time';
import { PATIENT_BOOKING_PENDING_STORAGE_KEY, PATIENT_CLINIC_BOOKING_SCOPE_KEY } from '../../constants/patient';
import { Button } from '@/components/ui/button';
import { mockRatingFromId, mockReviewCountFromId } from '@/lib/patient/mockDoctorPresentation';

export function PatientDoctorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: routeState } = useLocation();
  const tenantFromRoute = (routeState as { tenantId?: string } | null)?.tenantId;
  const { patientId, loading: patientLoading, error: patientError, refresh: refreshPatient } = useLinkedPatient();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const booking = usePatientDoctorBookingPanel(
    patientId,
    doctor,
    () => {},
    (created) => {
      try {
        sessionStorage.setItem(PATIENT_BOOKING_PENDING_STORAGE_KEY, JSON.stringify(created));
      } catch {
        /* */
      }
      navigate('/patient/appointments', { state: { seedAppointment: created } });
    }
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
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const d = await doctorsApi.getOne(id);
        if (!cancelled) setDoctor(d);
      } catch (e) {
        if (axios.isCancel(e)) return;
        if (!cancelled) {
          setLoadError('Could not load this doctor.');
          setDoctor(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return <ErrorState title="Missing doctor" description="Go back to search for a provider." />;
  }

  if (loadError) {
    return <ErrorState title="Doctor unavailable" description={loadError} />;
  }

  if (loading || !doctor) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        Loading doctor…
      </div>
    );
  }

  const name = formatDoctorName(doctor);
  const spec = doctor.specialization || doctor.specialty || 'Specialist';
  const rating = mockRatingFromId(String(doctor.id));
  const reviews = mockReviewCountFromId(String(doctor.id));
  const blocked = !patientId || doctor.has_availability_windows === false;
  const aboutText =
    doctor.experience_years != null
      ? `${name} is a ${spec.toLowerCase()} with ${doctor.experience_years}+ years of experience. Book a convenient slot in two taps.`
      : `${name} is a ${spec.toLowerCase()}. ${tenantLine(doctor) || 'Book online in two taps.'}`.trim();

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-2xl font-bold text-primary ring-1 ring-primary/10">
              {name
                .split(/\s+/)
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
              <p className="mt-0.5 text-sm font-medium text-primary/90">{spec}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-amber-700">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                  {rating.toFixed(1)} · {reviews} reviews
                </span>
              </div>
            </div>
          </div>
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

      <section className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">About</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{aboutText}</p>
      </section>

      <section className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Clinic</h2>
        <div className="mt-3 flex items-start gap-2">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{doctor.tenant_name || 'On the network'}</p>
            <p className="text-xs text-muted-foreground">
              {[doctor.tenant_organization_label, doctor.tenant_type].filter(Boolean).join(' · ') || 'Health provider'}
            </p>
          </div>
        </div>
      </section>

      {blocked && (
        <p className="text-sm text-amber-800" role="status">
          {doctor.has_availability_windows === false
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

function tenantLine(d: Doctor): string {
  if (d.tenant_name) return `Practices at ${d.tenant_name}.`;
  return '';
}
