import { tenantIdFromToken } from './jwtPayload';

/** Canonical localStorage key for the org switcher (super admin) and aligned tenant header for staff. */
export const ACTIVE_TENANT_ID_STORAGE_KEY = 'activeTenantId';

/** @deprecated Legacy key; still read for migration */
const TENANT_ID_LEGACY_STORAGE_KEY = 'tenant_id';

/** @deprecated Legacy fallback */
const ADMIN_SELECTED_TENANT_STORAGE_KEY = 'adminSelectedTenantId';

/** Dispatched on the window after the active tenant id changes (same-tab listeners). */
export const TENANT_ID_STORAGE_EVENT = 'tenant_id_changed';

/** @deprecated Use ACTIVE_TENANT_ID_STORAGE_KEY */
export const TENANT_ID_STORAGE_KEY = ACTIVE_TENANT_ID_STORAGE_KEY;

export function getActiveTenantId(): string | null {
  const primary = localStorage.getItem(ACTIVE_TENANT_ID_STORAGE_KEY)?.trim();
  if (primary) return primary;
  const legacy = localStorage.getItem(TENANT_ID_LEGACY_STORAGE_KEY)?.trim();
  if (legacy) {
    localStorage.setItem(ACTIVE_TENANT_ID_STORAGE_KEY, legacy);
    return legacy;
  }
  const adminPick = localStorage.getItem(ADMIN_SELECTED_TENANT_STORAGE_KEY)?.trim();
  if (adminPick) {
    localStorage.setItem(ACTIVE_TENANT_ID_STORAGE_KEY, adminPick);
    return adminPick;
  }
  return null;
}

export function setActiveTenantId(tenantId: string): void {
  const id = tenantId.trim();
  localStorage.setItem(ACTIVE_TENANT_ID_STORAGE_KEY, id);
  localStorage.removeItem(TENANT_ID_LEGACY_STORAGE_KEY);
  localStorage.removeItem(ADMIN_SELECTED_TENANT_STORAGE_KEY);
  window.dispatchEvent(new Event(TENANT_ID_STORAGE_EVENT));
}

function isSuperAdminRoleLocal(role: string | null | undefined): boolean {
  return role?.toLowerCase() === 'super_admin';
}

/**
 * Resolves the tenant id to send as `X-Tenant-ID` for scoped APIs.
 * - super_admin: only the selected org (`activeTenantId`); never JWT/env guessing.
 * - others: selected org, then user profile / JWT home tenant.
 */
export function getTenantIdForRequest(): string | undefined {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  let role: string | undefined;
  if (userStr) {
    try {
      role = (JSON.parse(userStr) as { role?: string }).role;
    } catch {
      // ignore
    }
  }
  role = role ?? undefined;

  const active = getActiveTenantId() ?? undefined;

  if (isSuperAdminRoleLocal(role)) {
    return active;
  }

  if (active) {
    return active;
  }

  const fromEnv = import.meta.env.VITE_DEV_TENANT_ID as string | undefined;

  if (userStr) {
    try {
      const user = JSON.parse(userStr) as { role?: string; tenant_id?: string | null };
      if (user.tenant_id) {
        return String(user.tenant_id);
      }
    } catch {
      // fall through
    }
  }

  return tenantIdFromToken(token) || fromEnv || undefined;
}
