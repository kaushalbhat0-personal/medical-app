import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAppointments } from '../../hooks';
import { useDoctorWorkspace } from '../../contexts/DoctorWorkspaceContext';
import { ErrorState, EmptyState } from '../../components/common';
import { DayCalendar } from '../../components/doctor/calendar/DayCalendar';
import type { Appointment } from '../../types';

type Tab = 'upcoming' | 'past';

function appointmentTime(a: Appointment): number {
  const t = a.appointment_time || a.scheduled_at;
  return t ? new Date(t).getTime() : 0;
}

export function DoctorAppointmentsPage() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { appointments, patients, loading, error, refetch } = useAppointments();
  const { isIndependent, selfDoctor, isReadOnly } = useDoctorWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const calendarRef = useRef<HTMLDivElement>(null);
  const scheduleFocusRef = useRef(false);

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

  const clearScheduleState = useCallback(() => {
    if (location.state && typeof location.state === 'object' && 'openSchedule' in location.state) {
      navigate(
        { pathname: location.pathname, search: location.search, hash: location.hash },
        { replace: true, state: {} }
      );
    }
  }, [location.hash, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const st = location.state as { openSchedule?: boolean } | null;
    if (st?.openSchedule && isIndependent && !scheduleFocusRef.current) {
      scheduleFocusRef.current = true;
      const id = window.setTimeout(() => {
        calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      clearScheduleState();
      return () => clearTimeout(id);
    }
  }, [location.state, isIndependent, clearScheduleState]);

  const scrollToCalendar = () => {
    calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (error) {
    return <ErrorState title="Could not load appointments" description="" error={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isReadOnly
              ? 'Upcoming and past visits assigned to you (read only).'
              : 'Your calendar and visit list. Times follow your profile timezone.'}
          </p>
        </div>
        {isIndependent && selfDoctor && selfDoctor.has_availability_windows !== false && (
          <Button type="button" size="sm" variant="secondary" onClick={scrollToCalendar}>
            Jump to schedule
          </Button>
        )}
      </div>

      {isIndependent && selfDoctor?.has_availability_windows === false && (
        <p className="text-sm text-muted-foreground rounded-lg border border-border px-3 py-2">
          Set your weekly availability in <strong>Availability</strong> before booking from the calendar.
        </p>
      )}

      {selfDoctor && selfDoctor.has_availability_windows !== false && (
        <div ref={calendarRef}>
          <Card>
            <CardHeader>
              <CardTitle>Day schedule</CardTitle>
              <CardDescription>
                {isIndependent
                  ? 'Click a green slot to book. Booked, past, and busy blocks are not selectable.'
                  : 'Published slot times in your organization (read only).'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DayCalendar
                doctorId={String(selfDoctor.id)}
                isInteractive={isIndependent}
                patients={patients}
                hasAvailabilityWindows={selfDoctor.has_availability_windows}
                doctorTimeZone={selfDoctor.timezone || 'UTC'}
                onBooked={() => void refetch()}
              />
            </CardContent>
          </Card>
        </div>
      )}

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
        <Button type="button" variant={tab === 'past' ? 'default' : 'outline'} size="sm" onClick={() => setTab('past')}>
          Past
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && list.length === 0 && (
        <EmptyState
          title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
          description="Your list will show here; book from the schedule above when slots are open."
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
