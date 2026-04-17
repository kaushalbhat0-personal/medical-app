/**
 * Patient Handler
 * Business logic for patient operations
 */

import { patientsApi } from '../services';
import { PATIENT_DEFAULT_PARAMS } from '../constants';
import { safeArray } from '../utils';
import type { Patient } from '../types';
import type { PatientFormData } from '../validation';

/**
 * Fetch patients with optional search
 */
export const fetchPatientsHandler = async (search?: string): Promise<Patient[]> => {
  const response = await patientsApi.getAll({
    ...PATIENT_DEFAULT_PARAMS,
    ...(search ? { search } : {}),
  });

  return safeArray<Patient>(response);
};

/**
 * Create a new patient
 */
export const createPatientHandler = async (data: PatientFormData): Promise<void> => {
  await patientsApi.create(data);
};
