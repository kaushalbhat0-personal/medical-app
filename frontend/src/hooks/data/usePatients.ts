import { useFetch } from './useFetch';
import { fetchPatientsHandler } from '../../handlers';
import { safeArray } from '../../utils';
import type { Patient } from '../../types';

export function usePatients(search?: string) {
  const { data, loading, error, refetch } = useFetch(
    fetchPatientsHandler,
    search?.trim() || undefined
  );

  return {
    patients: safeArray<Patient>(data),
    loading,
    error,
    refetch,
  };
}
