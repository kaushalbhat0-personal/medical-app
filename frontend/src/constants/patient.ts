/**
 * Patient Constants
 * Centralized constants for patient module
 */

/** Session key: last booked appointment JSON for optimistic UI after navigation (StrictMode-safe). */
export const PATIENT_BOOKING_PENDING_STORAGE_KEY = 'medical_webapp:pending_patient_booking';

export const PATIENT_DEFAULT_PARAMS = {
  skip: 0,
  limit: 100,
};

export const EMPTY_PATIENT = {
  name: '',
  age: '',
  gender: '',
  phone: '',
};

export const PATIENT_TABLE_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'dob', label: 'DOB / Age' },
  { key: 'registered', label: 'Registered' },
] as const;
