import { BadgeCheck, Building2, GraduationCap, MapPin, Star, Stethoscope, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PublicDoctorProfile } from '@/types';
import type { DoctorSlot } from '@/services/doctors';
import {
  formatNextAvailablePhrase,
  formatSlotTime,
  isSlotInstantInTheFuture,
  slotKey,
} from '@/utils/doctorSchedule';
import { DISPLAY_TIMEZONE } from '@/constants/time';

/** Deterministic “social proof” count for demo; replace with real metrics when available. */
export function patientsTreatedPlaceholder(doctorId: string): number {
  let h = 0;
  for (let i = 0; i < doctorId.length; i++) h = (h * 33 + doctorId.charCodeAt(i)) >>> 0;
  return 800 + (h % 2_200);
}

/** Booking-first strip: backend next_available_slot first; schedule day refines only when profile slot missing/invalid. */
export function DoctorProfileNextAvailableBanner({
  doctor,
  profileSlotIso,
  scheduleNext,
  todayYmd,
  doctorTodayYmd,
  todaySlots,
  loading,
  profileSlotsTodayCount,
}: {
  doctor: PublicDoctorProfile;
  profileSlotIso: string | null | undefined;
  scheduleNext: DoctorSlot | null;
  todayYmd: string;
  doctorTodayYmd: string;
  todaySlots: DoctorSlot[];
  loading: boolean;
  /** From public API when schedule day not loaded yet (bookable slots remaining today). */
  profileSlotsTodayCount?: number | null;
}) {
  const pickIso = (): string | null => {
    if (profileSlotIso && isSlotInstantInTheFuture(profileSlotIso)) return profileSlotIso;
    if (scheduleNext?.start && isSlotInstantInTheFuture(scheduleNext.start)) return scheduleNext.start;
    if (profileSlotIso) return profileSlotIso;
    if (scheduleNext?.start) return scheduleNext.start;
    return null;
  };
  const iso = pickIso();
  const phrase =
    iso && isSlotInstantInTheFuture(iso)
      ? formatNextAvailablePhrase(iso, todayYmd, doctorTodayYmd, DISPLAY_TIMEZONE)
      : null;
  const future = futureAvailableSlots(todaySlots);
  const left =
    future.length > 0
      ? future.length
      : typeof profileSlotsTodayCount === 'number' && profileSlotsTodayCount > 0
        ? profileSlotsTodayCount
        : 0;

  if (doctor.has_availability_windows === false) {
    return (
      <div className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.06] p-4">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Hours not online yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Call the clinic or try another verified provider.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/[0.12] via-background to-background p-4 shadow-md">
      {loading && !phrase ? (
        <div className="space-y-2" aria-busy aria-label="Loading next slot">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full max-w-sm animate-pulse rounded-lg bg-muted" />
        </div>
      ) : phrase ? (
        <>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Next available</p>
          <p className="mt-1 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            {phrase}
          </p>
          {doctor.available_today && left > 0 ? (
            <p className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
              {left <= 2 ? '🔥 Last few slots · ' : left <= 5 ? '⚡ Filling fast · ' : ''}
              Only {left} {left === 1 ? 'slot' : 'slots'} left today
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          No bookable times in the next couple of days — choose a date below or check back after the schedule updates.
        </p>
      )}
    </div>
  );
}

export function DoctorProfileHero({ doctor }: { doctor: PublicDoctorProfile }) {
  const img = doctor.profile_image?.trim();
  const initials = doctor.full_name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const synthetic = doctor.metrics_are_synthetic !== false;

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
              Verified doctor
            </span>
          ) : null}
        </h1>
        <p className="mt-1 text-sm font-medium text-primary/90">
          {doctor.specialization} · {doctor.experience} yrs experience
        </p>
        {doctor.clinic_name ? <p className="mt-1 text-sm text-muted-foreground">{doctor.clinic_name}</p> : null}
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          {synthetic ? (
            <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
              <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden />
              ⭐ {doctor.rating_average.toFixed(1)} (reviews coming soon)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
              <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden />
              ⭐ {doctor.rating_average.toFixed(1)} ({doctor.review_count} reviews)
            </span>
          )}
        </p>
        <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            {synthetic ? (
              <>
                <span className="font-medium text-foreground/90">📍 Distance estimate</span>
                <span className="ml-1 text-xs">(~{doctor.distance_km.toFixed(1)} km illustrative)</span>
              </>
            ) : (
              <>
                <span className="font-medium text-foreground/90">{doctor.distance_km.toFixed(1)} km away</span>
                <span className="ml-1 text-xs">(approx.)</span>
              </>
            )}
          </span>
        </p>
        <ul
          className="mt-3 flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-foreground/90 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1"
          aria-label="Trust signals"
        >
          {doctor.verified ? (
            <li className="inline-flex items-center gap-1.5 font-medium">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              ✔ Verified doctor
            </li>
          ) : null}
          <li className="inline-flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            ✔ {doctor.experience} years experience
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            {synthetic ? '👥 1000+ patients (approx.)' : `${patientsTreatedPlaceholder(doctor.id).toLocaleString()}+ patients treated`}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            ✔ Clinic consultation
          </li>
        </ul>
      </div>
    </div>
  );
}

