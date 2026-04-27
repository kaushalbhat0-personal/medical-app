import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { doctorVerificationAdminApi, type DoctorVerificationQueueItem } from '../services/doctorVerificationAdmin';
import { getEffectiveRoles, canVerifyDoctorsInTenant } from '../utils/roles';
import { Button } from '../components/common';
import { cn } from '@/lib/utils';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { ErrorState } from '../components/common';

const STATUS_FILTER = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
] as const;

export function AdminDoctorVerificationsPage() {
  const { user } = useAuth();
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const eff = getEffectiveRoles(user, token);
  const canVerify = canVerifyDoctorsInTenant(user, token);

  const [rows, setRows] = useState<DoctorVerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('pending');
  const [rejectTarget, setRejectTarget] = useState<DoctorVerificationQueueItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const rejectModalRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(rejectModalRef, Boolean(rejectTarget));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await doctorVerificationAdminApi.list({
        verification_status: filter || undefined,
        limit: 500,
      });
      setRows(page.items);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'detail' in e
          ? String((e as { detail?: unknown }).detail)
          : 'Could not load queue';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (canVerify) void load();
  }, [canVerify, load]);

  const approve = async (d: DoctorVerificationQueueItem) => {
    setSubmitting(true);
    try {
      await doctorVerificationAdminApi.setVerification(d.doctor_id, { status: 'approved' });
      toast.success('Doctor approved');
      await load();
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

  const openReject = (d: DoctorVerificationQueueItem) => {
    setRejectReason('');
    setRejectTarget(d);
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('Enter a reason for rejection');
      return;
    }
    setSubmitting(true);
    try {
      await doctorVerificationAdminApi.setVerification(rejectTarget.doctor_id, {
        status: 'rejected',
        reason,
      });
      toast.success('Doctor rejected');
      setRejectTarget(null);
      await load();
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
    <div className="page-container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Doctor verifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {eff.includes('super_admin')
              ? 'All organizations (pick a tenant in the header to filter).'
              : 'Doctors in your organization only.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="vf-status" className="text-sm text-muted-foreground whitespace-nowrap">
            Status
          </label>
          <select
            id="vf-status"
            className={cn(
              'h-9 rounded-md border border-input bg-background px-3 text-sm',
              'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {STATUS_FILTER.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Could not load"
          description="The verification queue could not be loaded."
          error={error}
          onRetry={() => void load()}
        />
      )}

      {loading && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3 font-medium">Doctor</th>
                <th className="p-3 font-medium">Organization</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No doctors match this filter.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.doctor_id} className="border-b border-border/80">
                    <td className="p-3 font-medium">{r.doctor_name || '—'}</td>
                    <td className="p-3 text-muted-foreground">{r.tenant_name || '—'}</td>
                    <td className="p-3 capitalize">{r.tenant_type === 'individual' ? 'Individual' : 'Clinic'}</td>
                    <td className="p-3">
                      <div className="space-y-1">
                        <span
                          className={cn(
                            'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                            r.verification_status === 'approved' && 'bg-emerald-500/15 text-emerald-700',
                            r.verification_status === 'pending' && 'bg-amber-500/15 text-amber-800',
                            r.verification_status === 'rejected' && 'bg-red-500/15 text-red-800',
                            (r.verification_status === 'draft' || !r.verification_status) && 'bg-muted text-muted-foreground'
                          )}
                        >
                          {r.verification_status}
                        </span>
                        {r.verification_status === 'rejected' &&
                          (r.verification_rejection_reason?.trim() ?? '').length > 0 && (
                            <p className="text-xs text-muted-foreground max-w-[20rem]">
                              {r.verification_rejection_reason}
                            </p>
                          )}
                      </div>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {r.verification_status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={submitting}
                            onClick={() => void approve(r)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={submitting}
                            onClick={() => openReject(r)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRejectTarget(null);
          }}
        >
          <div
            ref={rejectModalRef}
            className={cn(
              'w-full max-w-md rounded-xl border border-border bg-background shadow-lg',
              'p-6 space-y-4'
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-doctor-title"
          >
            <h2 id="reject-doctor-title" className="text-lg font-semibold">
              Reject verification
            </h2>
            <p className="text-sm text-muted-foreground">
              {rejectTarget.doctor_name} — a reason is required so the doctor can fix their profile.
            </p>
            <div className="space-y-2">
              <label htmlFor="reject-reason" className="text-sm font-medium">
                Reason for rejection
              </label>
              <textarea
                id="reject-reason"
                className={cn(
                  'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'ring-offset-background placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
                placeholder="Reason for rejection"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setRejectTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void submitReject()}
                disabled={submitting || !rejectReason.trim()}
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
