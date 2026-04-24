import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { doctorsApi, publicDiscoveryApi } from '../../services';
import { useLinkedPatient } from '../../hooks';
import type { Doctor, PublicTenantDiscovery } from '../../types';
import { formatDoctorName } from '../../utils';
import { ErrorState } from '../../components/common';
import { DoctorRowCard } from '../../components/patient/DoctorRowCard';
import { PatientSearchCombobox } from '../../components/patient/PatientSearchCombobox';
import { PATIENT_CLINIC_BOOKING_SCOPE_KEY } from '../../constants/patient';
import { mockRatingFromId, mockReviewCountFromId } from '@/lib/patient/mockDoctorPresentation';
import { doctorAvailabilityPresentation } from '@/lib/patient/doctorAvailabilityPresentation';
import { Skeleton } from '@/components/ui/skeleton';

type PatientDoctorsLocationState = {
  preselectDoctorId?: string;
  tenantId?: string;
  browseAllDoctors?: boolean;
  initialSearch?: string;
};

function readResolvedPatientBookingTenantId(loc: Location): string | undefined {
  const s = (loc.state ?? null) as PatientDoctorsLocationState | null;
  if (s?.browseAllDoctors) {
    try {
      sessionStorage.removeItem(PATIENT_CLINIC_BOOKING_SCOPE_KEY);
    } catch {
      /* ignore */
    }
    return undefined;
  }
  if (s?.tenantId != null && s.tenantId !== '') {
    try {
      sessionStorage.setItem(PATIENT_CLINIC_BOOKING_SCOPE_KEY, s.tenantId);
    } catch {
      /* ignore */
    }
    return s.tenantId;
  }
  try {
    return sessionStorage.getItem(PATIENT_CLINIC_BOOKING_SCOPE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function DoctorsListSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[120px] w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function PatientDoctors() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? null) as PatientDoctorsLocationState | null;
  const preselectDoctorId = navState?.preselectDoctorId;
  const [listQuery, setListQuery] = useState(() => navState?.initialSearch?.trim() ?? '');
  const [resolvedTenantId, setResolvedTenantId] = useState<string | undefined>(() =>
    readResolvedPatientBookingTenantId(location)
  );
  const { patientId, loading: patientLoading, error: patientError, refresh: refreshPatient } = useLinkedPatient();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [allDoctorsForSearch, setAllDoctorsForSearch] = useState<Doctor[]>([]);
  const [tenants, setTenants] = useState<PublicTenantDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSearchIndex = useCallback(async () => {
    if (allDoctorsForSearch.length > 0) return;
    try {
      const [tList, global] = await Promise.all([publicDiscoveryApi.listTenants(), doctorsApi.getAll()]);
      setTenants(tList);
      setAllDoctorsForSearch(global);
    } catch {
      setAllDoctorsForSearch((d) => d);
    }
  }, [allDoctorsForSearch.length]);

  useEffect(() => {
    setResolvedTenantId(readResolvedPatientBookingTenantId(location));
  }, [location.key, location.state]);

  useEffect(() => {
    const s = navState?.initialSearch?.trim();
    if (s) setListQuery(s);
  }, [location.key, navState?.initialSearch]);

  useEffect(() => {
    if (!preselectDoctorId || patientLoading) return;
    navigate(`/patient/doctor/${preselectDoctorId}`, { replace: true, state: location.state });
  }, [preselectDoctorId, patientLoading, navigate, location.state]);

  useEffect(() => {
    if (preselectDoctorId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (resolvedTenantId) {
          const briefs = await publicDiscoveryApi.listTenantDoctors(resolvedTenantId);
          const list: Doctor[] = briefs.map((b) => ({
            id: b.id,
            name: b.name,
            specialization: b.specialization,
          }));
          if (!cancelled) setDoctors(list);
        } else {
          const list = await doctorsApi.getAll({ limit: 100, include_availability_hint: true });
          if (!cancelled) {
            setDoctors(list);
            setAllDoctorsForSearch((prev) => (prev.length > 0 ? prev : list));
          }
        }
        void loadSearchIndex();
      } catch {
        if (!cancelled) setError('Unable to load doctors.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedTenantId, preselectDoctorId, loadSearchIndex]);

  const filteredDoctors = useMemo(() => {
    const q = listQuery.toLowerCase();
    if (!q) return doctors;
    return doctors.filter((d) => {
      const name = (d.name || '').toLowerCase();
      const spec = (d.specialization || d.specialty || '').toLowerCase();
      return name.includes(q) || spec.includes(q);
    });
  }, [doctors, listQuery]);

  if (error) {
    return <ErrorState title="Could not load doctors" description={error} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Doctors</h1>
        <p className="text-xs text-muted-foreground">
          {resolvedTenantId ? 'Choose a provider at this organization' : 'Search and open a profile to book in two taps'}
        </p>
      </div>

      <div className="md:hidden">
        <PatientSearchCombobox tenants={tenants} allDoctors={allDoctorsForSearch} className="w-full" />
      </div>

      {patientError && (
        <p className="text-sm text-destructive" role="alert">
          {patientError}{' '}
          <button type="button" className="font-medium underline" onClick={() => void refreshPatient()}>
            Retry
          </button>
        </p>
      )}

      {!preselectDoctorId && (loading || patientLoading) && <DoctorsListSkeleton />}

      {!preselectDoctorId && !loading && !patientLoading && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Filter by name or specialization"
              className="h-10 rounded-xl pl-9 transition-shadow"
              aria-label="Filter doctor list"
            />
          </div>
          <div className="grid gap-3">
            {filteredDoctors.map((d) => {
              const spec = d.specialization || d.specialty || 'Specialist';
              const noAvailability = d.has_availability_windows === false;
              const blocked = !patientId || noAvailability;
              const { label: availLabel, tone: availTone } = doctorAvailabilityPresentation(d);
              return (
                <DoctorRowCard
                  key={String(d.id)}
                  name={formatDoctorName(d)}
                  subtitle={spec}
                  rating={mockRatingFromId(String(d.id))}
                  reviewCount={mockReviewCountFromId(String(d.id))}
                  availabilityLabel={availLabel}
                  availabilityTone={availTone}
                  primaryLabel="Book Appointment"
                  onPrimary={blocked ? undefined : () => navigate(`/patient/doctor/${d.id}`)}
                  onCardClick={blocked ? undefined : () => navigate(`/patient/doctor/${d.id}`)}
                  className={cn(
                    'transition-transform duration-200 hover:-translate-y-0.5',
                    blocked && 'opacity-60'
                  )}
                />
              );
            })}
          </div>
        </>
      )}

      {!preselectDoctorId && !loading && !patientLoading && doctors.length === 0 && (
        <p className="text-sm text-muted-foreground" role="status">
          No doctors available.
        </p>
      )}

      {!preselectDoctorId && !loading && !patientLoading && doctors.length > 0 && filteredDoctors.length === 0 && (
        <p className="text-sm text-muted-foreground" role="status">
          No matches for that search.
        </p>
      )}
    </div>
  );
}
