/**
 * Patient Constants
 * Centralized constants for patient module
 */

export const PATIENT_DEFAULT_PARAMS = {
  skip: 0,
  limit: 100,
};

export const EMPTY_PATIENT = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  medical_history: '',
};

export const PATIENT_TABLE_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'dob', label: 'DOB / Age' },
  { key: 'registered', label: 'Registered' },
] as const;
