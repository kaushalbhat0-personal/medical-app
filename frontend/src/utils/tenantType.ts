/**
 * Backend `TenantType` values (app.models.tenant.TenantType).
 * Solo signups and multi-doctor orgs use the same tenant model; the UI is scoped by `tenant_id`.
 */
export const TENANT_TYPE_INDEPENDENT_DOCTOR = 'independent_doctor';
export const TENANT_TYPE_HOSPITAL = 'hospital';
export const TENANT_TYPE_CLINIC = 'clinic';

export function isManagedOrgTenant(tenantType: string | null | undefined): boolean {
  return (
    tenantType === TENANT_TYPE_HOSPITAL ||
    tenantType === TENANT_TYPE_CLINIC ||
    tenantType === TENANT_TYPE_INDEPENDENT_DOCTOR
  );
}
