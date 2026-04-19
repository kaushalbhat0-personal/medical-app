/**
 * Patient Constants
 * Centralized constants for patient module
 */

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
