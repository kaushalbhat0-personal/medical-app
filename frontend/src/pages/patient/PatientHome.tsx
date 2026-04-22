import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Stethoscope, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { patientsApi, publicDiscoveryApi } from '../../services';
import type { PatientMyDoctor, PublicTenantDiscovery } from '../../types';
import { ErrorState } from '../../components/common';

function SectionSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="h-5 w-40 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded-md bg-muted animate-pulse mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-14 w-full rounded-lg bg-muted/80 animate-pulse" />
        ))}
      </CardContent>
    </Card>
  );
}

function typeLabel(t: PublicTenantDiscovery): string {
  if (t.organization_label) return t.organization_label;
  if (t.type === 'hospital') return 'Hospital';
  if (t.type === 'clinic') return 'Clinic';
  if (t.type === 'independent_doctor') return 'Practice';
  return t.type;
}

export function PatientHome() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<PublicTenantDiscovery[]>([]);
  const [myDoctors, setMyDoctors] = useState<PatientMyDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [tList, md] = await Promise.all([
          publicDiscoveryApi.listTenants(),
          patientsApi.getMyDoctors(),
        ]);
        if (!cancelled) {
          setTenants(tList);
          setMyDoctors(md);
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
    const clinics = tenants.filter((t) => t.doctor_count > 1);
    const individuals = tenants.filter((t) => t.doctor_count === 1);
    return { clinics, individuals };
  }, [tenants]);

  if (error) {
    return <ErrorState title="Something went wrong" description={error} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find care</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your doctors, multi-doctor clinics, and independent providers in one place.
        </p>
      </div>

      {loading ? (
        <>
          <SectionSkeleton lines={2} />
          <SectionSkeleton lines={3} />
          <SectionSkeleton lines={3} />
        </>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">My doctors</CardTitle>
              </div>
              <CardDescription>From your past and upcoming visits</CardDescription>
            </CardHeader>
            <CardContent>
              {myDoctors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  When you book visits, your doctors will appear here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {myDoctors.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        className={cn(
                          'w-full flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3 text-left text-sm transition-colors',
                          'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        )}
                        onClick={() =>
                          navigate('/patient/doctors', { state: { preselectDoctorId: d.id } })
                        }
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{d.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{d.specialization}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Clinics & hospitals</CardTitle>
              </div>
              <CardDescription>Organizations with more than one doctor</CardDescription>
            </CardHeader>
            <CardContent>
              {clinics.length === 0 ? (
                <p className="text-sm text-muted-foreground">No multi-doctor locations yet.</p>
              ) : (
                <ul className="space-y-2">
                  {clinics.map((t) => (
                    <li key={t.id}>
                      <Link
                        to={`/patient/clinic/${t.id}`}
                        state={{ tenantName: t.name }}
                        className={cn(
                          buttonVariants({ variant: 'outline' }),
                          'w-full justify-between h-auto min-h-[44px] py-3 px-4 font-normal'
                        )}
                      >
                        <span className="min-w-0 text-left">
                          <span className="font-medium block truncate">{t.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {t.doctor_count} doctors · {typeLabel(t)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Individual doctors</CardTitle>
              </div>
              <CardDescription>Solo practices on the network</CardDescription>
            </CardHeader>
            <CardContent>
              {individuals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No solo practices listed yet.</p>
              ) : (
                <ul className="space-y-2">
                  {individuals.map((t) => {
                    const d = t.sole_doctor;
                    return (
                      <li
                        key={t.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {d?.name ?? t.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {d?.specialization ?? 'Specialist'} · {typeLabel(t)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="tabular-nums">
                            1 doctor
                          </Badge>
                          {d && (
                            <button
                              type="button"
                              className={cn(buttonVariants({ size: 'sm' }), 'min-h-9')}
                              onClick={() =>
                                navigate('/patient/doctors', { state: { preselectDoctorId: d.id } })
                              }
                            >
                              Book
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-center pt-2">
            <Link
              to="/patient/doctors"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}
            >
              Browse all booking options
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
