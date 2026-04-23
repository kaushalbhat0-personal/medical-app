import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Building2, ChevronRight, Sparkles } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { patientsApi, publicDiscoveryApi, doctorsApi } from '../../services';
import type { Doctor, PatientMyDoctor, PublicTenantDiscovery } from '../../types';
import { ErrorState } from '../../components/common';
import { PATIENT_CLINIC_BOOKING_SCOPE_KEY } from '../../constants/patient';
import { DoctorRowCard } from '../../components/patient/DoctorRowCard';
import { PageSection } from '@/components/ui/page-section';
import { PatientSearchCombobox } from '../../components/patient/PatientSearchCombobox';
import { POPULAR_SPECIALIZATIONS } from '../../constants/patient';
import { Skeleton } from '@/components/ui/skeleton';
import { mockRatingFromId, mockReviewCountFromId } from '@/lib/patient/mockDoctorPresentation';

function typeLabel(t: PublicTenantDiscovery): string {
  if (t.organization_label) return t.organization_label;
  if (t.type === 'individual') return 'Individual practice';
  if (t.type === 'organization') return 'Organization';
  return t.type;
}

function HomeDoctorsRowSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[132px] w-[min(100%,300px)] shrink-0 rounded-2xl" />
      ))}
    </div>
  );
}

function ClinicsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

export function PatientHome() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<PublicTenantDiscovery[]>([]);
  const [myDoctors, setMyDoctors] = useState<PatientMyDoctor[]>([]);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      sessionStorage.removeItem(PATIENT_CLINIC_BOOKING_SCOPE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [tList, md, docs] = await Promise.all([
          publicDiscoveryApi.listTenants(),
          patientsApi.getMyDoctors(),
          doctorsApi.getAll(),
        ]);
        if (!cancelled) {
          setTenants(tList);
          setMyDoctors(md);
          setAllDoctors(docs);
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

  const { clinics, individuals } = useMemo(() => {
    const c = tenants.filter((t) => t.doctor_count > 1);
    const ind = tenants.filter((t) => t.doctor_count === 1);
    return { clinics: c, individuals: ind };
  }, [tenants]);

  if (error) {
    return <ErrorState title="Something went wrong" description={error} />;
  }

  return (
    <div className="space-y-8">
      <div
        className="sticky top-0 z-20 -mx-4 mb-2 border-b border-border/50 bg-background/95 px-4 py-2.5 backdrop-blur-md transition-shadow duration-200 sm:mx-0 sm:mb-3 sm:rounded-2xl sm:border sm:shadow-sm"
      >
        <PatientSearchCombobox tenants={tenants} allDoctors={allDoctors} className="w-full" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Find care, fast</h1>
        </div>
        <p className="text-sm text-muted-foreground sm:text-base">
          Book trusted doctors and clinics. Two taps: pick a time, confirm.
        </p>
      </div>

      {loading ? (
        <PageSection title="My doctors" description="From your care history" className="animate-in fade-in">
          <HomeDoctorsRowSkeleton />
        </PageSection>
      ) : (
        <PageSection
          title="My doctors"
          description="From your past and upcoming visits"
          className="animate-in fade-in duration-300"
          action={
            <Link
              to="/patient/doctors"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'gap-1 text-primary'
              )}
              state={{ browseAllDoctors: true }}
            >
              See all
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          {myDoctors.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center transition-colors"
              role="status"
            >
              <p className="text-sm text-muted-foreground">When you book visits, your doctors will appear here.</p>
              <Link
                to="/patient/doctors"
                state={{ browseAllDoctors: true }}
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                Browse all doctors
              </Link>
            </div>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-0.5 no-scrollbar [scrollbar-width:none] sm:mx-0 sm:px-0">
              {myDoctors.map((d) => (
                <div key={d.id} className="w-[min(92vw,300px)] shrink-0 snap-start sm:w-[280px]">
                  <DoctorRowCard
                    compact
                    name={d.name}
                    subtitle={d.specialization}
                    rating={mockRatingFromId(d.id)}
                    reviewCount={mockReviewCountFromId(d.id)}
                    availabilityLabel="Available today"
                    primaryLabel="Book Appointment"
                    onPrimary={() => navigate(`/patient/doctor/${d.id}`)}
                    onCardClick={() => navigate(`/patient/doctor/${d.id}`)}
                  />
                </div>
              ))}
            </div>
          )}
        </PageSection>
      )}

      {loading ? (
        <PageSection title="Clinics & hospitals" description="More than one doctor on site" className="animate-in fade-in">
          <ClinicsGridSkeleton />
        </PageSection>
      ) : (
        <PageSection title="Clinics & hospitals" description="Organizations with more than one doctor" className="animate-in fade-in duration-300">
          {clinics.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center"
              role="status"
            >
              <p className="text-sm text-muted-foreground">No multi-doctor locations listed yet. Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {clinics.map((t) => (
                <Link
                  key={t.id}
                  to={`/patient/clinic/${t.id}`}
                  state={{ tenantName: t.name }}
                  className="group block rounded-2xl border border-border/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" aria-hidden />
                        </div>
                        <span className="font-semibold text-foreground transition-colors group-hover:text-primary">
                          {t.name}
                        </span>
                      </div>
                      <p className="mt-2 pl-11 text-sm text-muted-foreground">
                        {t.doctor_count} doctors · {typeLabel(t)}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </PageSection>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full" />
            ))}
          </div>
        </div>
      ) : (
        <PageSection
          title="Popular specializations"
          description="Jump straight to a specialty"
          className="animate-in fade-in duration-300"
        >
          <div className="flex flex-wrap gap-2">
            {POPULAR_SPECIALIZATIONS.map((label) => (
              <button
                key={label}
                type="button"
                className="min-h-10 touch-manipulation rounded-full border border-border/80 bg-white px-4 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5"
                onClick={() =>
                  navigate('/patient/doctors', { state: { initialSearch: label, browseAllDoctors: true } })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </PageSection>
      )}

      {!loading && (
        <PageSection title="Solo practices" description="Individual doctors on the network" className="animate-in fade-in duration-300">
          {individuals.length === 0 ? (
            <p className="text-sm text-muted-foreground" role="status">
              No solo practices listed yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {individuals.map((t) => {
                const d = t.sole_doctor;
                return (
                  <li key={t.id}>
                    <DoctorRowCard
                      name={d?.name ?? t.name}
                      subtitle={`${d?.specialization ?? 'Specialist'} · ${typeLabel(t)}`}
                      rating={d ? mockRatingFromId(d.id) : 4.6}
                      reviewCount={d ? mockReviewCountFromId(d.id) : 120}
                      availabilityLabel={d ? 'Available today' : undefined}
                      primaryLabel="Book Appointment"
                      onPrimary={d ? () => navigate(`/patient/doctor/${d.id}`) : undefined}
                      onCardClick={d ? () => navigate(`/patient/doctor/${d.id}`) : undefined}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </PageSection>
      )}

      {!loading && (
        <div className="flex justify-center pt-2">
          <Link
            to="/patient/doctors"
            state={{ browseAllDoctors: true }}
            className={cn(buttonVariants({ variant: 'outline' }), 'rounded-2xl border-primary/20 px-6 transition hover:bg-primary/5')}
          >
            Browse all booking options
          </Link>
        </div>
      )}
    </div>
  );
}
