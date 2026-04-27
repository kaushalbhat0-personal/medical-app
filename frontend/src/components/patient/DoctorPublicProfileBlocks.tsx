import { BadgeCheck, Building2, GraduationCap, Loader2, MapPin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicDoctorProfile } from '@/types';
import type { DoctorSlot } from '@/services/doctors';
import { formatSlotTime, isSlotInstantInTheFuture } from '@/utils/doctorSchedule';
import { DISPLAY_TIMEZONE } from '@/constants/time';

export function DoctorProfileHero({ doctor }: { doctor: PublicDoctorProfile }) {
  const img = doctor.profile_image?.trim();
  const initials = doctor.full_name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex gap-4 items-start">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl ring-1 ring-border/80">
        {img ? (
          <img src={img} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5 text-2xl font-bold text-primary">
            {initials}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-foreground">
          {doctor.full_name}
          {doctor.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-400">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              Verified
            </span>
          ) : null}
        </h1>
        <p className="mt-1 text-sm font-medium text-primary/90">
          {doctor.specialization} · {doctor.experience} yrs
        </p>
        {doctor.clinic_name ? <p className="mt-1 text-sm text-muted-foreground">{doctor.clinic_name}</p> : null}
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Star className="h-4 w-4 text-amber-500" aria-hidden />
          Ratings coming soon
        </p>
      </div>
    </div>
  );
}

export function DoctorProfileAbout({ doctor }: { doctor: PublicDoctorProfile }) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
        About doctor
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        {doctor.qualification?.trim() ? (
          <li>
            <span className="font-medium text-foreground">Qualification: </span>
            {doctor.qualification.trim()}
          </li>
        ) : null}
        <li>
          <span className="font-medium text-foreground">Experience: </span>
          {doctor.experience} years
        </li>
        <li className="pt-1 leading-relaxed text-muted-foreground/90">
          {doctor.full_name} is a {doctor.specialization.toLowerCase()} with {doctor.experience} years of experience.
        </li>
      </ul>
    </section>
  );
}

export function DoctorProfileClinic({ doctor }: { doctor: PublicDoctorProfile }) {
  const hasAny = Boolean(
    doctor.clinic_name?.trim() || doctor.address?.trim() || doctor.city?.trim()
  );
  if (!hasAny) return null;

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Building2 className="h-4 w-4 text-primary" aria-hidden />
        Clinic info
      </h2>
      <div className="mt-3 space-y-2 text-sm">
        {doctor.clinic_name?.trim() ? (
          <p className="font-medium text-foreground">{doctor.clinic_name.trim()}</p>
        ) : null}
        {doctor.address?.trim() ? (
          <p className="flex gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>{doctor.address.trim()}</span>
          </p>
        ) : null}
        {doctor.city?.trim() ? (
          <p className="text-muted-foreground pl-6">{doctor.city.trim()}</p>
        ) : null}
      </div>
    </section>
  );
}

type AvailabilitySummaryProps = {
  loading: boolean;
  error: string | null;
  nextAvailable: DoctorSlot | null;
  todayYmd: string;
  tomorrowYmd: string;
  todaySlots: DoctorSlot[];
  tomorrowSlots: DoctorSlot[];
  selectedStart: string | null;
  onPickSlot: (isoStart: string, dateYmd: string) => void;
};

function futureAvailableSlots(slots: DoctorSlot[]): DoctorSlot[] {
  return slots.filter((s) => s.available && isSlotInstantInTheFuture(s.start));
}

export function DoctorProfileAvailabilitySummary({
  loading,
  error,
  nextAvailable,
  todayYmd,
  tomorrowYmd,
  todaySlots,
  tomorrowSlots,
  selectedStart,
  onPickSlot,
}: AvailabilitySummaryProps) {
  const t = futureAvailableSlots(todaySlots);
  const m = futureAvailableSlots(tomorrowSlots);

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight text-foreground">Availability</h2>
      {nextAvailable?.start && isSlotInstantInTheFuture(nextAvailable.start) ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Next available:{' '}
          <span className="font-medium text-foreground">
            {formatSlotTime(nextAvailable.start, DISPLAY_TIMEZONE)}
          </span>
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !error ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading slots…
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {t.length === 0 ? (
                <span className="text-sm text-muted-foreground">No open slots left today</span>
              ) : (
                t.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => onPickSlot(s.start, todayYmd)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                      selectedStart === s.start
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted/60'
                    )}
                  >
                    {formatSlotTime(s.start, DISPLAY_TIMEZONE)}
                  </button>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tomorrow</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {m.length === 0 ? (
                <span className="text-sm text-muted-foreground">No slots tomorrow</span>
              ) : (
                m.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    onClick={() => onPickSlot(s.start, tomorrowYmd)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                      selectedStart === s.start
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted/60'
                    )}
                  >
                    {formatSlotTime(s.start, DISPLAY_TIMEZONE)}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
