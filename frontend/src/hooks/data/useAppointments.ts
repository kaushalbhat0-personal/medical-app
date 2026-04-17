import { useFetch } from './useFetch';
import { fetchAppointmentDataHandler } from '../../handlers';
import { safeArray } from '../../utils';
import type { Appointment, Patient, Doctor } from '../../types';

export interface AppointmentFilters {
  doctor_id?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

export function useAppointments(filters?: AppointmentFilters) {
  const { data, loading, refetching, error, refetch } = useFetch(
    fetchAppointmentDataHandler,
    filters
  );

  return {
    appointments: safeArray<Appointment>(data?.appointments),
    patients: safeArray<Patient>(data?.patients),
    doctors: safeArray<Doctor>(data?.doctors),
    loading,
    refetching,
    error,
    refetch,
  };
}
