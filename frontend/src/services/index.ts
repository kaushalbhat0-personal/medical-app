// Central exports for all API services
export { api } from './api';
export { authApi } from './auth';
export { patientsApi, type CreatePatientData } from './patients';
export { appointmentsApi, type CreateAppointmentData } from './appointments';
export { billingApi, BillingApiError, type CreateBillData } from './billing';
export { doctorsApi } from './doctors';
export { dashboardApi } from './dashboard';
