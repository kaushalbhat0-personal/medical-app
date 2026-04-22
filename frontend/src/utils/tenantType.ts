/**
 * Backend `TenantType` values (app.models.tenant.TenantType).
 * Used to tailor doctor UI: independent practice vs organization-managed.
 */
export const TENANT_TYPE_INDEPENDENT_DOCTOR = 'independent_doctor';
export const TENANT_TYPE_HOSPITAL = 'hospital';
export const TENANT_TYPE_CLINIC = 'clinic';

export function isIndependentDoctorTenant(tenantType: string | null | undefined): boolean {
  return tenantType === TENANT_TYPE_INDEPENDENT_DOCTOR;
}

/** Hospital or clinic — doctor acts under org policies (read-only care views in the UI). */
export function isManagedOrgTenant(tenantType: string | null | undefined): boolean {
  return tenantType === TENANT_TYPE_HOSPITAL || tenantType === TENANT_TYPE_CLINIC;
}
