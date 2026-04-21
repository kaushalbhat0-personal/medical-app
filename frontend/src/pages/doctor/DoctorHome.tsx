import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppointments, usePatients } from '../../hooks';
import { ErrorState } from '../../components/common';
import type { Appointment } from '../../types';

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isAppointmentToday(a: Appointment, ref: Date): boolean {
  const t = a.appointment_time || a.scheduled_at;
  if (!t) return false;
  const dt = new Date(t);
  const day = startOfLocalDay(ref);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  return dt >= day && dt < next;
}

export function DoctorHome() {
  const { appointments, loading: aptLoading, error: aptError, refetch: refetchApt } = useAppointments();
  const { patients, loading: patLoading, error: patError, refetch: refetchPat } = usePatients();

  const loading = aptLoading || patLoading;
  const error = aptError || patError;

  const now = useMemo(() => new Date(), []);

  const todaysAppointments = useMemo(
    () => appointments.filter((a) => isAppointmentToday(a, now)),
    [appointments, now]
  );

  const upcoming = useMemo(() => {
    const t = now.getTime();
    return appointments.filter((a) => {
      const at = a.appointment_time || a.scheduled_at;
      return at && new Date(at).getTime() >= t && a.status === 'scheduled';
    }).length;
  }, [appointments, now]);

  if (error) {
    return (
      <ErrorState
        title="Could not load overview"
        description="Try again in a moment."
        error={error}
        onRetry={() => {
          void refetchApt();
          void refetchPat();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">A snapshot of your practice today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total patients</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{loading ? '—' : patients.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link to="/doctor/patients" className="text-sm text-primary hover:underline">
              View patients
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today&apos;s appointments</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{loading ? '—' : todaysAppointments.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link to="/doctor/appointments" className="text-sm text-primary hover:underline">
              View schedule
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Upcoming scheduled</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{loading ? '—' : upcoming}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">From now onward</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>Appointments on your calendar for today</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && todaysAppointments.length === 0 && (
            <p className="text-sm text-muted-foreground">No appointments scheduled for today.</p>
          )}
          {!loading &&
            todaysAppointments.map((a) => (
              <div
                key={String(a.id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {(a.appointment_time || a.scheduled_at || '').replace('T', ' ').slice(0, 16)}
                </span>
                <span className="text-muted-foreground capitalize">{a.status}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
