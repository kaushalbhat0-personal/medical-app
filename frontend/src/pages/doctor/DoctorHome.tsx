import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppointments, usePatients } from '../../hooks';
import { useDoctorWorkspace } from '../../contexts/DoctorWorkspaceContext';
import { ErrorState } from '../../components/common';
import type { Appointment } from '../../types';
import { UserPlus, CalendarPlus, Receipt } from 'lucide-react';

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
  const navigate = useNavigate();
  const { isIndependent, selfDoctor } = useDoctorWorkspace();
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
        <p className="text-sm text-muted-foreground mt-1">
          {isIndependent
            ? 'A snapshot of your practice today — add care and billing as you go.'
            : 'A snapshot of patients and visits associated with you in this organization.'}
        </p>
      </div>

      {isIndependent && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => navigate('/doctor/patients', { state: { openAddPatient: true } })}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Add patient
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => navigate('/doctor/appointments', { state: { openSchedule: true } })}
            className="gap-2"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Schedule visit
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => navigate('/doctor/bills', { state: { openCreateBill: true } })}
            className="gap-2"
          >
            <Receipt className="h-4 w-4" aria-hidden />
            Create bill
          </Button>
        </div>
      )}

      {selfDoctor && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>
              {isIndependent
                ? 'Book visits from the full day calendar on Appointments. This page stays a quick overview.'
                : 'Your visit list and organization schedule live on Appointments.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/doctor/appointments"
              state={{ openSchedule: true }}
              className={cn(buttonVariants({ variant: 'secondary' }), 'inline-flex gap-2')}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Open schedule
            </Link>
          </CardContent>
        </Card>
      )}

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
