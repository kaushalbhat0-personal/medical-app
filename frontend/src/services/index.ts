// Central exports for all API services
export { api, retryRequest, isNetworkError, isColdStartError } from './api';
export { authApi, formatLoginError } from './auth';
export { patientsApi, type CreatePatientData } from './patients';
export { appointmentsApi, type CreateAppointmentData } from './appointments';
export { billingApi, BillingApiError, type CreateBillData } from './billing';
export { doctorsApi, type CreateDoctorData } from './doctors';
export { dashboardApi } from './dashboard';
