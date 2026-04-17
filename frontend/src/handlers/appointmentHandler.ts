/**
 * Appointment Handler
 * Business logic for appointment operations
 */

import { appointmentsApi, patientsApi, doctorsApi } from '../services';
import { APPOINTMENT_DEFAULT_PARAMS } from '../constants';
import { safeArray } from '../utils';
import type { Appointment, Patient, Doctor } from '../types';
import type { AppointmentFormData } from '../validation';

export interface AppointmentFilters {
  doctor_id?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

export interface AppointmentDataResult {
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
}

/**
 * Fetch appointments with filters, plus patients and doctors for dropdowns
 */
export const fetchAppointmentDataHandler = async (
  filters?: AppointmentFilters
): Promise<AppointmentDataResult> => {
  const [appointmentsData, patientsData, doctorsData] = await Promise.all([
    appointmentsApi.getAll({
      ...APPOINTMENT_DEFAULT_PARAMS,
      ...filters,
    }),
    patientsApi.getAll(),
    doctorsApi.getAll(),
  ]);

  return {
    appointments: safeArray<Appointment>(appointmentsData),
    patients: safeArray<Patient>(patientsData),
    doctors: safeArray<Doctor>(doctorsData),
  };
};

/**
 * Create a new appointment
 */
export const createAppointmentHandler = async (
  data: AppointmentFormData
): Promise<void> => {
  await appointmentsApi.create(data);
};
