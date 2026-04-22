import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicDiscoveryApi } from '../../services';
import type { PublicTenantDoctorBrief } from '../../types';
import { ErrorState } from '../../components/common';
import { cn } from '@/lib/utils';

export function PatientClinicDoctors() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const tenantName = (location.state as { tenantName?: string } | null)?.tenantName;

  const [doctors, setDoctors] = useState<PublicTenantDoctorBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await publicDiscoveryApi.listTenantDoctors(tenantId);
        if (!cancelled) setDoctors(list);
      } catch {
        if (!cancelled) setError('Could not load providers for this organization.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (!tenantId) {
    return <ErrorState title="Missing clinic" description="Go back to home and pick an organization." />;
  }

  if (error) {
    return <ErrorState title="Something went wrong" description={error} />;
  }

  const title = tenantName || 'Clinic';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to="/patient/home"
          aria-label="Back to home"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'shrink-0 -ml-2')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
          <p className="text-xs text-muted-foreground">Choose a doctor to book</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Doctors</CardTitle>
          <CardDescription>All active providers at this location</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : doctors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No doctors listed yet.</p>
          ) : (
            <ul className="space-y-2">
              {doctors.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded-lg border border-border bg-background px-4 py-3 text-left text-sm transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    )}
                    onClick={() =>
                      navigate('/patient/doctors', { state: { preselectDoctorId: d.id } })
                    }
                  >
                    <span className="font-medium block truncate">{d.name}</span>
                    <span className="text-xs text-muted-foreground block truncate mt-0.5">
                      {d.specialization}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