export function DoctorProfileAbout({ doctor }: { doctor: PublicDoctorProfile }) {
  const spec = doctor.specialization.trim();
  const an = /^[aeiou]/i.test(spec) ? 'an' : 'a';
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
        About this doctor
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-foreground/90">
        {doctor.full_name} is a practicing {spec} with {doctor.experience} years of experience, focused on thoughtful,
        in-person care at the clinic. You can expect a full consultation in a private setting with clear follow-up
        guidance.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        {doctor.qualification?.trim() ? (
          <li>
            <span className="font-medium text-foreground">Qualification: </span>
            {doctor.qualification.trim()}
          </li>
        ) : null}
        <li>
          <span className="font-medium text-foreground">Focus: </span>
          {spec} (clinic-based)
        </li>
        <li className="text-muted-foreground/90">
          {doctor.full_name} is {an} {spec.toLowerCase()} who sees patients in person — book a slot to reserve your
          visit.
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

export function DoctorProfileAvailabilitySummarySkeleton() {
  return (
    <div className="mt-3 space-y-3" aria-busy aria-label="Loading availability">
      <div className="h-12 w-full max-w-sm animate-pulse rounded-xl bg-muted" />
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function DoctorProfileAvailabilitySummary({
  loading,
  error,
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

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !error ? <DoctorProfileAvailabilitySummarySkeleton /> : null}

      {!loading && !error ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Quick picks for today and tomorrow — choose a time in the booking section below (headline above shows the
            earliest opening).
          </p>

          <div className="mt-4 space-y-5">
            <div>
              {t.length > 0 ? (
                <>
                  <p className="text-sm font-bold text-foreground">🟢 Available today</p>
                </>
              ) : m.length > 0 ? (
                <div className="rounded-xl border border-dashed border-primary/35 bg-primary/[0.06] p-3">
                  <p className="text-sm font-semibold text-foreground">No slots left today</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    First opening tomorrow at {formatSlotTime(m[0]!.start, DISPLAY_TIMEZONE)}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3 h-10 w-full rounded-xl sm:w-auto"
                    onClick={() => onPickSlot(m[0]!.start, tomorrowYmd)}
                  >
                    Book tomorrow
                  </Button>
                </div>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">No slots left today</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {t.length === 0 ? (
                  m.length > 0 ? null : (
                    <span className="text-sm text-muted-foreground">
                      No open slots for the rest of today — use the date picker below to explore more days.
                    </span>
                  )
                ) : (
                  t.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => onPickSlot(s.start, todayYmd)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                        selectedStart != null && slotKey(selectedStart) === slotKey(s.start)
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
                  <span className="text-sm text-muted-foreground">No openings tomorrow yet — another day may work.</span>
                ) : (
                  m.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => onPickSlot(s.start, tomorrowYmd)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                        selectedStart != null && slotKey(selectedStart) === slotKey(s.start)
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
        </>
      ) : null}
    </section>
  );
}
