// Central exports for all API services
export { api, retryRequest, isNetworkError, isColdStartError } from './api';
export { authApi, formatLoginError } from './auth';
export { patientsApi, type CreatePatientData, type PatientUpdatePayload } from './patients';
export { appointmentsApi, type CreateAppointmentData } from './appointments';
export { billingApi, BillingApiError, type CreateBillData } from './billing';
export {
  doctorsApi,
  initDoctorSlotsCacheCrossTabSync,
  invalidateDoctorSlotsClientCache,
  SLOTS_CROSS_TAB_BROADCAST,
  SLOTS_INVALIDATE_STORAGE_KEY,
  shouldSyncSlotsCrossTab,
  type CreateDoctorData,
  type DoctorDayMeta,
  type DoctorScheduleDay,
  type DoctorSlot,
} from './doctors';
export type { DoctorAvailabilityWindow } from '../types';
export { dashboardApi } from './dashboard';
export { tenantsApi } from './tenants';
export { publicDiscoveryApi } from './publicDiscovery';
export { usersApi, type OrganizationUserCreatePayload } from './users';
export {
  inventoryApi,
  type InventoryItemDTO,
  type InventoryItemCreatePayload,
  type InventoryItemType,
} from './inventory';
