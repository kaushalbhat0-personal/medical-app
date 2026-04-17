export { extractErrorMessage, handleApiError, logError, type ApiErrorResponse } from './errors';
export {
  formatDate,
  formatDateTime,
  formatTime,
  isPastDate,
  isToday,
  getRelativeTime,
  parseDate,
} from './date';

// Re-export API utilities for centralized imports
export { cleanParams, safeArray, safeObject } from './api';

// Re-export data transformation utilities
export {
  formatPatientName,
  formatDoctorName,
  formatDoctorDisplay,
  formatAppointmentPatientName,
  formatAppointmentDoctorName,
  formatDateSafe,
  formatDateTimeSafe,
  formatPatientDobOrAge,
  formatCurrency,
  getInitials,
  formatDoctorInitials,
} from './data';
