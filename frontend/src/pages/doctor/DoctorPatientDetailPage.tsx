import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Calendar, FileText, IndianRupee, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState } from '../../components/common';
import { useDoctorWorkspace } from '../../contexts/DoctorWorkspaceContext';
import {
  appointmentCalendarDayYmd,
  formatSlotTimeWithZoneLabel,
  relativeCalendarDayTitleInZone,
} from '../../utils/doctorSchedule';
import { appointmentsApi, billingApi, patientsApi } from '../../services';
import { Textarea } from '@/components/ui/textarea';
import type { Appointment, Bill, Patient } from '../../types';

type Section = 'activity' | 'bills' | 'info';

type TimelineItem =
  | {
      id: string;
      kind: 'appointment';
      at: number;
      dayKey: string;
      iso: string;
      appt: Appointment;
    }
  | {
      id: string;
      kind: 'bill';
      at: number;
      dayKey: string;
      iso: string;
      bill: Bill;
    };

function appointmentTime(a: Appointment): number {
  const t = a.appointment_time || a.scheduled_at;
  return t ? new Date(t).getTime() : 0;
}

function kindPriority(k: TimelineItem['kind']): number {
  return k === 'appointment' ? 0 : 1;
}

function formatRelativePast(iso: string | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const days = Math.floor(diff / 86_400_000);
  if (days < 0) return '—';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function apptCanAct(s: Appointment['status']): boolean {
  return s === 'scheduled' || s === 'pending';
}

function apptStatusVariant(
  s: Appointment['status']
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (s === 'completed') return 'secondary';
  if (s === 'cancelled') return 'destructive';
  if (s === 'scheduled' || s === 'pending') return 'default';
  return 'outline';
}

function billStatusLabel(status: Bill['status']): { label: string; className: string } {
  if (status === 'paid') {
    return {
      label: 'Paid',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
    };
  }
  if (status === 'pending' || status === 'failed') {
    return { label: 'Unpaid', className: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200' };
  }
  return { label: status, className: '' };
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden>
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-72 rounded-md bg-muted" />
      <div className="flex gap-2">
        <div className="h-9 w-32 rounded-md bg-muted" />
        <div className="h-9 w-20 rounded-md bg-muted" />
        <div className="h-9 w-24 rounded-md bg-muted" />
      </div>
      <div className="h-48 rounded-xl bg-muted" />
    </div>
  );
}

export function DoctorPatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isIndependent, isReadOnly, selfDoctor } = useDoctorWorkspace();
  const scheduleTz = (selfDoctor?.timezone || 'UTC').trim() || 'UTC';
  const [section, setSection] = useState<Section>('activity');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'forbidden' | 'notfound' | 'other' | null>(null);
  const [rowBusyKey, setRowBusyKey] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    setPatient(null);
    setAppointments([]);
    setBills([]);
    try {
      // Future: single GET /patients/{id}/summary could replace the parallel fetches below.
      const [p, apts, bls] = await Promise.all([
        patientsApi.getById(id),
        appointmentsApi.getAll({ patient_id: id, skip: 0, limit: 100 }),
        billingApi.getAll({ patient_id: id, skip: 0, limit: 100 }),
      ]);
      setPatient(p);
      setAppointments(apts);
      setBills(bls);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 403) {
        setLoadError('forbidden');
      } else if (axios.isAxiosError(e) && e.response?.status === 404) {
        setLoadError('notfound');
      } else {
        setLoadError('other');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setNotesDraft(patient?.clinical_notes ?? '');
  }, [patient?.id, patient?.clinical_notes]);

  const stats = useMemo(() => {
    const completed = appointments.filter((a) => a.status === 'completed');
    const visitTimes = completed
      .map((a) => a.appointment_time || a.scheduled_at)
      .filter(Boolean) as string[];
    const lastVisitIso =
      visitTimes.length > 0
        ? visitTimes.reduce((best, cur) => (new Date(cur) > new Date(best) ? cur : best), visitTimes[0])
        : null;
    const outstanding = bills
      .filter((b) => b.status === 'pending' || b.status === 'failed')
      .reduce((s, b) => s + Number(b.amount), 0);
    const cur = bills.find((b) => b.currency)?.currency || 'INR';
    return {
      totalVisits: completed.length,
      lastVisitLabel: lastVisitIso ? formatRelativePast(lastVisitIso) : '—',
      outstanding,
      outstandingCurrency: cur,
    };
  }, [appointments, bills]);

  const { timelineByDay, dayOrder } = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const a of appointments) {
      const raw = a.appointment_time || a.scheduled_at;
      const t = appointmentTime(a);
      if (!raw || !t) continue;
      const dayKey = appointmentCalendarDayYmd(raw, scheduleTz);
      if (!dayKey) continue;
      items.push({
        id: `a-${a.id}`,
        kind: 'appointment',
        at: t,
        dayKey,
        iso: raw,
        appt: a,
      });
    }
    for (const b of bills) {
      const ap = b.appointment_id ? appointments.find((x) => String(x.id) === String(b.appointment_id)) : undefined;
      const raw = ap
        ? ap.appointment_time || ap.scheduled_at
        : b.created_at || b.updated_at;
      const t = raw ? new Date(raw).getTime() : 0;
      if (!raw || !t) continue;
      const dayKey = appointmentCalendarDayYmd(raw, scheduleTz);
      if (!dayKey) continue;
      items.push({
        id: `b-${b.id}`,
        kind: 'bill',
        at: t,
        dayKey,
        iso: raw,
        bill: b,
      });
    }
    const byDay = new Map<string, TimelineItem[]>();
    for (const it of items) {
      if (!byDay.has(it.dayKey)) byDay.set(it.dayKey, []);
      byDay.get(it.dayKey)!.push(it);
    }
    for (const [, arr] of byDay) {
      arr.sort((x, y) => {
        if (y.at !== x.at) return y.at - x.at;
        return kindPriority(x.kind) - kindPriority(y.kind);
      });
    }
    const order = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a));
    return { timelineByDay: byDay, dayOrder: order };
  }, [appointments, bills, scheduleTz]);

  if (!id) {
    return <ErrorState title="Invalid link" description="This patient page address is not valid." />;
  }

  if (loadError === 'forbidden') {
    return (
      <ErrorState
        title="Access denied"
        description="You can only open patients you are linked to through an appointment, or that you created (independent practice). Ask your admin if you believe this is a mistake."
      />
    );
  }

  if (loadError === 'notfound' && !loading) {
    return (
      <ErrorState
        title="Patient not found"
        description="This ID does not match a record you can see, or it was removed."
        onRetry={() => void load()}
      />
    );
  }

  if (loadError === 'other' && !loading) {
    return (
      <ErrorState
        title="Could not load patient"
        description="We could not load this record. The network may have failed — try again."
        onRetry={() => void load()}
      />
    );
  }

  const contactLine = [patient?.phone, patient?.email].filter(Boolean).join(' · ');

  const goBook = () => {
    if (!id) return;
    navigate('/doctor/appointments', { state: { openSchedule: true, bookPatientId: id } });
  };

  const goCreateBill = () => {
    if (!id) return;
    navigate('/doctor/bills', { state: { openCreateBill: true, billPatientId: id } });
  };

  const canMutate = isIndependent && !isReadOnly;

  const markAppointmentCompleted = async (apptId: string) => {
    const key = `a-${apptId}`;
    setRowBusyKey(key);
    try {
      await appointmentsApi.update(apptId, { status: 'completed' });
      toast.success('Marked completed');
      await load();
    } catch (e) {
      const msg =
        axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object'
          ? String((e.response.data as { detail?: unknown }).detail ?? 'Could not update')
          : 'Could not update appointment';
      toast.error(msg);
    } finally {
      setRowBusyKey(null);
    }
  };

  const cancelAppointment = async (apptId: string) => {
    const key = `a-${apptId}`;
    setRowBusyKey(key);
    try {
      await appointmentsApi.update(apptId, { status: 'cancelled' });
      toast.success('Appointment cancelled');
      await load();
    } catch (e) {
      const msg =
        axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object'
          ? String((e.response.data as { detail?: unknown }).detail ?? 'Could not cancel')
          : 'Could not cancel appointment';
      toast.error(msg);
    } finally {
      setRowBusyKey(null);
    }
  };

  const markBillPaid = async (billId: string) => {
    const key = `b-${billId}`;
    setRowBusyKey(key);
    try {
      await billingApi.pay(billId);
      toast.success('Marked as paid');
      await load();
    } catch (e) {
      const msg =
        axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object'
          ? String((e.response.data as { detail?: unknown }).detail ?? 'Could not update bill')
          : 'Could not mark bill paid';
      toast.error(msg);
    } finally {
      setRowBusyKey(null);
    }
  };

  const saveClinicalNotes = async () => {
    if (!id || !patient) return;
    setNotesSaving(true);
    try {
      const updated = await patientsApi.update(id, { clinical_notes: notesDraft.trim() || null });
      setPatient(updated);
      toast.success('Notes saved');
    } catch (e) {
      const msg =
        axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object'
          ? String((e.response.data as { detail?: unknown }).detail ?? 'Could not save')
          : 'Could not save notes';
      toast.error(msg);
    } finally {
      setNotesSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        className={cn(
          'sticky z-30 -mx-4 px-4 py-3 border-b border-border',
          'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
          'top-14'
        )}
      >
        <Link
          to="/doctor/patients"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            '-ml-2 mb-1 gap-1.5 h-8 text-muted-foreground'
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Patients
        </Link>
        {loading && !patient ? (
          <PageSkeleton />
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight truncate">{patient?.name || 'Patient'}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {contactLine || 'No phone or email on file'}
                </p>
              </div>
              {isIndependent && !isReadOnly && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button type="button" size="sm" onClick={goBook}>
                    Book appointment
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={goCreateBill}>
                    Create bill
                  </Button>
                </div>
              )}
            </div>

            {!loading && patient && (
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Total visits</dt>
                  <dd className="font-semibold tabular-nums">{stats.totalVisits}</dd>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Last visit</dt>
                  <dd className="font-semibold">{stats.lastVisitLabel}</dd>
                </div>
                <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">Outstanding bills</dt>
                  <dd className="font-semibold tabular-nums">
                    {stats.outstanding > 0
                      ? `${stats.outstandingCurrency} ${stats.outstanding.toFixed(0)}`
                      : '—'}
                  </dd>
                </div>
              </dl>
            )}
          </>
        )}
      </div>

      {!loading && (
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          {(
            [
              { key: 'activity' as const, label: 'Activity', icon: Calendar },
              { key: 'bills' as const, label: 'Bills', icon: FileText },
              { key: 'info' as const, label: 'Basic info', icon: User },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={section === key ? 'default' : 'outline'}
              onClick={() => setSection(key)}
              className={cn('gap-1.5', section === key && 'shadow-sm')}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </Button>
          ))}
        </div>
      )}

      {!loading && section === 'activity' && (
        <div className="space-y-8">
          {patient && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Notes</CardTitle>
                <CardDescription>Quick context for the next visit (saved on this patient)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {canMutate ? (
                  <>
                    <Textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="e.g. Patient has had fever for 3 days; follow up on blood work…"
                      disabled={notesSaving}
                      className="min-h-[88px] resize-y"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveClinicalNotes()}
                        disabled={notesSaving || notesDraft === (patient.clinical_notes ?? '')}
                      >
                        {notesSaving ? 'Saving…' : 'Save notes'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap rounded-md border border-border/60 bg-muted/20 px-3 py-2 min-h-[4.5rem]">
                    {patient.clinical_notes?.trim() ? patient.clinical_notes : 'No notes on file.'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {dayOrder.length === 0 && (
            <EmptyState
              title="No appointments yet"
              description="When you schedule visits or add bills, they will appear on this timeline."
              action={
                isIndependent && !isReadOnly
                  ? { label: 'Book first appointment', onClick: goBook }
                  : undefined
              }
            />
          )}

          {dayOrder.length > 0 && (
            <div className="space-y-0">
              {dayOrder.map((dayKey, dayIdx) => {
                const list = timelineByDay.get(dayKey) ?? [];
                const sampleIso = list[0]?.iso;
                return (
                  <div
                    key={dayKey}
                    className={cn(
                      'pb-8',
                      dayIdx > 0 && 'border-t border-border/50 pt-8 mt-2'
                    )}
                  >
                    <h2 className="text-lg font-semibold tracking-tight text-foreground border-b border-border/60 pb-2 mb-4">
                      {sampleIso ? relativeCalendarDayTitleInZone(sampleIso, scheduleTz) : ''}
                    </h2>
                    <ul className="space-y-3">
                      {list.map((it) => {
                        if (it.kind === 'appointment') {
                          const a = it.appt;
                          const canCompleteOrCancel = canMutate && apptCanAct(a.status);
                          return (
                            <li
                              key={it.id}
                              className="flex gap-3 text-sm rounded-lg border border-border/60 bg-card/30 px-3 py-2.5"
                            >
                              <div
                                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                aria-hidden
                              >
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                  <p className="text-muted-foreground tabular-nums">
                                    <span className="font-medium text-foreground">
                                      {formatSlotTimeWithZoneLabel(
                                        a.appointment_time || a.scheduled_at || '',
                                        scheduleTz
                                      )}
                                    </span>
                                    <span className="mx-1.5 text-border">·</span>
                                    <span className="text-foreground">Appointment</span>{' '}
                                    <Badge
                                      variant={apptStatusVariant(a.status)}
                                      className="capitalize align-middle ml-0.5"
                                    >
                                      {a.status}
                                    </Badge>
                                  </p>
                                  <Link
                                    to={`/doctor/appointments#appt-${a.id}`}
                                    className="text-primary text-xs font-medium hover:underline shrink-0"
                                  >
                                    Open in schedule
                                  </Link>
                                </div>
                                {canCompleteOrCancel && (
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={rowBusyKey === it.id}
                                      onClick={() => void markAppointmentCompleted(String(a.id))}
                                    >
                                      {rowBusyKey === it.id ? '…' : 'Mark completed'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={rowBusyKey === it.id}
                                      onClick={() => void cancelAppointment(String(a.id))}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        }
                        const b = it.bill;
                        const st = billStatusLabel(b.status);
                        const canPay = canMutate && (b.status === 'pending' || b.status === 'failed');
                        return (
                          <li
                            key={it.id}
                            className="flex gap-3 text-sm rounded-lg border border-border/60 bg-card/30 px-3 py-2.5"
                          >
                            <div
                              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300"
                              aria-hidden
                            >
                              <IndianRupee className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <p className="text-muted-foreground tabular-nums">
                                  <span className="font-medium text-foreground">
                                    {formatSlotTimeWithZoneLabel(it.iso, scheduleTz)}
                                  </span>
                                  <span className="mx-1.5 text-border">·</span>
                                  <span className="text-foreground font-medium">
                                    {b.currency} {Number(b.amount).toFixed(0)}
                                  </span>
                                  <span className="text-muted-foreground"> — Bill</span>{' '}
                                  <Badge
                                    variant="outline"
                                    className={cn('capitalize align-middle text-[0.7rem] py-0', st.className)}
                                  >
                                    {st.label}
                                  </Badge>
                                </p>
                                {b.appointment_id && (
                                  <Link
                                    to={`/doctor/appointments#appt-${b.appointment_id}`}
                                    className="text-primary text-xs font-medium hover:underline shrink-0"
                                  >
                                    Visit
                                  </Link>
                                )}
                              </div>
                              {canPay && (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 text-xs"
                                    disabled={rowBusyKey === it.id}
                                    onClick={() => void markBillPaid(String(b.id))}
                                  >
                                    {rowBusyKey === it.id ? '…' : 'Mark as paid'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && section === 'bills' && (
        <div className="space-y-3">
          {bills.length === 0 && (
            <EmptyState
              title="No bills yet"
              description="Create a bill from a scheduled visit, or use Create bill to start from this patient."
              action={
                isIndependent && !isReadOnly
                  ? { label: 'Create bill', onClick: goCreateBill }
                  : undefined
              }
            />
          )}
          {bills.length > 0 &&
            bills.map((b) => {
              const st = billStatusLabel(b.status);
              const appt = b.appointment_id
                ? appointments.find((x) => String(x.id) === String(b.appointment_id))
                : undefined;
              const apptTime = appt
                ? formatSlotTimeWithZoneLabel(
                    appt.appointment_time || appt.scheduled_at || '',
                    scheduleTz
                  )
                : null;
              return (
                <Card key={String(b.id)}>
                  <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3 text-sm">
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium tabular-nums">
                        {b.currency} {Number(b.amount).toFixed(2)}
                      </p>
                      {b.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                      )}
                      {b.appointment_id && (
                        <p className="text-xs text-muted-foreground">
                          Visit:{' '}
                          <Link
                            to={
                              b.appointment_id
                                ? `/doctor/appointments#appt-${b.appointment_id}`
                                : '/doctor/appointments'
                            }
                            className="text-primary hover:underline"
                          >
                            {apptTime || 'View appointment'}
                          </Link>
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0', st.className)}
                    >
                      {st.label}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {!loading && section === 'info' && (
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Demographics and contact details on file</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-3 max-w-md">
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <span className="text-muted-foreground">Name</span>
              <span>{patient?.name || '—'}</span>
              <span className="text-muted-foreground">Age</span>
              <span>{patient?.age != null ? patient.age : '—'}</span>
              <span className="text-muted-foreground">Gender</span>
              <span>{patient?.gender || '—'}</span>
              <span className="text-muted-foreground">Phone</span>
              <span>{patient?.phone || '—'}</span>
              <span className="text-muted-foreground">Email</span>
              <span className="break-all">{patient?.email || '—'}</span>
            </div>
            {patient?.medical_history && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap text-foreground/90">{patient.medical_history}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
