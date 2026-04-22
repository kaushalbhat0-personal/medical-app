import { tenantIdFromToken } from './jwtPayload';

/**
 * localStorage key for super_admin: which tenant to scope admin API calls to.
 * A future org-switcher can set this; until then, rely on `user.tenant_id`, JWT, or
 * VITE_DEV_TENANT_ID for local testing.
 */
export const ADMIN_SELECTED_TENANT_STORAGE_KEY = 'adminSelectedTenantId';

/**
 * Resolves the tenant id to send as `X-Tenant-ID` (required by admin dashboard APIs).
 */
export function getTenantIdForRequest(): string | undefined {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const fromEnv = import.meta.env.VITE_DEV_TENANT_ID as string | undefined;

  if (userStr) {
    try {
      const user = JSON.parse(userStr) as { role?: string; tenant_id?: string | null };
      if (user.role === 'super_admin') {
        return (
          localStorage.getItem(ADMIN_SELECTED_TENANT_STORAGE_KEY) ||
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
