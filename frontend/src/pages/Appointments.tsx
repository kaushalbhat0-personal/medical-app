import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'react-router-dom';
import { Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppointments, type AppointmentFilters } from '../hooks';
import { createAppointmentHandler } from '../handlers';
import { EMPTY_APPOINTMENT, APPOINTMENT_STATUS_CLASSES } from '../constants';
import {
  formatPatientName,
  formatDoctorName,
  formatDateTimeSafe,
} from '../utils';
import { ErrorState, EmptyState, GlobalLoader, FormWrapper, FormSelect, FormInput, FormTextarea } from '../components/common';
import { appointmentSchema, type AppointmentFormData, type AppointmentFormInput } from '../validation';

export function Appointments() {
  const location = useLocation();

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

  // Form state - auto-show if navigated from Quick Actions
  const [showForm, setShowForm] = useState(() => (location.state as { showForm?: boolean })?.showForm ?? false);
  const [apiError, setApiError] = useState('');

  // Scroll to form when shown via Quick Actions
  useEffect(() => {
    if (showForm && (location.state as { showForm?: boolean })?.showForm) {
      // Clear the state to prevent re-triggering on refresh
      window.history.replaceState({}, document.title);
      // Scroll to form with smooth animation
      setTimeout(() => {
        const formElement = document.getElementById('appointment-form');
        formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showForm, location.state]);

  const form = useForm<AppointmentFormInput, any, AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: EMPTY_APPOINTMENT,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const { reset } = form;

  const hasActiveFilters = filterDoctor || filterStatus;

  const clearFilters = () => {
    setFilterDoctor('');
    setFilterStatus('');
  };

  // Debug: Log form errors whenever they change
  if (import.meta.env.DEV) {
    const errors = form.formState.errors;
    if (Object.keys(errors).length > 0) {
      console.log('[Appointments] Form errors:', errors);
    }
  }

  // Create handler with robust error handling and toast notifications
  const onSubmit = async (data: AppointmentFormData) => {
    console.log('SUBMIT TRIGGERED - Appointments form');
    // Clear any previous API error
    setApiError('');

    // Prevent submission if already submitting (double-click protection)
    if (form.formState.isSubmitting) {
      console.log('SUBMIT BLOCKED - already submitting');
      return;
    }

    console.log('[Appointments.onSubmit] Submitting:', data);

    try {
      await createAppointmentHandler(data);

      // Success: show toast, reset form, close modal, refresh data
      toast.success('Appointment scheduled successfully', {
        duration: 3000,
        icon: '📅',
      });

      reset();
      setShowForm(false);

      if (import.meta.env.DEV) {
        console.log('[Appointments.onSubmit] Refetching data...');
      }
      await refetch();

      console.log('[Appointments.onSubmit] Success - form reset and data refreshed');
    } catch (err: any) {
      console.error('[Appointments.onSubmit] Error:', err);

      // Handle different error types
      let errorMessage = 'Failed to create appointment';

      if (err?.detail) {
        // Backend validation error (422)
        errorMessage = err.detail;
      } else if (err?.message) {
        // Generic error message
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      // Show error in form for visibility and toast for notification
      setApiError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });

      // Keep form open so user can correct errors
      // Don't reset form on error to preserve user input
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
        <div id="appointment-form" className="p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">New Appointment</h3>
          <FormWrapper<AppointmentFormInput, AppointmentFormData>
            form={form}
            onSubmit={onSubmit}
            submitLabel="Schedule Appointment"
            loadingLabel="Scheduling..."
            apiError={apiError}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <FormSelect<AppointmentFormInput>
                name="patient_id"
                label="Patient"
                placeholder="Select patient"
                options={patients.map((p) => ({
                  value: String(p.id),
                  label: formatPatientName(p),
                }))}
                disabled={form.formState.isSubmitting}
                required
              />
              <FormSelect<AppointmentFormInput>
                name="doctor_id"
                label="Doctor"
                placeholder="Select doctor"
                options={doctors.map((d) => ({
                  value: String(d.id),
                  label: `${formatDoctorName(d)} - ${d.specialization || d.specialty || 'General'}`,
                }))}
                disabled={form.formState.isSubmitting}
                required
              />
              <FormInput<AppointmentFormInput>
                name="scheduled_at"
                label="Date & Time"
                type="datetime-local"
                disabled={form.formState.isSubmitting}
                required
              />
            </div>
            <FormTextarea<AppointmentFormInput>
              name="notes"
              label="Notes"
              rows={2}
              disabled={form.formState.isSubmitting}
            />
          </FormWrapper>
        </div>
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
