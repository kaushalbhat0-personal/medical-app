import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { appointmentsApi, billingApi } from '../../services';
import { ErrorState } from '../../components/common';
import { DISPLAY_TIMEZONE } from '../../constants/time';
import { formatAppointmentDateTimeWithZoneLabel } from '../../utils/doctorSchedule';
import type { Appointment, Bill } from '../../types';

function statusVariant(
  s: Appointment['status']
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (s === 'completed') return 'secondary';
  if (s === 'cancelled') return 'destructive';
  if (s === 'scheduled' || s === 'pending') return 'default';
  return 'outline';
}

export function DoctorAppointmentDetailPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [linkedBill, setLinkedBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!appointmentId) {
      setError('Missing appointment');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const a = await appointmentsApi.getById(appointmentId);
        if (cancelled) return;
        setAppointment(a);
        if (a.id) {
          const forAppt = await billingApi.getAll({ appointment_id: String(a.id), limit: 5 });
          if (!cancelled && forAppt.length > 0) {
            setLinkedBill(forAppt[0] ?? null);
          } else {
            setLinkedBill(null);
          }
        }
      } catch {
        if (!cancelled) setError('Could not load this visit.');
        setAppointment(null);
        setLinkedBill(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, retryKey]);

  if (error && !loading) {
    return (
      <div className="space-y-4">
        <BackBar />
        <ErrorState
          title="Visit not found"
          description="It may have been removed or you may not have access."
          error={error}
          onRetry={() => setRetryKey((k) => k + 1)}
        />
      </div>
    );
  }

  if (loading || !appointment) {
    return (
      <div className="space-y-4">
        <BackBar />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const pid = appointment.patient_id != null ? String(appointment.patient_id) : '';

  return (
    <div className="space-y-6" id={appointmentId ? `appt-${appointmentId}` : undefined}>
      <BackBar />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visit</h1>
        <p className="text-sm text-muted-foreground mt-1">Appointment details</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
              {formatAppointmentDateTimeWithZoneLabel(
                appointment.appointment_time || appointment.scheduled_at || '',
                DISPLAY_TIMEZONE
              )}
            </CardTitle>
            <Badge variant={statusVariant(appointment.status)} className="capitalize">
              {appointment.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          {pid && (
            <p>
              <span className="text-muted-foreground">Patient: </span>
              <Link to={`/doctor/patients/${pid}`} className="text-primary font-medium hover:underline">
                Open patient
              </Link>
            </p>
          )}
          {linkedBill && (
            <p>
              <span className="text-muted-foreground">Bill: </span>
              <Link
                to={`/doctor/bills/${linkedBill.id}`}
                className="text-primary font-medium hover:underline"
              >
                {linkedBill.currency} {Number(linkedBill.amount).toFixed(2)} ({linkedBill.status})
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BackBar() {
  return (
    <div>
      <Link
        to="/doctor/appointments"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2 gap-1.5 h-8 text-muted-foreground')}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Appointments
      </Link>
    </div>
  );
}
