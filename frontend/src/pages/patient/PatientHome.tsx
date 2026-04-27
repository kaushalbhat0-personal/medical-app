import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Sparkles, Stethoscope } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { doctorsApi, publicDiscoveryApi } from '../../services';
import type { Doctor, PublicTenantDiscovery } from '../../types';
import { ErrorState } from '../../components/common';
import { PATIENT_CLINIC_BOOKING_SCOPE_KEY } from '../../constants/patient';
import { COMMON_DISEASES, DISEASE_SPECIALIZATION_MAP } from '../../constants/diseaseMap';
import { DoctorRowCard } from '../../components/patient/DoctorRowCard';
import { PageSection } from '@/components/ui/page-section';
import { PatientSearchCombobox } from '../../components/patient/PatientSearchCombobox';
import { Skeleton } from '@/components/ui/skeleton';
import { mockRatingFromId, mockReviewCountFromId } from '@/lib/patient/mockDoctorPresentation';

function HomeRailSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[192px] w-[min(100%,300px)] shrink-0 rounded-2xl" />
      ))}
    </div>
  );
}

export function PatientHome() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<PublicTenantDiscovery[]>([]);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [familyDoctor, setFamilyDoctor] = useState<Doctor | null>(null);
  const [nearbyAvailable, setNearbyAvailable] = useState<Doctor[]>([]);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      sessionStorage.removeItem(PATIENT_CLINIC_BOOKING_SCOPE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo(null),
      { maximumAge: 120_000, timeout: 12_000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [tList, indexDocs, gp, near] = await Promise.all([
          publicDiscoveryApi.listTenants(),
          doctorsApi.getAll({ limit: 80 }),
          doctorsApi.getAll({
            specialization: DISEASE_SPECIALIZATION_MAP.fever,
            available_today: true,
            limit: 1,
            include_availability_hint: true,
          }),
          doctorsApi.getAll({
            available_today: true,
            limit: 12,
            include_availability_hint: true,
          }),
        ]);
        if (!cancelled) {
          setTenants(tList);
          setAllDoctors(indexDocs);
          setFamilyDoctor(gp[0] ?? null);
          setNearbyAvailable(near);
        }
      } catch {
        if (!cancelled) setError('Could not load discovery data. Try again shortly.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!geo) return;
    let cancelled = false;
    (async () => {
      setNearbyLoading(true);
      try {
        const near = await doctorsApi.getAll({
          available_today: true,
          limit: 12,
          include_availability_hint: true,
          lat: geo.lat,
          lng: geo.lng,
          radius: '5km',
        });
        if (!cancelled) setNearbyAvailable(near);
      } catch {
        if (!cancelled) {
          /* keep prior nearby list */
        }
      } finally {
        if (!cancelled) setNearbyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [geo?.lat, geo?.lng]);

  const nearYouSubtitle = useMemo(
    () =>
      geo
        ? 'Practices with a map pin within about 5 km, still only if they have open slots today'
        : 'Turn on location for distance-aware results — we still show everyone available today',
    [geo]
  );

  const nearbyRailDoctors = useMemo(() => {
    if (!familyDoctor) return nearbyAvailable;
    const fid = String(familyDoctor.id);
    return nearbyAvailable.filter((d) => String(d.id) !== fid);
  }, [nearbyAvailable, familyDoctor]);

  if (error) {
    return <ErrorState title="Something went wrong" description={error} />;
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 mb-2 border-b border-border/50 bg-background/95 px-4 py-2.5 backdrop-blur-md transition-shadow duration-200 sm:mx-0 sm:mb-3 sm:rounded-2xl sm:border sm:shadow-sm">
        <PatientSearchCombobox tenants={tenants} allDoctors={allDoctors} className="w-full min-w-0" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Find care, fast</h1>
        </div>
        <p className="text-sm text-muted-foreground sm:text-base">
          Book trusted doctors in two taps — shortcuts below are available today only.
        </p>
      </div>

      {loading ? (
        <PageSection title="Family doctor" description="General physician available today" className="animate-in fade-in">
          <Skeleton className="h-40 w-full rounded-2xl" />
        </PageSection>
      ) : (
        <PageSection
          title="Family doctor"
          description="A general physician you can book today"
          className="animate-in fade-in duration-300"
          action={
            <Link
              to="/patient/doctors"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1 text-primary')}
              state={{
                browseAllDoctors: true,
                initialSearch: DISEASE_SPECIALIZATION_MAP.fever,
              }}
            >
              More GPs
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          {familyDoctor ? (
            <button
              type="button"
              onClick={() => navigate(`/patient/doctor/${familyDoctor.id}`)}
              className="group relative w-full overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-background p-5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/20">
                  <Stethoscope className="h-7 w-7 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary/90">Featured GP</p>
                  <h2 className="mt-1 truncate text-lg font-bold text-foreground">{familyDoctor.name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{familyDoctor.specialization}</p>
                  <span className="mt-3 inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                    Available today
                  </span>
                </div>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </button>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center" role="status">
              <p className="text-sm text-muted-foreground">No general physicians with open slots today.</p>
              <Link
                to="/patient/doctors"
                state={{ browseAllDoctors: true }}
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                Explore all doctors
              </Link>
            </div>
          )}
        </PageSection>
      )}

      {loading ? (
        <PageSection title="Available near you today" description={nearYouSubtitle} className="animate-in fade-in">
          <HomeRailSkeleton />
        </PageSection>
      ) : (
        <PageSection
          title="Available near you today"
          description={nearbyLoading ? 'Updating for your location…' : nearYouSubtitle}
          className="animate-in fade-in duration-300"
          action={
            <Link
              to="/patient/doctors"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1 text-primary')}
              state={{ browseAllDoctors: true }}
            >
              See all
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          {nearbyRailDoctors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center" role="status">
              <p className="text-sm text-muted-foreground">
                {geo
                  ? 'No doctors with a location pin and open slots in range. Try widening search on the Doctors tab.'
                  : 'No open slots surfaced for today yet — check the Doctors tab for the full directory.'}
              </p>
            </div>
          ) : (
            <div className="relative -mx-1">
              <div
                className="pointer-events-none absolute left-0 top-0 z-10 h-full w-6 bg-gradient-to-r from-background to-transparent sm:hidden"
                aria-hidden
              />
              <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-background to-transparent sm:hidden" aria-hidden />
              <div
                className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
              >
                {nearbyRailDoctors.map((d) => (
                  <div key={String(d.id)} className="w-[min(92vw,300px)] shrink-0 snap-start sm:w-[280px]">
                    <DoctorRowCard
                      compact
                      name={d.name ?? 'Doctor'}
                      subtitle={d.specialization ?? 'Specialist'}
                      rating={mockRatingFromId(String(d.id))}
                      reviewCount={mockReviewCountFromId(String(d.id))}
                      availabilityLabel="Available today"
                      availabilityTone="today"
                      primaryLabel="Book Appointment"
                      onPrimary={() => navigate(`/patient/doctor/${d.id}`, { state: { focusBooking: true } })}
                      onCardClick={() => navigate(`/patient/doctor/${d.id}`)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </PageSection>
      )}

      {!loading && (
        <PageSection
          title="Common diseases"
          description="Maps to the right specialist on the doctors directory"
          className="animate-in fade-in duration-300"
        >
          <div className="flex flex-wrap gap-2">
            {COMMON_DISEASES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className="min-h-10 touch-manipulation rounded-full border border-border/80 bg-white px-4 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5"
                onClick={() =>
                  navigate('/patient/doctors', {
                    state: {
                      initialSearch: DISEASE_SPECIALIZATION_MAP[key],
                      browseAllDoctors: true,
                    },
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </PageSection>
      )}

      {!loading && (
        <div className="flex justify-center pt-2">
          <Link
            to="/patient/doctors"
            state={{ browseAllDoctors: true }}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'rounded-2xl border-primary/20 px-6 transition hover:bg-primary/5'
            )}
          >
            Browse all doctors & filters
          </Link>
        </div>
      )}
    </div>
  );
}
