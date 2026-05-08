/**
 * CompleteVisitModal - Modal for completing an encounter
 * 
 * Extracted from the legacy DoctorAppointmentDetailPage to maintain
 * idempotent completion functionality while supporting the new
 * Encounter Workspace architecture.
 * 
 * Preserved invariants:
 * - Idempotent completion (Idempotency-Key header)
 * - Stock validation before submission
 * - Bill generation with consultation fee
 * - Clinical documentation capture (diagnosis, notes, treatment)
 */

import { useState, useMemo, useCallback, forwardRef } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Appointment } from '../../../types';
import type { InventoryItemWithStockDTO } from '../../../services/inventory';

interface CompleteVisitModalProps {
  appointment: Appointment;
  inventoryItems: InventoryItemWithStockDTO[];
  inventoryLoading: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onComplete: (payload: {
    clinical_notes: string | null;
    diagnosis: string | null;
    treatment_summary: string | null;
    items: { item_id: string; quantity: number }[];
    generate_bill: boolean;
    bill_consultation_amount?: number;
  }) => void;
  idempotencyKey: string;
}

type UsageRow = { key: string; item_id: string; quantity: string };

export const CompleteVisitModal = forwardRef<HTMLDivElement, CompleteVisitModalProps>(
  function CompleteVisitModalInner({
    appointment,
    inventoryItems,
    inventoryLoading,
    isSubmitting,
    onClose,
    onComplete,
  }: CompleteVisitModalProps, ref) {
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentSummary, setTreatmentSummary] = useState('');
  const [usageRows, setUsageRows] = useState<UsageRow[]>([
    { key: crypto.randomUUID(), item_id: '', quantity: '1' },
  ]);
  const [generateBill, setGenerateBill] = useState(false);
  const [consultationFeeInput, setConsultationFeeInput] = useState('');
  
  const quickAddSuggestions = useMemo(
    () => inventoryItems.slice(0, 3),
    [inventoryItems]
  );
  
  const stockById = useMemo(
    () => Object.fromEntries(inventoryItems.map((i) => [i.id, i.quantity_available])),
    [inventoryItems]
  );
  
  const sellingById = useMemo(
    () => Object.fromEntries(inventoryItems.map((i) => [i.id, i.selling_price])),
    [inventoryItems]
  );
  
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
  
  const submitCompleteDisabled =
    isSubmitting || appointment?.status !== 'scheduled' || !canSubmitComplete;
  
  const completeButtonLabel = isSubmitting
    ? 'Saving…'
    : generateBill
      ? 'Complete & generate bill'
      : 'Complete encounter';
  
  const addQuickMedicineRow = useCallback((itemId: string) => {
    setUsageRows((prev) => [
      ...prev,
      { key: crypto.randomUUID(), item_id: itemId, quantity: '1' },
    ]);
  }, []);
  
  const handleSubmit = () => {
    if (!canSubmitComplete) return;
    
    const fee = generateBill && consultationFeeValid ? consultationFeeNumber : undefined;
    
    onComplete({
      clinical_notes: clinicalNotes.trim() || null,
      diagnosis: diagnosis.trim() || null,
      treatment_summary: treatmentSummary.trim() || null,
      items: validUsagePayload ?? [],
      generate_bill: generateBill,
      bill_consultation_amount: fee,
    });
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={() => !isSubmitting && onClose()}
      />
      <div
        className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-lg p-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-encounter-title"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 id="complete-encounter-title" className="font-semibold">
            Complete encounter
          </h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 h-8 w-8"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/*
            Clinical documentation fields for encounter completion.
            Note: The deprecated 'completion_notes' field has been removed.
            Use the fields below for clinical encounter documentation.
            
            TODO: Future Phase 2 extensions:
            - Add prescription capture
            - Add vital signs input
            - Add SOAP notes structured form
            - Add attachment upload
            - Add follow-up scheduling
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
                    disabled={inventoryLoading || isSubmitting}
                    onClick={() => addQuickMedicineRow(it.id)}
                  >
                    {it.name}
                  </Button>
                ))}
              </div>
            )}
            {inventoryLoading ? (
              <p className="text-sm text-muted-foreground">Loading inventory…</p>
            ) : (
              <ul className="space-y-3">
                {usageRows.map((row) => {
                  const sel = row.item_id
                    ? inventoryItems.find((i) => i.id === row.item_id)
                    : undefined;
                  const qtyNum = parseInt(row.quantity, 10);
                  const avail =
                    sel?.quantity_available ??
                    (row.item_id ? stockById[row.item_id] : undefined);
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
                            {inventoryItems.map((it) => (
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
                          disabled={usageRows.length <= 1 || isSubmitting}
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
              disabled={inventoryLoading || isSubmitting}
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
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 shrink-0"
              onChange={(e) => setGenerateBill(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">Generate bill</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Includes medicines from this completion; inventory is deducted here, not when
                billing separately.
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
                disabled={isSubmitting}
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
                    Add medicines or enter a consultation fee so the bill amount is greater than
                    zero.
                  </p>
                )}
            </div>
          )}

          <Button
            type="button"
            className="w-full"
            disabled={submitCompleteDisabled}
            onClick={handleSubmit}
          >
            {completeButtonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
});
