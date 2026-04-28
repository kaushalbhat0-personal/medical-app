import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { ArrowLeft, Calendar, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { appointmentsApi, billingApi, inventoryApi } from '../../services';
import { ErrorState } from '../../components/common';
import { DISPLAY_TIMEZONE } from '../../constants/time';
import { formatAppointmentDateTimeWithZoneLabel } from '../../utils/doctorSchedule';
import {
  getTenantInventoryCache,
  invalidateTenantInventoryCache,
  setTenantInventoryCache,
} from '../../utils/tenantInventoryCache';
import { useDoctorWorkspace } from '../../contexts/DoctorWorkspaceContext';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import type { Appointment, Bill } from '../../types';
import type { InventoryItemWithStockDTO } from '../../services/inventory';

function statusVariant(
  s: Appointment['status']
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (s === 'completed') return 'secondary';
  if (s === 'cancelled') return 'destructive';
  if (s === 'scheduled' || s === 'pending') return 'default';
  return 'outline';
}

type UsageRow = { key: string; item_id: string; quantity: string };

export function DoctorAppointmentDetailPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { isIndependent, isReadOnly } = useDoctorWorkspace();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [linkedBill, setLinkedBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [markBusy, setMarkBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [usageRows, setUsageRows] = useState<UsageRow[]>([]);
  const [invItems, setInvItems] = useState<InventoryItemWithStockDTO[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const completionIdempotencyRef = useRef('');

  useModalFocusTrap(modalRef, completeOpen);

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

  const canMarkComplete =
    isIndependent && !isReadOnly && appointment?.status === 'scheduled';

  useEffect(() => {
    if (!canMarkComplete || !appointment) return;
    const cached = getTenantInventoryCache();
    if (cached && cached.length > 0) {
      setInvItems(cached);
      setInvLoading(false);
      return;
    }
    let cancelled = false;
    setInvLoading(true);
    void inventoryApi
      .listWithStock({ active_only: true, limit: 300 })
      .then((rows) => {
        if (!cancelled) {
          setInvItems(rows);
          setTenantInventoryCache(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInvItems([]);
          toast.error('Could not load clinic inventory');
        }
      })
      .finally(() => {
        if (!cancelled) setInvLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canMarkComplete, appointment?.id]);

  const stockById = useMemo(
    () => Object.fromEntries(invItems.map((i) => [i.id, i.quantity_available])),
    [invItems]
  );

  const openCompleteModal = () => {
    completionIdempotencyRef.current =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setCompletionNotes('');
    setUsageRows([{ key: crypto.randomUUID(), item_id: '', quantity: '1' }]);
    setCompleteOpen(true);
  };

  const validUsagePayload = useMemo(() => {
    const lines: { item_id: string; quantity: number }[] = [];
    for (const r of usageRows) {
      if (!r.item_id) continue;
      const q = parseInt(r.quantity, 10);
      if (Number.isNaN(q) || q < 1) return null;
      lines.push({ item_id: r.item_id, quantity: q });
    }
    const totals: Record<string, number> = {};
    for (const l of lines) {
      totals[l.item_id] = (totals[l.item_id] ?? 0) + l.quantity;
    }
    for (const [id, need] of Object.entries(totals)) {
      const have = stockById[id] ?? 0;
      if (need > have) return null;
    }
    return lines;
  }, [usageRows, stockById]);

  const submitComplete = async () => {
    if (!appointmentId) return;
    if (validUsagePayload === null) {
      toast.error('Fix item rows and quantities (must not exceed clinic stock).');
      return;
    }
    setMarkBusy(true);
    try {
      const a = await appointmentsApi.markCompleted(
        appointmentId,
        {
          completion_notes: completionNotes.trim() || null,
          items: validUsagePayload,
        },
        { idempotencyKey: completionIdempotencyRef.current }
      );
      setAppointment(a);
      invalidateTenantInventoryCache();
      setCompleteOpen(false);
      toast.success('Visit marked complete');
      const forAppt = await billingApi.getAll({ appointment_id: String(a.id), limit: 5 });
      setLinkedBill(forAppt.length > 0 ? forAppt[0] : null);
    } catch (e) {
      const msg =
        axios.isAxiosError(e) && e.response?.data && typeof e.response.data === 'object'
          ? String((e.response.data as { detail?: unknown }).detail ?? 'Could not mark complete')
          : 'Could not mark complete';
      toast.error(msg, { duration: 5000 });
    } finally {
      setMarkBusy(false);
    }
  };

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

  const canSubmitComplete = validUsagePayload !== null;

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
          {appointment.completion_notes && (
            <p className="text-muted-foreground border-t border-border pt-2 mt-2">
              <span className="font-medium text-foreground">Completion notes: </span>
              {appointment.completion_notes}
            </p>
          )}
          {appointment.status === 'completed' &&
            appointment.inventory_usages &&
            appointment.inventory_usages.length > 0 && (
              <div className="border-t border-border pt-2 mt-2 space-y-1.5">
                <p className="font-medium text-foreground text-sm">Items used</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {appointment.inventory_usages.map((u) => (
                    <li key={u.item_id}>
                      {u.item_name || 'Item'}{' '}
                      <span className="text-muted-foreground">× {u.quantity}</span>
                    </li>
                  ))}
                </ul>
                {appointment.inventory_materials_selling_total != null &&
                  Number(appointment.inventory_materials_selling_total) > 0 && (
                    <p className="text-sm text-muted-foreground pt-0.5">
                      Total materials:{' '}
                      <span className="font-medium text-foreground tabular-nums">
                        ₹{Number(appointment.inventory_materials_selling_total).toFixed(2)}
                      </span>
                    </p>
                  )}
              </div>
            )}
          {canMarkComplete && (
            <div className="pt-2">
              <Button type="button" size="sm" disabled={markBusy} onClick={openCompleteModal}>
                Mark as completed
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {completeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => !markBusy && setCompleteOpen(false)}
          />
          <div
            ref={modalRef}
            className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-lg p-4 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-visit-title"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <h2 id="complete-visit-title" className="font-semibold">
                Complete visit
              </h2>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="shrink-0 h-8 w-8"
                disabled={markBusy}
                onClick={() => setCompleteOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="visit-notes">
                  Notes
                </label>
                <textarea
                  id="visit-notes"
                  className="mt-1 flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Clinical notes, follow-up, etc."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Medicines / consumables used (clinic stock)
                </p>
                {invLoading ? (
                  <p className="text-sm text-muted-foreground">Loading inventory…</p>
                ) : (
                  <ul className="space-y-3">
                    {usageRows.map((row) => {
                      const sel = row.item_id ? invItems.find((i) => i.id === row.item_id) : undefined;
                      const qtyNum = parseInt(row.quantity, 10);
                      const avail =
                        sel?.quantity_available ?? (row.item_id ? stockById[row.item_id] : undefined);
                      const over =
                        Boolean(row.item_id) &&
                        avail !== undefined &&
                        !Number.isNaN(qtyNum) &&
                        qtyNum > avail;

                      return (
                        <li key={row.key} className="rounded-lg border border-border p-2 space-y-1.5">
                          <div className="flex gap-2 items-end flex-wrap">
                            <div className="flex-1 min-w-[140px]">
                              <label className="sr-only" htmlFor={`item-${row.key}`}>
                                Item
                              </label>
                              <select
                                id={`item-${row.key}`}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={row.item_id}
                                onChange={(e) =>
                                  setUsageRows((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key ? { ...r, item_id: e.target.value } : r
                                    )
                                  )
                                }
                              >
                                <option value="">Select item…</option>
                                {invItems.map((it) => (
                                  <option key={it.id} value={it.id}>
                                    {it.name} — Available {it.quantity_available} {it.unit}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="w-24">
                              <label className="sr-only" htmlFor={`qty-${row.key}`}>
                                Quantity
                              </label>
                              <Input
                                id={`qty-${row.key}`}
                                type="number"
                                min={1}
                                inputMode="numeric"
                                value={row.quantity}
                                className={cn(over && 'border-destructive ring-1 ring-destructive/25')}
                                onChange={(e) =>
                                  setUsageRows((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key ? { ...r, quantity: e.target.value } : r
                                    )
                                  )
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="shrink-0"
                              disabled={usageRows.length <= 1 || markBusy}
                              onClick={() =>
                                setUsageRows((prev) => prev.filter((r) => r.key !== row.key))
                              }
                              aria-label="Remove row"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {sel ? (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{sel.name}</span>
                              {' — Available: '}
                              <span className="tabular-nums">{avail ?? '—'}</span> {sel.unit}
                              {over && (
                                <span className="text-destructive font-medium ml-1">
                                  (qty exceeds stock)
                                </span>
                              )}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  disabled={invLoading || markBusy}
                  onClick={() =>
                    setUsageRows((prev) => [
                      ...prev,
                      { key: crypto.randomUUID(), item_id: '', quantity: '1' },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add line
                </Button>
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={markBusy || !canSubmitComplete || appointment?.status !== 'scheduled'}
                onClick={() => void submitComplete()}
              >
                {markBusy ? 'Saving…' : 'Submit & mark complete'}
              </Button>
            </div>
          </div>
        </div>
      )}
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
