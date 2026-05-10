import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentSummary, setTreatmentSummary] = useState('');
  const [usageRows, setUsageRows] = useState<UsageRow[]>([]);
  const [generateBill, setGenerateBill] = useState(false);
  const [consultationFeeInput, setConsultationFeeInput] = useState('');
  const [invItems, setInvItems] = useState<InventoryItemWithStockDTO[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const completionIdempotencyRef = useRef('');
  const inventoryLoadErrorToastShown = useRef(false);

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
      .listAllWithStock({ active_only: true })
      .then((rows) => {
        if (!cancelled) {
          inventoryLoadErrorToastShown.current = false;
          setInvItems(rows);
          setTenantInventoryCache(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInvItems([]);
          if (!inventoryLoadErrorToastShown.current) {
            toast.error('Could not load clinic inventory');
            inventoryLoadErrorToastShown.current = true;
          }
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

  const sellingById = useMemo(
    () => Object.fromEntries(invItems.map((i) => [i.id, i.selling_price])),
    [invItems]
  );

  const quickAddSuggestions = useMemo(() => invItems.slice(0, 3), [invItems]);

  const openCompleteModal = () => {
    completionIdempotencyRef.current =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setClinicalNotes('');
    setDiagnosis('');
    setTreatmentSummary('');
    setUsageRows([{ key: crypto.randomUUID(), item_id: '', quantity: '1' }]);
    setGenerateBill(false);
    setConsultationFeeInput('');
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

  const medicinesSellingPreview = useMemo(() => {
    if (validUsagePayload === null) return null;
    let sum = 0;
    for (const line of validUsagePayload) {
      const p = sellingById[line.item_id];
      if (p == null) return null;
      sum += p * line.quantity;
    }
    return sum;
  }, [validUsagePayload, sellingById]);

  const rawConsultation = consultationFeeInput.trim();
  const consultationFeeNumber =
    rawConsultation === '' ? 0 : parseFloat(rawConsultation.replace(/,/g, ''));
  const consultationFeeValid =
    Number.isFinite(consultationFeeNumber) && consultationFeeNumber >= 0;

  const billWouldBePositive =
    (medicinesSellingPreview ?? 0) + (consultationFeeValid ? consultationFeeNumber : 0) > 0;

  const canSubmitComplete =
    validUsagePayload !== null &&
    (!generateBill ? true : consultationFeeValid && billWouldBePositive);

  const appointmentTime = appointment?.appointment_time
    ? new Date(appointment.appointment_time)
    : null;
  const completionCutoff = appointmentTime
    ? new Date(appointmentTime.getTime() - 15 * 60 * 1000)
    : null;
  const isTooEarlyToComplete =
    completionCutoff !== null && Date.now() < completionCutoff.getTime();

  const canMarkComplete =
    isIndependent && !isReadOnly && appointment?.status === 'scheduled';
  const canMarkCompleteButton = canMarkComplete && !isTooEarlyToComplete;

  const submitCompleteDisabled =
    markBusy || !canMarkCompleteButton || !canSubmitComplete;

  const addQuickMedicineRow = useCallback((itemId: string) => {
    setUsageRows((prev) => [...prev, { key: crypto.randomUUID(), item_id: itemId, quantity: '1' }]);
  }, []);

  const submitComplete = async () => {
    if (!appointmentId) return;
    if (!canSubmitComplete) {
      toast.error(
        generateBill
          ? 'Bill needs a consultation fee or at least one medicine line with a sale price.'
          : 'Fix item rows and quantities (must not exceed clinic stock).'
      );
      return;
    }
    setMarkBusy(true);
    try {
      const fee = generateBill && consultationFeeValid ? consultationFeeNumber : undefined;
      const { appointment: updated } = await appointmentsApi.markCompleted(
        appointmentId,
        {
          // Note: completion_notes is deprecated - use clinical_notes for visit documentation
          clinical_notes: clinicalNotes.trim() || null,
          diagnosis: diagnosis.trim() || null,
          treatment_summary: treatmentSummary.trim() || null,
          items: validUsagePayload ?? [],
          generate_bill: generateBill,
          bill_consultation_amount: fee,
        },
        { idempotencyKey: completionIdempotencyRef.current }
      );
      setAppointment(updated);
      invalidateTenantInventoryCache();
      setCompleteOpen(false);
      toast.success(generateBill ? 'Visit completed and bill created' : 'Visit marked complete');
      const forAppt = await billingApi.getAll({ appointment_id: String(updated.id), limit: 5 });
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

  const completeButtonLabel = markBusy
    ? 'Saving…'
    : generateBill
      ? 'Complete & generate bill'
      : 'Complete visit';

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
          {/*
            Clinical encounter documentation hierarchy:
            1. Diagnosis (most important clinical output)
            2. Treatment summary (what was done)
            3. Clinical notes (detailed observations)
            Billing information is shown secondary.
          */}
          {appointment.diagnosis && (
            <p className="text-muted-foreground border-t border-border pt-2 mt-2">
              <span className="font-medium text-foreground">Diagnosis: </span>
              {appointment.diagnosis}
            </p>
          )}
          {appointment.treatment_summary && (
            <p className="text-muted-foreground border-t border-border pt-2 mt-2">
              <span className="font-medium text-foreground">Treatment: </span>
              {appointment.treatment_summary}
            </p>
          )}
          {appointment.clinical_notes && (
            <p className="text-muted-foreground border-t border-border pt-2 mt-2">
              <span className="font-medium text-foreground">Clinical notes: </span>
              {appointment.clinical_notes}
            </p>
          )}
          {/* DEPRECATED: completion_notes preserved for backward compatibility */}
          {appointment.completion_notes && (
            <p className="text-muted-foreground border-t border-border pt-2 mt-2">
              <span className="font-medium text-foreground">Notes (legacy): </span>
              {appointment.completion_notes}
            </p>
          )}
          {appointment.status === 'completed' &&
            appointment.inventory_usages &&
            appointment.inventory_usages.length > 0 && (
              <div className="border-t border-border pt-2 mt-2 space-y-1.5">
                <p className="font-medium text-foreground text-sm">Medicines given</p>
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
                      Total medicines (selling):{' '}
                      <span className="font-medium text-foreground tabular-nums">
                        ₹{Number(appointment.inventory_materials_selling_total).toFixed(2)}
                      </span>
                    </p>
                  )}
              </div>
            )}
          {canMarkComplete && (
            <div className="pt-2">
              <Button
                type="button"
                size="sm"
                disabled={markBusy || isTooEarlyToComplete}
                onClick={openCompleteModal}
              >
                Mark as completed
              </Button>
              {isTooEarlyToComplete && (
                <p className="text-sm text-muted-foreground mt-2">
                  Can be completed near scheduled appointment time.
                </p>
              )}
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
              {/*
                Clinical documentation fields for visit completion.
                Note: The deprecated 'completion_notes' field has been removed from this modal.
                Use the fields below for clinical encounter documentation.
                TODO: Future extension - add prescriptions, vitals, SOAP notes, attachments.
              */}
              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="diagnosis">
                  Diagnosis
                </label>
                <textarea
                  id="diagnosis"
                  className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Primary diagnosis and differential diagnoses..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="clinical-notes">
                  Clinical Notes
                </label>
                <textarea
                  id="clinical-notes"
                  className="mt-1 flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Detailed clinical observations, symptoms, examination findings..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="treatment-summary">
                  Treatment Summary
                </label>
                <textarea
                  id="treatment-summary"
                  className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Treatment provided, medications prescribed, follow-up plan..."
                  value={treatmentSummary}
                  onChange={(e) => setTreatmentSummary(e.target.value)}
                />
              </div>

              {/*
                Inventory usage section - medicines given during the visit.
                TODO: Future extension - integrate with formal prescription module.
              */}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Give medicines (optional)
                </p>
                {quickAddSuggestions.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-muted-foreground">Quick add:</span>
                    {quickAddSuggestions.map((it) => (
                      <Button
                        key={it.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs rounded-full border-dashed"
                        disabled={invLoading || markBusy}
                        onClick={() => addQuickMedicineRow(it.id)}
                      >
                        {it.name}
                      </Button>
                    ))}
                  </div>
                )}
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
                  Add medicine
                </Button>
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateBill}
                  disabled={markBusy}
                  className="mt-1 h-4 w-4 shrink-0"
                  onChange={(e) => setGenerateBill(e.target.checked)}
                />
                <span className="text-sm">
                  <span className="font-medium">Generate bill</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Includes medicines from this completion; inventory is deducted here, not when billing separately.
                  </span>
                </span>
              </label>

              {generateBill && (
                <div>
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor="consultation-fee"
                  >
                    Consultation fee (optional, ₹)
                  </label>
                  <Input
                    id="consultation-fee"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    className={cn(
                      'mt-1',
                      generateBill &&
                        consultationFeeValid &&
                        !rawConsultation &&
                        (medicinesSellingPreview ?? 0) <= 0 &&
                        'border-destructive/60'
                    )}
                    disabled={markBusy}
                    value={consultationFeeInput}
                    onChange={(e) => setConsultationFeeInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Bill total preview: ₹
                    {(
                      (Number.isFinite(consultationFeeNumber) ? consultationFeeNumber : 0) +
                      (medicinesSellingPreview ?? 0)
                    ).toFixed(2)}
                  </p>
                  {generateBill && !consultationFeeValid && (
                    <p className="text-xs text-destructive mt-1">Enter a valid non-negative fee.</p>
                  )}
                  {generateBill &&
                    consultationFeeValid &&
                    (medicinesSellingPreview ?? 0) <= 0 &&
                    consultationFeeNumber <= 0 && (
                      <p className="text-xs text-destructive mt-1">
                        Add medicines or enter a consultation fee so the bill amount is greater than zero.
                      </p>
                    )}
                </div>
              )}

              <Button
                type="button"
                className="w-full"
                disabled={submitCompleteDisabled}
                onClick={() => void submitComplete()}
              >
                {completeButtonLabel}
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
