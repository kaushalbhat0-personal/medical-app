import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { doctorsApi, tenantsApi } from '../../services';
import type { Doctor, Tenant } from '../../types';
import { formatDoctorName } from '../../utils';
import { ErrorState } from '../../components/common';

const DISEASE_CHIPS: { label: string; term: string }[] = [
  { label: 'Diabetes', term: 'diabet' },
  { label: 'Cardiology', term: 'cardio' },
  { label: 'Pediatrics', term: 'pediatr' },
  { label: 'Orthopedics', term: 'ortho' },
  { label: 'General', term: 'general' },
];

function doctorSpecialtyText(d: Doctor): string {
  return (d.specialization || d.specialty || '').toLowerCase();
}

const HOME_DOCTOR_PREVIEW = 6;

function HomeLoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-full max-w-md rounded-md bg-muted animate-pulse" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="h-5 w-40 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-56 rounded-md bg-muted animate-pulse mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-full bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-48 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded-md bg-muted animate-pulse mt-2" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded-lg bg-muted animate-pulse" />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-40 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-52 rounded-md bg-muted animate-pulse mt-2" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: HOME_DOCTOR_PREVIEW }).map((_, i) => (
            <div key={i} className="h-14 w-full rounded-lg border border-transparent bg-muted/80 animate-pulse" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function PatientHome() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [chipTerm, setChipTerm] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [docList, tenantList] = await Promise.all([doctorsApi.getAll(), tenantsApi.getAll()]);
        if (!cancelled) {
          setDoctors(docList);
          setTenants(tenantList);
        }
      } catch (e) {
        if (!cancelled) setError('Could not load marketplace data. Try again shortly.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return doctors.filter((d) => {
      const spec = doctorSpecialtyText(d);
      const name = formatDoctorName(d).toLowerCase();
      const matchChip = !chipTerm || spec.includes(chipTerm);
      const matchSearch =
        !q || name.includes(q) || spec.includes(q) || String(d.license_number || '').toLowerCase().includes(q);
      return matchChip && matchSearch;
    });
  }, [doctors, search, chipTerm]);

  if (error) {
    return <ErrorState title="Something went wrong" description={error} />;
  }

  if (loading) {
    return <HomeLoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find care</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search doctors and browse hospitals on the network.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search doctors</CardTitle>
          <CardDescription>Name, specialty, or keyword</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by doctor name or specialty…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick filters</p>
            <div className="flex flex-wrap gap-2">
              {DISEASE_CHIPS.map(({ label, term }) => {
                const active = chipTerm === term;
                return (
                  <Badge
                    key={term}
                    variant={active ? 'default' : 'secondary'}
                    className="cursor-pointer px-3 py-1"
                    onClick={() => setChipTerm(active ? null : term)}
                  >
                    {label}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hospitals & clinics</CardTitle>
          <CardDescription>From GET /tenants — active providers</CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenants listed yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {tenants.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm flex items-center justify-between gap-2"
                >
                  <span className="font-medium truncate">{t.name}</span>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {t.type}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Matching doctors</CardTitle>
            <CardDescription>
              {filtered.length === 0
                ? `${doctors.length} doctor${doctors.length === 1 ? '' : 's'} on the network`
                : `${filtered.length} match${filtered.length === 1 ? '' : 'es'} · previewing ${Math.min(HOME_DOCTOR_PREVIEW, filtered.length)} of ${doctors.length}`}
            </CardDescription>
          </div>
          <Link
            to="/patient/doctors"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'inline-flex shrink-0 w-full justify-center sm:w-auto'
            )}
          >
            View all doctors
          </Link>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No doctors match your filters.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.slice(0, HOME_DOCTOR_PREVIEW).map((d) => (
                <li
                  key={String(d.id)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{formatDoctorName(d)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.specialization || d.specialty || 'Specialty not listed'}
                    </p>
                  </div>
                  {(d.specialization || d.specialty) && (
                    <Badge variant="secondary" className="shrink-0">
                      {d.specialization || d.specialty}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
