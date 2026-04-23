import { getActiveTenantId } from './tenantIdForRequest';
import { roleFromToken, rolesFromToken } from './jwtPayload';
import { readStoredAppMode, type AppMode } from '../constants/appMode';

export function normalizeRoles(roles: string | string[] | null | undefined): string[] {
  if (roles == null) return [];
  if (Array.isArray(roles)) {
    return roles.map((r) => String(r).toLowerCase());
  }
  return [String(roles).toLowerCase()];
}

type RoleHint = { roles?: string[]; role?: string } | null | undefined;

/**
 * Authoritative list for the signed-in user: user blob first, then JWT.
 */
export function getEffectiveRoles(user: RoleHint, token: string | null): string[] {
  if (user?.roles && user.roles.length > 0) {
    return normalizeRoles(user.roles);
  }
  if (user?.role) {
    return normalizeRoles([user.role]);
  }
  const fromToken = rolesFromToken(token);
  if (fromToken && fromToken.length > 0) {
    return normalizeRoles(fromToken);
  }
  const single = roleFromToken(token);
  return single ? normalizeRoles([single]) : [];
}

/** Backend sends role enum as lowercase string (e.g. patient, admin, doctor). */
export function isPatientRole(roles: string | string[] | null | undefined): boolean {
  return normalizeRoles(roles).includes('patient');
}

export function isDoctorRole(roles: string | string[] | null | undefined): boolean {
  return normalizeRoles(roles).includes('doctor');
}

/** Admin dashboard and admin-only APIs (admin or super_admin). */
export function isAdminRole(roles: string | string[] | null | undefined): boolean {
  return normalizeRoles(roles).some((r) => r === 'admin' || r === 'super_admin');
}

/** Admin dashboard, inventory, billing, settings — admin/super_admin or practice owner (solo doctor). */
export function canAccessAdminUI(
  roles: string | string[] | null | undefined,
  user?: { is_owner?: boolean } | null
): boolean {
  const r = normalizeRoles(roles);
  if (r.some((x) => x === 'admin' || x === 'super_admin')) return true;
  if (r.includes('doctor') && user?.is_owner === true) return true;
  return false;
}

export function isSuperAdminRole(roles: string | string[] | null | undefined): boolean {
  return normalizeRoles(roles).includes('super_admin');
}

export function staffHomePath(): string {
  return '/dashboard';
}

export function patientHomePath(): string {
  return '/patient/home';
}

export function doctorHomePath(): string {
  return '/doctor/home';
}

/** Default landing path after login or post-registration, by role. */
export function postLoginHomePath(
  roles: string | string[] | null | undefined,
  user?: { is_owner?: boolean } | null
): string {
  const r = normalizeRoles(roles);
  if (r.includes('patient')) return patientHomePath();
  const hasDoc = r.includes('doctor');
  const hasAdm = r.some((x) => x === 'admin' || x === 'super_admin');
  if (hasDoc && hasAdm) {
    const m: AppMode = readStoredAppMode() ?? 'practice';
    return m === 'admin' ? '/admin/dashboard' : '/doctor/appointments';
  }
  if (r.includes('doctor') && user?.is_owner === true) {
    return '/admin/dashboard';
  }
  if (r.includes('doctor')) return doctorHomePath();
  if (r.includes('super_admin')) {
    return getActiveTenantId() ? '/admin/dashboard' : '/admin/tenants';
  }
  return staffHomePath();
}
