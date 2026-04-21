import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppointments } from '../../hooks';
import { ErrorState, EmptyState } from '../../components/common';
import type { Appointment } from '../../types';

type Tab = 'upcoming' | 'past';

function appointmentTime(a: Appointment): number {
  const t = a.appointment_time || a.scheduled_at;
  return t ? new Date(t).getTime() : 0;
}

export function DoctorAppointmentsPage() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { appointments, loading, error, refetch } = useAppointments();

  const now = useMemo(() => Date.now(), []);

  const { upcoming, past } = useMemo(() => {
    const u: Appointment[] = [];
    const p: Appointment[] = [];
    for (const a of appointments) {
      const t = appointmentTime(a);
      if (t >= now && (a.status === 'scheduled' || a.status === 'pending')) {
        u.push(a);
      } else {
        p.push(a);
      }
    }
    u.sort((a, b) => appointmentTime(a) - appointmentTime(b));
    p.sort((a, b) => appointmentTime(b) - appointmentTime(a));
    return { upcoming: u, past: p };
  }, [appointments, now]);

  const list = tab === 'upcoming' ? upcoming : past;

  if (error) {
    return (
      <ErrorState title="Could not load appointments" description="" error={error} onRetry={refetch} />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
        <p className="text-sm text-muted-foreground mt-1">Upcoming and past visits.</p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={tab === 'upcoming' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('upcoming')}
          className={cn(tab === 'upcoming' && 'shadow-sm')}
        >
          Upcoming
        </Button>
        <Button
          type="button"
          variant={tab === 'past' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTab('past')}
        >
          Past
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && list.length === 0 && (
        <EmptyState
          title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
          description="Your schedule will show here."
        />
      )}

      {!loading &&
        list.map((a) => (
          <Card key={String(a.id)}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {(a.appointment_time || a.scheduled_at || '').replace('T', ' ').slice(0, 16)}
              </span>
              <span className="text-muted-foreground capitalize">{a.status}</span>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
