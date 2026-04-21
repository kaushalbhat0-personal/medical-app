import { Card, CardContent } from '@/components/ui/card';
import { usePatients } from '../../hooks';
import { ErrorState, EmptyState } from '../../components/common';

export function DoctorPatientsPage() {
  const { patients, loading, error, refetch } = usePatients();

  if (error) {
    return (
      <ErrorState
        title="Could not load patients"
        description="Patients linked to you through care or appointments."
        error={error}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
        <p className="text-sm text-muted-foreground mt-1">Patients you have seen or are scheduled with.</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && patients.length === 0 && (
        <EmptyState title="No patients yet" description="When you have appointments, patients appear here." />
      )}

      {!loading && patients.length > 0 && (
        <div className="grid gap-3">
          {patients.map((p) => (
            <Card key={String(p.id)}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{p.name || 'Patient'}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.age != null ? `${p.age} yrs` : null, p.gender, p.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
