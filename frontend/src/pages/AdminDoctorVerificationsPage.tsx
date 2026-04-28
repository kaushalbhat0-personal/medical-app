import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Building2, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  doctorVerificationAdminApi,
  type DoctorProfileRead,
  type DoctorVerificationListScope,
  type DoctorVerificationQueueItem,
  type DoctorVerificationQueuePage,
} from '../services/doctorVerificationAdmin';
import { tenantsApi } from '../services/tenants';
import { getEffectiveRoles, canVerifyDoctorsInTenant, isSuperAdminRole } from '../utils/roles';
import { Button, ErrorState, Input } from '../components/common';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import type { Tenant } from '../types';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
] as const;

function listScope(isSuperAdmin: boolean, tenantFilter: string | null): DoctorVerificationListScope {
  if (!isSuperAdmin) return { mode: 'org' };
  if (tenantFilter) return { mode: 'super_tenant', tenantId: tenantFilter };
  return { mode: 'super_all_tenants' };
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-800',
    approved: 'bg-emerald-500/15 text-emerald-700',
    rejected: 'bg-red-500/15 text-red-800',
    draft: 'bg-muted text-muted-foreground',
  };
  const key = (status || 'draft').toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize',
        colors[key] ?? colors.draft
      )}
    >
      {status || 'draft'}
    </span>
  );
}

