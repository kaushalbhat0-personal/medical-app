/**
 * Purchase Entry Modal — Create purchase orders with line items.
 *
 * Mobile-first form with supplier selection, invoice details, and line items.
 */

import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  listSuppliers,
  createPurchaseOrder,
  type Supplier,
  type PurchaseOrderItemCreate,
} from '../../services/procurement';
import { inventoryApi } from '../../services/inventory';


// ── Line Item Row ──────────────────────────────────────────────────────────

interface LineItemForm {
  inventory_item_id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  tax_percent: number;
  batch_number: string;
  expiry_date: string;
}

function emptyLineItem(): LineItemForm {
  return {
    inventory_item_id: '',
    item_name: '',
    quantity: 1,
    unit_cost: 0,
    tax_percent: 0,
    batch_number: '',
    expiry_date: '',
  };
}


// ── Props ──────────────────────────────────────────────────────────────────

interface PurchaseEntryModalProps {
  onClose: () => void;
  onSuccess: () => void;
}


// ── Component ──────────────────────────────────────────────────────────────

export default function PurchaseEntryModal({ onClose, onSuccess }: PurchaseEntryModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<{ id: string; name: string; unit: string }[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItemForm[]>([emptyLineItem()]);

  // Load metadata
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [supRes, items] = await Promise.all([
          listSuppliers({ active_only: true, limit: 200 }),
          inventoryApi.listAllItems({ active_only: true }),
        ]);
        if (cancelled) return;
        setSuppliers(supRes.suppliers);
        setInventoryItems(items.map((i: any) => ({ id: i.id, name: i.name, unit: i.unit })));
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load form data');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Line item helpers
  const updateLineItem = (index: number, field: keyof LineItemForm, value: any) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // Auto-fill item name when item selected
      if (field === 'inventory_item_id') {
        const item = inventoryItems.find((i) => i.id === value);
        if (item) next[index].item_name = item.name;
      }
      return next;
    });
  };

  const addLineItem = () => setLineItems((prev) => [...prev, emptyLineItem()]);
  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_cost, 0);
  const taxAmount = lineItems.reduce((sum, li) => {
    const lineTotal = li.quantity * li.unit_cost;
    return sum + lineTotal * (li.tax_percent / 100);
  }, 0);
  const totalAmount = subtotal + taxAmount - discountAmount;

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setError('Please select a supplier');
      return;
    }
    if (lineItems.some((li) => !li.inventory_item_id || li.quantity <= 0)) {
      setError('Each line item must have an item selected and quantity > 0');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const items: PurchaseOrderItemCreate[] = lineItems.map((li) => ({
        inventory_item_id: li.inventory_item_id,
        quantity: li.quantity,
        unit_cost: li.unit_cost,
        tax_percent: li.tax_percent,
        batch_number: li.batch_number || undefined,
        expiry_date: li.expiry_date || undefined,
        line_total: li.quantity * li.unit_cost,
      }));

      await createPurchaseOrder({
        supplier_id: supplierId,
        invoice_number: invoiceNumber || undefined,
        invoice_date: invoiceDate || undefined,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        payment_status: paymentStatus,
        payment_method: paymentMethod || undefined,
        notes: notes || undefined,
        items,
      });

      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  if (loadingMeta) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">New Purchase Entry</h2>
              <p className="text-sm text-muted-foreground">Record stock received from supplier</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Supplier & Invoice */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sup">Supplier *</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger id="sup">
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="inv">Invoice Number</Label>
                <Input
                  id="inv"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="idate">Invoice Date</Label>
                <Input
                  id="idate"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="ps">Payment Status</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger id="ps">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pm">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="pm">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-medium">Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {lineItems.map((li, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Item #{idx + 1}</span>
                      {lineItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(idx)}
                          className="h-6 w-6 p-0 text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="md:col-span-2">
                        <Label className="text-xs">Item</Label>
                        <Select
                          value={li.inventory_item_id}
                          onValueChange={(v) => updateLineItem(idx, 'inventory_item_id', v)}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select item..." />
                          </SelectTrigger>
                          <SelectContent>
                            {inventoryItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={li.quantity}
                          onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Unit Cost (₹)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={li.unit_cost}
                          onChange={(e) => updateLineItem(idx, 'unit_cost', Number(e.target.value))}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tax %</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={li.tax_percent}
                          onChange={(e) => updateLineItem(idx, 'tax_percent', Number(e.target.value))}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Batch #</Label>
                        <Input
                          value={li.batch_number}
                          onChange={(e) => updateLineItem(idx, 'batch_number', e.target.value)}
                          placeholder="Optional"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Expiry</Label>
                        <Input
                          type="date"
                          value={li.expiry_date}
                          onChange={(e) => updateLineItem(idx, 'expiry_date', e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div className="text-xs text-right text-muted-foreground">
                      Line total: ₹{(li.quantity * li.unit_cost).toFixed(2)}
                      {li.tax_percent > 0 && (
                        <span className="ml-2">
                          (Tax: ₹{(li.quantity * li.unit_cost * li.tax_percent / 100).toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="border rounded-lg p-4 space-y-1 text-sm bg-gray-50">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax Amount</span>
                <span>₹{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="h-7 w-20 text-xs text-right"
                  />
                </div>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t">
                <span>Total</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="nt">Notes</Label>
              <Input
                id="nt"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes for this purchase"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create Purchase Order'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
