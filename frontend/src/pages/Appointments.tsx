import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Filter, X } from 'lucide-react';
import { useAppointments, type AppointmentFilters } from '../hooks';
import { createAppointmentHandler } from '../handlers';
import { EMPTY_APPOINTMENT, APPOINTMENT_STATUS_CLASSES } from '../constants';
import {
  formatPatientName,
  formatDoctorName,
  formatDateTimeSafe,
} from '../utils';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { GlobalLoader } from '../components/common/GlobalLoader';
import { appointmentSchema, type AppointmentFormData } from '../validation';

export function Appointments() {
  // Filter states
  const [filterDoctor, setFilterDoctor] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<AppointmentFilters['status'] | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  // Stable filters object - only recreate when filter values actually change
  const filters = useMemo(
    () => ({
      doctor_id: filterDoctor ? String(filterDoctor) : undefined,
      status: filterStatus || undefined,
    }),
    [filterDoctor, filterStatus]
  );

  // Data fetching via hook
  const { appointments, patients, doctors, loading, refetching, error, refetch } = useAppointments(filters);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: EMPTY_APPOINTMENT,
  });

  const hasActiveFilters = filterDoctor || filterStatus;

  const clearFilters = () => {
    setFilterDoctor('');
    setFilterStatus('');
  };

  // Create handler
  const onSubmit = async (data: AppointmentFormData) => {
    setApiError('');
    // Form validation to prevent 422 errors
    if (!data.patient_id || !data.doctor_id) {
      setApiError('Please select both patient and doctor');
      return;
    }
    try {
      await createAppointmentHandler(data);
      reset();
      setShowForm(false);
      await refetch();
    } catch (err: any) {
      setApiError(err?.message || 'Failed to create appointment');
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    return APPOINTMENT_STATUS_CLASSES[status] || 'status-badge';
  };

  // Safe rendering guards - only show empty after loading completes
  const isLoading = loading && appointments.length === 0; // Only block UI on initial load
  const isEmpty = !loading && !refetching && appointments.length === 0;

  return (
    <div className="page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">Appointments</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Schedule and manage appointments</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            className={`min-h-[44px] px-4 py-2.5 inline-flex items-center justify-center gap-2 rounded-xl font-medium border transition-all duration-200 ${
              hasActiveFilters
                ? 'bg-blue-50 border-blue-500 text-blue-600'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
            } disabled:opacity-50`}
            onClick={() => setShowFilters(!showFilters)}
            disabled={loading || refetching}
          >
            <Filter className="h-4 w-4" />
            Filters {hasActiveFilters && '(Active)'}
          </button>
          <button
            className="min-h-[44px] px-4 py-2.5 inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
            onClick={() => setShowForm(!showForm)}
            disabled={loading || refetching}
          >
            {showForm ? 'Cancel' : '+ New Appointment'}
          </button>
        </div>
      </div>

      {isLoading && <GlobalLoader />}
      {refetching && (
        <div className="text-sm text-gray-500 py-2 text-right mb-4">Updating...</div>
      )}

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
          description="There are no appointments to display at the moment."
        />
      )}

      {showFilters && (
        <div className="p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Doctor</label>
              <select
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(Number(e.target.value) || '')}
                disabled={loading || refetching}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 bg-white"
              >
                <option value="">All Doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDoctorName(d)} - {d.specialization || d.specialty || 'General'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as AppointmentFilters['status'])}
                disabled={loading || refetching}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 bg-white"
              >
                <option value="">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
            <button
              type="button"
              className="min-h-[44px] px-4 py-2.5 inline-flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200 disabled:opacity-50"
              onClick={clearFilters}
              disabled={!hasActiveFilters || loading}
            >
              <X className="h-4 w-4" />
              Clear Filters
            </button>
            <button
              type="button"
              className="min-h-[44px] px-6 py-2.5 inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
              onClick={refetch}
              disabled={loading || refetching}
            >
              {refetching ? 'Updating...' : 'Apply Filters'}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form className="p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-6 mb-6" onSubmit={handleSubmit(onSubmit)}>
          <h3 className="text-lg font-semibold text-gray-900">New Appointment</h3>
          {apiError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{apiError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Patient</label>
              <select
                {...register('patient_id', { valueAsNumber: true })}
                disabled={isSubmitting}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 bg-white"
              >
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatPatientName(p)}
                  </option>
                ))}
              </select>
              {errors.patient_id && <span className="text-sm text-red-600">{errors.patient_id.message}</span>}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Doctor</label>
              <select
                {...register('doctor_id', { valueAsNumber: true })}
                disabled={isSubmitting}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 bg-white"
              >
                <option value="">Select doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDoctorName(d)} - {d.specialization || d.specialty || 'General'}
                  </option>
                ))}
              </select>
              {errors.doctor_id && <span className="text-sm text-red-600">{errors.doctor_id.message}</span>}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Date & Time</label>
              <input
                type="datetime-local"
                {...register('scheduled_at')}
                disabled={isSubmitting}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
              />
              {errors.scheduled_at && <span className="text-sm text-red-600">{errors.scheduled_at.message}</span>}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              {...register('notes')}
              rows={2}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 resize-y"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] px-6 py-2.5 inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Appointment'}
          </button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Doctor</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((apt) => {
                const appointmentTime = apt.appointment_time || apt.scheduled_at;
                return (
                  <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 sm:py-5 font-medium text-gray-900">{formatPatientName(apt.patient)}</td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-600">{formatDoctorName(apt.doctor)}</td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-600">{formatDateTimeSafe(appointmentTime)}</td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5">
                      <span className={getStatusBadgeClass(apt.status)}>{apt.status}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-500">{apt.notes || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