function VerificationStats({ data }: { data: DoctorVerificationQueuePage | null }) {
  const c = data?.counts;
  const totalAll = c ? c.pending + c.approved + c.rejected + c.draft : 0;
  const cards = [
    { key: 'pending', label: 'Pending', value: c?.pending ?? 0 },
    { key: 'approved', label: 'Approved', value: c?.approved ?? 0 },
    { key: 'rejected', label: 'Rejected', value: c?.rejected ?? 0 },
    { key: 'total', label: 'All profiles', value: totalAll },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ key, label, value }) => (
        <Card key={key} className="border-border/80 shadow-sm">
          <CardContent>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function VerificationFilters({
  isSuperAdmin,
  statusFilter,
  setStatusFilter,
  tenantFilter,
  setTenantFilter,
  tenants,
  tenantsLoading,
  search,
  setSearch,
}: {
  isSuperAdmin: boolean;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  tenantFilter: string | null;
  setTenantFilter: (v: string | null) => void;
  tenants: Tenant[];
  tenantsLoading: boolean;
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-2">
        <label htmlFor="vf-status" className="text-sm text-muted-foreground whitespace-nowrap">
          Status
        </label>
        <select
          id="vf-status"
          className={cn(
            'h-10 min-w-[10rem] rounded-lg border border-input bg-background px-3 text-sm',
            'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isSuperAdmin && (
        <div className="flex items-center gap-2 min-w-[220px] flex-1 sm:max-w-xs">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <select
            id="vf-tenant"
            aria-label="Filter by organization"
            disabled={tenantsLoading}
            className={cn(
              'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm',
              'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            value={tenantFilter ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setTenantFilter(v === '' ? null : v);
            }}
          >
            <option value="">All organizations</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by doctor or organization…"
          className="h-10 pl-9"
          aria-label="Search queue"
        />
      </div>
    </div>
  );
}

function VerificationList({
  doctors,
  selectedId,
  onSelect,
}: {
  doctors: DoctorVerificationQueueItem[];
  selectedId: string | null;
  onSelect: (d: DoctorVerificationQueueItem) => void;
}) {
  if (!doctors.length) {
    return (
      <div className="flex w-full min-w-0 flex-[0_0_100%] border-b border-border bg-muted/20 md:w-[min(100%,380px)] md:flex-none md:border-b-0 md:border-r items-center justify-center p-8 text-center text-sm text-muted-foreground">
        No doctors match this filter.
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-[0_0_100%] overflow-y-auto border-b border-border bg-card md:w-[min(100%,380px)] md:flex-none md:border-b-0 md:border-r">
      <ul className="w-full divide-y divide-border/80" role="listbox" aria-label="Verification queue">
        {doctors.map((doc) => {
          const active = selectedId === doc.doctor_id;
          return (
            <li key={doc.doctor_id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelect(doc)}
                className={cn(
                  'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors',
                  active ? 'bg-primary/8' : 'hover:bg-muted/50'
                )}
              >
                <span className="font-medium text-foreground">{doc.doctor_name || '—'}</span>
                <span className="text-xs text-muted-foreground">
                  {doc.tenant_name || 'Organization'}
                  {doc.tenant_type ? ` · ${doc.tenant_type === 'individual' ? 'Individual' : 'Clinic'}` : ''}
                </span>
                <div className="pt-0.5">
                  <StatusBadge status={doc.verification_status} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function VerificationDetail({
  queueRow,
  profile,
  profileLoading,
  profileError,
  canVerify,
  submitting,
  onApprove,
  onOpenReject,
  onRetryProfile,
}: {
  queueRow: DoctorVerificationQueueItem | null;
  profile: DoctorProfileRead | null;
  profileLoading: boolean;
  profileError: string | null;
  canVerify: boolean;
  submitting: boolean;
  onApprove: () => void;
  onOpenReject: () => void;
  onRetryProfile: () => void;
}) {
  if (!queueRow) {
    return (
      <div className="flex min-h-[280px] flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Select a doctor to review details.
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <ErrorState
          title="Could not load profile"
          description="Doctor profile details could not be loaded."
          error={profileError}
          onRetry={onRetryProfile}
        />
      </div>
    );
  }

  const name = profile?.full_name || queueRow.doctor_name;
  const status = profile?.verification_status ?? queueRow.verification_status;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
      <div className="space-y-1 border-b border-border/80 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">{name}</h2>
          <StatusBadge status={status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {queueRow.tenant_name}
          {queueRow.tenant_type ? ` · ${queueRow.tenant_type === 'individual' ? 'Individual' : 'Clinic'}` : ''}
        </p>
      </div>

      {profileLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading profile…</p>
      ) : (
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          {[
            ['Phone', profile?.phone ?? '—'],
            ['Specialization', profile?.specialization ?? '—'],
            ['Experience (years)', profile?.experience_years != null ? String(profile.experience_years) : '—'],
            ['Qualification', profile?.qualification ?? '—'],
            ['Registration #', profile?.registration_number ?? '—'],
            ['Council', profile?.registration_council ?? '—'],
            ['Clinic', profile?.clinic_name ?? '—'],
            ['Location', [profile?.city, profile?.state].filter(Boolean).join(', ') || '—'],
          ].map(([label, val]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-foreground">{val}</dd>
            </div>
          ))}
        </dl>
      )}

      {status === 'rejected' &&
        (profile?.verification_rejection_reason || queueRow.verification_rejection_reason) && (
          <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <p className="font-medium">Rejection reason</p>
            <p className="mt-1 text-destructive/90">
              {profile?.verification_rejection_reason ?? queueRow.verification_rejection_reason}
            </p>
          </div>
        )}

      {canVerify && status === 'pending' && !profileLoading && (
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" disabled={submitting} onClick={onApprove}>
            Approve
          </Button>
          <Button variant="danger" disabled={submitting} onClick={onOpenReject}>
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

export function AdminDoctorVerificationsPage() {
  const { user } = useAuth();
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const eff = getEffectiveRoles(user, token);
  const isSuperAdmin = isSuperAdminRole(eff);
  const canVerify = canVerifyDoctorsInTenant(user, token);

  const [pageData, setPageData] = useState<DoctorVerificationQueuePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  const [selected, setSelected] = useState<DoctorVerificationQueueItem | null>(null);
  const [profile, setProfile] = useState<DoctorProfileRead | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const rejectModalRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(rejectModalRef, rejectOpen);

  const scope = useMemo(() => listScope(isSuperAdmin, tenantFilter), [isSuperAdmin, tenantFilter]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await doctorVerificationAdminApi.list(
        {
          verification_status: statusFilter || undefined,
          limit: 500,
        },
        scope
      );
      setPageData(data);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'detail' in e
          ? String((e as { detail?: unknown }).detail)
          : 'Could not load queue';
      setError(msg);
      setPageData(null);
    } finally {
      setLoading(false);
    }
  }, [scope, statusFilter]);

  useEffect(() => {
    if (!canVerify) return;
    void loadQueue();
  }, [canVerify, loadQueue]);

  useEffect(() => {
    if (!isSuperAdmin || !canVerify) return;
    let cancelled = false;
    setTenantsLoading(true);
    void (async () => {
      try {
        const list = await tenantsApi.getAll({ include_deactivated: false });
        if (!cancelled) setTenants(list.filter((t) => !t.is_deleted));
      } catch {
        if (!cancelled) setTenants([]);
      } finally {
        if (!cancelled) setTenantsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, canVerify]);

  const filteredItems = useMemo(() => {
    const items = pageData?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const name = (row.doctor_name || '').toLowerCase();
      const org = (row.tenant_name || '').toLowerCase();
      return name.includes(q) || org.includes(q);
    });
  }, [pageData?.items, search]);

  useEffect(() => {
    if (!selected || !pageData) return;
    const stillInPage = pageData.items.some((r) => r.doctor_id === selected.doctor_id);
    if (!stillInPage) {
      setSelected(null);
      setProfile(null);
    }
  }, [pageData, selected]);

  useEffect(() => {
    if (!selected) return;
    const stillThere = filteredItems.some((r) => r.doctor_id === selected.doctor_id);
    if (!stillThere) {
      setSelected(null);
      setProfile(null);
    }
  }, [filteredItems, selected]);

  const loadProfile = useCallback(
    async (row: DoctorVerificationQueueItem) => {
      setProfileLoading(true);
      setProfileError(null);
      setProfile(null);
      try {
        const p = await doctorVerificationAdminApi.getProfile(row.doctor_id, scope);
        setProfile(p);
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'detail' in e
            ? String((e as { detail?: unknown }).detail)
            : 'Could not load profile';
        setProfileError(msg);
      } finally {
        setProfileLoading(false);
      }
    },
    [scope]
  );

  useEffect(() => {
    if (!selected || !canVerify) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    void loadProfile(selected);
  }, [selected, canVerify, loadProfile]);

  const onSelectRow = (row: DoctorVerificationQueueItem) => {
    setSelected(row);
  };

  const refetchAndMaybeClear = async () => {
    await loadQueue();
    setSelected(null);
    setProfile(null);
  };

  const approve = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await doctorVerificationAdminApi.setVerification(selected.doctor_id, { status: 'approved' });
      toast.success('Doctor approved');
      await refetchAndMaybeClear();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'detail' in e
          ? String((e as { detail?: unknown }).detail)
          : 'Approve failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const submitReject = async () => {
    if (!selected) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('Enter a reason for rejection');
      return;
    }
    setSubmitting(true);
    try {
      await doctorVerificationAdminApi.setVerification(selected.doctor_id, {
        status: 'rejected',
        reason,
      });
      toast.success('Doctor rejected');
      setRejectOpen(false);
      setRejectReason('');
      await refetchAndMaybeClear();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'detail' in e
          ? String((e as { detail?: unknown }).detail)
          : 'Reject failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canVerify) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Doctor verifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSuperAdmin
            ? 'Review doctors across every organization. Optionally filter by tenant — your global queue ignores the header organization switcher.'
            : 'Review marketplace verification for doctors in your organization only.'}
        </p>
      </div>

      <VerificationStats data={pageData} />

      <VerificationFilters
        isSuperAdmin={isSuperAdmin}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        tenantFilter={tenantFilter}
        setTenantFilter={setTenantFilter}
        tenants={tenants}
        tenantsLoading={tenantsLoading}
        search={search}
        setSearch={setSearch}
      />

      {error && (
        <ErrorState
          title="Could not load"
          description="The verification queue could not be loaded."
          error={error}
          onRetry={() => void loadQueue()}
        />
      )}

      {loading && !error && <p className="text-sm text-muted-foreground">Loading queue…</p>}

      {!loading && !error && (
        <div
          className={cn(
            'flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm',
            'md:flex-row'
          )}
        >
          <VerificationList
            doctors={filteredItems}
            selectedId={selected?.doctor_id ?? null}
            onSelect={onSelectRow}
          />
          <VerificationDetail
            queueRow={selected}
            profile={profile}
            profileLoading={profileLoading}
            profileError={profileError}
            canVerify={canVerify}
            submitting={submitting}
            onApprove={() => void approve()}
            onOpenReject={() => {
              setRejectReason('');
              setRejectOpen(true);
            }}
            onRetryProfile={() => selected && void loadProfile(selected)}
          />
        </div>
      )}

      {rejectOpen && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRejectOpen(false);
          }}
        >
          <div
            ref={rejectModalRef}
            className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-doctor-title"
          >
            <h2 id="reject-doctor-title" className="text-lg font-semibold">
              Reject verification
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {selected.doctor_name} — a reason is required so the doctor can fix their profile.
            </p>
            <label htmlFor="reject-reason" className="mt-4 block text-sm font-medium">
              Reason for rejection
            </label>
            <textarea
              id="reject-reason"
              className={cn(
                'mt-2 flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
                'ring-offset-background placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={submitting || !rejectReason.trim()}
                onClick={() => void submitReject()}
              >
                {submitting ? 'Submitting…' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
