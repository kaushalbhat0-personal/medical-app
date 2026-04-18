import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import debounce from 'lodash.debounce';
import { usePatients } from '../hooks';
import { createPatientHandler } from '../handlers';
import { EMPTY_PATIENT } from '../constants';
import { formatPatientName, formatPatientDobOrAge, formatDateSafe } from '../utils';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonTable } from '../components/common/skeletons';
import { patientSchema, type PatientFormData } from '../validation';

export function Patients() {
  // Search state with debounce
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const debouncedSearch = useMemo(
    () => debounce((value: string) => setSearch(value), 400),
    []
  );

  // Data fetching via hook
  const { patients, loading, error, refetch } = usePatients(search);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: EMPTY_PATIENT,
  });

  // Create handler
  const onSubmit = async (data: PatientFormData) => {
    setApiError('');
    // Form validation to prevent 422 errors
    if (!data.first_name || !data.last_name) {
      setApiError('Please enter first and last name');
      return;
    }
    try {
      await createPatientHandler(data);
      reset();
      setShowForm(false);
      await refetch();
    } catch (err: any) {
      setApiError(err?.message || 'Failed to create patient');
    }
  };

  // Safe rendering guards - only show empty after loading completes
  const safePatients = Array.isArray(patients) ? patients : [];
  const isEmpty = !loading && safePatients.length === 0;

  return (
    <div className="page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      {error && (
        <ErrorState
          title="Something went wrong"
          description="Failed to load data"
          error={error}
          onRetry={refetch}
        />
      )}

      {!error && isEmpty && (
        <EmptyState
          title="No data available"
          description="There are no patients to display at the moment."
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-8 bg-gray-200 rounded-xl w-32 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded-lg w-48 animate-pulse" />
            </div>
          ) : (
            <>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">Patients</h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1">Manage patient records</p>
            </>
          )}
        </div>
        <button
          className="min-h-[44px] px-4 py-2.5 inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200 sm:w-auto"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add Patient'}
        </button>
      </div>

      {loading && (
        <div className="mb-6">
          <SkeletonTable rows={5} columns={5} />
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Search */}
          <div className="max-w-md">
            <input
              type="text"
              placeholder="Search patients..."
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value;
                setSearchInput(value);
                debouncedSearch(value);
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            />
          </div>

          {/* Create Form */}
          {showForm && (
            <form className="p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <h3 className="text-lg font-semibold text-gray-900">New Patient</h3>
              {apiError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{apiError}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    {...register('first_name')}
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  {errors.first_name && <span className="text-sm text-red-600">{errors.first_name.message}</span>}
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    {...register('last_name')}
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  {errors.last_name && <span className="text-sm text-red-600">{errors.last_name.message}</span>}
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    {...register('email')}
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  {errors.email && <span className="text-sm text-red-600">{errors.email.message}</span>}
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    {...register('phone')}
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  {errors.phone && <span className="text-sm text-red-600">{errors.phone.message}</span>}
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                  <input
                    type="date"
                    {...register('date_of_birth')}
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  {errors.date_of_birth && <span className="text-sm text-red-600">{errors.date_of_birth.message}</span>}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Medical History</label>
                <textarea
                  {...register('medical_history')}
                  rows={3}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 resize-y"
                />
              </div>
              <button
                type="submit"
                className="min-h-[44px] px-6 py-2.5 inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Patient'}
              </button>
            </form>
          )}

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">DOB / Age</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {safePatients.map((patient) => (
                    <tr key={patient?.id || Math.random()} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 sm:py-5">
                        <span className="font-semibold text-gray-900">{formatPatientName(patient)}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-600">{patient?.email || '-'}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-600">{patient?.phone || '-'}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-600">{formatPatientDobOrAge(patient)}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-500">{formatDateSafe(patient?.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
