import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { doctorsApi, tenantsApi, usersApi } from '../services';
import type { Doctor, Tenant } from '../types';
import { getActiveTenantId, setActiveTenantId } from '../utils/tenantIdForRequest';
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';

type OrgType = 'clinic' | 'hospital';
type AddAdminTab = 'create' | 'promote';

export function AdminTenantsPage() {
  const { refreshUser } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(() => getActiveTenantId());

  const [modalOpen, setModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<OrgType>('clinic');
  const [creating, setCreating] = useState(false);

  const [addAdminTenant, setAddAdminTenant] = useState<Tenant | null>(null);
  const [addAdminName, setAddAdminName] = useState('');
  const [addAdminEmail, setAddAdminEmail] = useState('');
  const [addAdminPassword, setAddAdminPassword] = useState('');
  const [addAdminSubmitting, setAddAdminSubmitting] = useState(false);
  const [addAdminTab, setAddAdminTab] = useState<AddAdminTab>('create');
  const [promoteDoctors, setPromoteDoctors] = useState<Doctor[]>([]);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const addAdminRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(modalRef, modalOpen);
  useModalFocusTrap(addAdminRef, Boolean(addAdminTenant));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await tenantsApi.getAll();
      setTenants(list);
    } catch {
      toast.error('Could not load tenants');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetchTenants = useCallback(async () => {
    try {
      const list = await tenantsApi.getAll();
      setTenants(list);
    } catch {
      toast.error('Could not refresh organizations');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setCreateName('');
    setCreateType('clinic');
    setModalOpen(true);
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    setCreating(true);
    try {
      const created = await tenantsApi.create({ name, type: createType });
      setModalOpen(false);
      toast.success(`Created ${created.name}`);
      await load();
      setActiveTenantId(created.id);
      setActiveId(created.id);
      window.location.assign('/admin/dashboard');
    } catch {
      // toasts handled by api interceptor where applicable
    } finally {
      setCreating(false);
    }
  };

  const switchTo = (tenant: Tenant) => {
    setActiveTenantId(tenant.id);
    setActiveId(tenant.id);
    toast.success(`Active organization: ${tenant.name}`);
    window.location.assign('/admin/dashboard');
  };

  const openAddAdmin = (tenant: Tenant) => {
    setAddAdminTenant(tenant);
    setAddAdminTab('create');
    setAddAdminName('');
    setAddAdminEmail('');
    setAddAdminPassword('');
    setPromoteDoctors([]);
    setPromoteError(null);
  };

  const loadDoctorsForPromote = useCallback(
    async (tenant: Tenant) => {
      setPromoteLoading(true);
      setPromoteError(null);
      try {
        const list = await doctorsApi.getAll(
          { skip: 0, limit: 50 },
          { tenantScopeId: tenant.id }
        );
        setPromoteDoctors(list);
      } catch {
        setPromoteError('Could not load doctors for this organization.');
        setPromoteDoctors([]);
      } finally {
        setPromoteLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!addAdminTenant || addAdminTab !== 'promote') return;
    void loadDoctorsForPromote(addAdminTenant);
  }, [addAdminTenant, addAdminTab, loadDoctorsForPromote]);

  const submitAddAdmin = async () => {
    if (!addAdminTenant) return;
    const email = addAdminEmail.trim().toLowerCase();
    if (!email) {
      toast.error('Email is required');
      return;
    }
    if (addAdminPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setAddAdminSubmitting(true);
    try {
      await usersApi.createOrganizationUser({
        name: addAdminName.trim() || undefined,
        email,
        password: addAdminPassword,
        role: 'admin',
        tenant_id: addAdminTenant.id,
      });
      toast.success(`Admin invited for ${addAdminTenant.name}`);
      setAddAdminTenant(null);
    } catch {
      toast.error('Could not create admin');
    } finally {
      setAddAdminSubmitting(false);
    }
  };

  const promoteDoctorToAdmin = async (d: Doctor) => {
    if (!addAdminTenant) return;
    const hasLogin = d.user_id != null && String(d.user_id).length > 0;
    if (!hasLogin) {
      toast.error('This doctor has no login account to promote.');
      return;
    }
    const doctorId = String(d.id);
    setPromotingUserId(String(d.user_id));
    try {
      await doctorsApi.promoteDoctor(doctorId, { tenantScopeId: addAdminTenant.id });
      toast.success(`${d.name != null && String(d.name).trim() !== '' ? String(d.name) : 'Doctor'} is now an admin.`);
      await Promise.all([
        refetchTenants(),
        loadDoctorsForPromote(addAdminTenant),
        refreshUser(),
      ]);
    } catch (e: unknown) {
      // Network / cold start: not toasted by the axios success path; API errors are toasted in `api` interceptor
      if (e && typeof e === 'object' && (e as { __networkError?: boolean }).__networkError) {
        const msg = (e as { message?: string }).message;
        toast.error(typeof msg === 'string' && msg ? msg : 'Could not complete request. Try again.');
      }
    } finally {
      setPromotingUserId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Organizations</h1>
            <p className="text-sm text-muted-foreground">
              Create hospitals and clinics, then choose which one to manage.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Create clinic
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All tenants</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No tenants yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => {
                  const isActive = activeId === t.id;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {t.name}
                          {isActive && (
                            <Badge variant="secondary" className="text-xs">
                              Active
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{t.type}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openAddAdmin(t)}
                          >
                            Add admin
                          </Button>
                          <Button
                            type="button"
                            variant={isActive ? 'secondary' : 'outline'}
                            size="sm"
                            disabled={isActive}
                            onClick={() => switchTo(t)}
                          >
                            {isActive ? 'Selected' : 'Switch here'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {addAdminTenant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !addAdminSubmitting &&
              !promotingUserId
            ) {
              setAddAdminTenant(null);
            }
          }}
        >
          <div
            ref={addAdminRef}
            className={cn(
              'w-full max-w-md rounded-xl border border-border bg-background shadow-lg',
              'p-6 space-y-4'
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-admin-title"
          >
            <h2 id="add-admin-title" className="text-lg font-semibold">
              Add admin — {addAdminTenant.name}
            </h2>
            <div
              className="flex gap-1 rounded-lg border border-border p-0.5 bg-muted/50"
              role="tablist"
              aria-label="Admin setup method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={addAdminTab === 'create'}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  addAdminTab === 'create'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setAddAdminTab('create')}
              >
                Create new admin
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={addAdminTab === 'promote'}
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  addAdminTab === 'promote'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setAddAdminTab('promote')}
              >
                Promote doctor
              </button>
            </div>

            {addAdminTab === 'create' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="add-admin-name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="add-admin-name"
                    value={addAdminName}
                    onChange={(e) => setAddAdminName(e.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="add-admin-email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="add-admin-email"
                    type="email"
                    value={addAdminEmail}
                    onChange={(e) => setAddAdminEmail(e.target.value)}
                    placeholder="admin@clinic.example"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="add-admin-password" className="text-sm font-medium">
                    Password
                  </label>
                  <Input
                    id="add-admin-password"
                    type="password"
                    value={addAdminPassword}
                    onChange={(e) => setAddAdminPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Role: admin (fixed)</p>
              </>
            )}

            {addAdminTab === 'promote' && (
              <div className="space-y-2 max-h-[min(50vh,320px)] overflow-y-auto pr-1">
                <p className="text-sm text-muted-foreground">
                  Doctors in this organization with a login can be made administrators.
                </p>
                {promoteLoading && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading doctors…</p>
                )}
                {promoteError && (
                  <p className="text-sm text-destructive py-2">{promoteError}</p>
                )}
                {!promoteLoading && !promoteError && promoteDoctors.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No doctors found.</p>
                )}
                {!promoteLoading &&
                  promoteDoctors.map((d) => {
                    const hasLogin = d.user_id != null && String(d.user_id).length > 0;
                    const busy = promotingUserId != null;
                    const isOrgAdmin = d.linked_user_role === 'admin';
                    return (
                      <div
                        key={String(d.id)}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm">{d.name ?? '—'}</p>
                            {isOrgAdmin && (
                              <Badge variant="secondary" className="text-xs">
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {d.specialization ?? d.specialty ?? '—'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!hasLogin || busy || isOrgAdmin}
                          onClick={() => void promoteDoctorToAdmin(d)}
                        >
                          {promotingUserId === String(d.user_id)
                            ? 'Working…'
                            : isOrgAdmin
                              ? 'Current admin'
                              : 'Make admin'}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={addAdminSubmitting || Boolean(promotingUserId)}
                onClick={() => setAddAdminTenant(null)}
              >
                Cancel
              </Button>
              {addAdminTab === 'create' && (
                <Button
                  type="button"
                  onClick={() => void submitAddAdmin()}
                  disabled={addAdminSubmitting}
                >
                  {addAdminSubmitting ? 'Creating…' : 'Create admin'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className={cn(
              'w-full max-w-md rounded-xl border border-border bg-background shadow-lg',
              'p-6 space-y-4'
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tenant-create-title"
          >
            <h2 id="tenant-create-title" className="text-lg font-semibold">
              New organization
            </h2>
            <div className="space-y-2">
              <label htmlFor="tenant-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="tenant-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Apollo Clinic Pune"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="tenant-type" className="text-sm font-medium">
                Type
              </label>
              <select
                id="tenant-type"
                value={createType}
                onChange={(e) => setCreateType(e.target.value as OrgType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="clinic">Clinic</option>
                <option value="hospital">Hospital</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submitCreate()} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
