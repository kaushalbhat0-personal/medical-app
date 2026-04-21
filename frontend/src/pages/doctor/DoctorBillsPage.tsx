import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBilling } from '../../hooks';
import { ErrorState, EmptyState } from '../../components/common';

export function DoctorBillsPage() {
  const { bills, patients, loading, error, refetch } = useBilling();

  const patientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of patients) {
      m.set(String(p.id), p.name || 'Patient');
    }
    return m;
  }, [patients]);

  if (error) {
    return (
      <ErrorState title="Could not load bills" description="" error={error} onRetry={refetch} />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
        <p className="text-sm text-muted-foreground mt-1">Billing for your patients and visits.</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && bills.length === 0 && (
        <EmptyState title="No bills" description="Bills tied to your appointments appear here." />
      )}

      {!loading && bills.length > 0 && (
        <div className="space-y-3">
          {bills.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{patientNameById.get(String(b.patient_id)) || 'Patient'}</p>
                  {b.description && <p className="text-xs text-muted-foreground truncate max-w-md">{b.description}</p>}
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {b.currency} {Number(b.amount).toFixed(2)}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">{b.status}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
