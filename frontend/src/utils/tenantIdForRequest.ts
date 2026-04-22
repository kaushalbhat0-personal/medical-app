import { tenantIdFromToken } from './jwtPayload';

/**
 * Primary org switcher key: sent as `X-Tenant-ID` on every API request when set.
 */
export const TENANT_ID_STORAGE_KEY = 'tenant_id';

/** @deprecated Prefer TENANT_ID_STORAGE_KEY; still read as fallback for older sessions */
export const ADMIN_SELECTED_TENANT_STORAGE_KEY = 'adminSelectedTenantId';

/** Dispatched on the window after `tenant_id` changes (same-tab listeners). */
export const TENANT_ID_STORAGE_EVENT = 'tenant_id_changed';

export function setActiveTenantId(tenantId: string): void {
  localStorage.setItem(TENANT_ID_STORAGE_KEY, tenantId);
  window.dispatchEvent(new Event(TENANT_ID_STORAGE_EVENT));
}

/**
 * Resolves the tenant id to send as `X-Tenant-ID` (required by admin dashboard APIs).
 */
export function getTenantIdForRequest(): string | undefined {
  const explicit = localStorage.getItem(TENANT_ID_STORAGE_KEY)?.trim();
  if (explicit) {
    return explicit;
  }

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const fromEnv = import.meta.env.VITE_DEV_TENANT_ID as string | undefined;

  if (userStr) {
    try {
      const user = JSON.parse(userStr) as { role?: string; tenant_id?: string | null };
      if (user.role === 'super_admin') {
        return (
          localStorage.getItem(ADMIN_SELECTED_TENANT_STORAGE_KEY)?.trim() ||
          (user.tenant_id ? String(user.tenant_id) : undefined) ||
          fromEnv ||
          tenantIdFromToken(token) ||
          undefined
        );
      }
      if (user.tenant_id) {
        return String(user.tenant_id);
      }
    } catch {
      // fall through
    }
  }
  return tenantIdFromToken(token) || fromEnv || undefined;
}
