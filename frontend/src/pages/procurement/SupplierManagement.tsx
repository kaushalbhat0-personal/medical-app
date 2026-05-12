/**
 * Supplier Management — CRUD for suppliers/vendors.
 *
 * Mobile-first table with search, create, edit, and toggle active.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Edit3,
  UserCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '../../components/common';
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  type Supplier,
  type SupplierCreate,
  type SupplierUpdate,
} from '../../services/procurement';


// ── Supplier Form Modal ────────────────────────────────────────────────────

function SupplierFormModal({
  supplier,
  onClose,
  onSaved,
}: {
  supplier?: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SupplierCreate>({
    supplier_name: supplier?.supplier_name || '',
    contact_person: supplier?.contact_person || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
    gst_number: supplier?.gst_number || '',
    tax_id: supplier?.tax_id || '',
    notes: supplier?.notes || '',
    is_active: supplier?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (supplier) {
        await updateSupplier(supplier.id, form as SupplierUpdate);
      } else {
        await createSupplier(form);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof SupplierCreate, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {supplier ? 'Edit Supplier' : 'Add Supplier'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="sn">Supplier Name *</Label>
              <Input
                id="sn"
                required
                value={form.supplier_name}
                onChange={(e) => set('supplier_name', e.target.value)}
                placeholder="e.g. MedLife Distributors"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cp">Contact Person</Label>
                <Input
                  id="cp"
                  value={form.contact_person || ''}
                  onChange={(e) => set('contact_person', e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                />
              </div>
              <div>
                <Label htmlFor="ph">Phone</Label>
                <Input
                  id="ph"
                  value={form.phone || ''}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="e.g. +91-9876543210"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="em">Email</Label>
              <Input
                id="em"
                type="email"
                value={form.email || ''}
                onChange={(e) => set('email', e.target.value)}
                placeholder="e.g. contact@medlife.com"
              />
            </div>

            <div>
              <Label htmlFor="ad">Address</Label>
              <Input
                id="ad"
                value={form.address || ''}
                onChange={(e) => set('address', e.target.value)}
                placeholder="e.g. 123, Industrial Area, Mumbai"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gst">GST Number</Label>
                <Input
                  id="gst"
                  value={form.gst_number || ''}
                  onChange={(e) => set('gst_number', e.target.value)}
                  placeholder="e.g. 27AABCU9603R1ZX"
                />
              </div>
              <div>
                <Label htmlFor="ti">Tax ID</Label>
                <Input
                  id="ti"
                  value={form.tax_id || ''}
                  onChange={(e) => set('tax_id', e.target.value)}
                  placeholder="e.g. PAN / TAN"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="nt">Notes</Label>
              <Input
                id="nt"
                value={form.notes || ''}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Any additional notes"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.is_active ?? true}
                onChange={(e) => set('is_active', e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="active" className="text-sm">Active Supplier</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : supplier ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


// ── Main Component ─────────────────────────────────────────────────────────

export default function SupplierManagement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSuppliers({ search: search || undefined, limit: 100 });
      setSuppliers(res.suppliers);
      setTotal(res.total);
    } catch (err: any) {
      setError(err?.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleSaved = () => {
    setShowForm(false);
    setEditingSupplier(null);
    fetchSuppliers();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Supplier Management</h2>
          <p className="text-sm text-muted-foreground">{total} supplier{total !== 1 ? 's' : ''} registered</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-48"
            />
          </div>
          <Button size="sm" onClick={() => { setEditingSupplier(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Supplier
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Failed to load" description={error} onRetry={fetchSuppliers} />
      ) : suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers found"
          description={search ? 'Try a different search term.' : 'Add your first supplier to get started.'}
          action={search ? undefined : { label: 'Add Supplier', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <Card key={s.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{s.supplier_name}</span>
                      {s.is_active ? (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {s.contact_person && (
                        <span className="flex items-center gap-1">
                          <UserCheck className="h-3.5 w-3.5" /> {s.contact_person}
                        </span>
                      )}
                      {s.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" /> {s.phone}
                        </span>
                      )}
                      {s.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" /> {s.email}
                        </span>
                      )}
                      {s.gst_number && (
                        <span className="flex items-center gap-1 font-mono text-xs">
                          GST: {s.gst_number}
                        </span>
                      )}
                    </div>
                    {(s.address || s.notes) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {s.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {s.address}
                          </span>
                        )}
                        {s.notes && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" /> {s.notes}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditingSupplier(s); setShowForm(true); }}
                    className="shrink-0 ml-2"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <SupplierFormModal
          supplier={editingSupplier}
          onClose={() => { setShowForm(false); setEditingSupplier(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
