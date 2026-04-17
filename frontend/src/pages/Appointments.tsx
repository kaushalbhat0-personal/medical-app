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
    <div className="page-container">
      <div className="page-header with-actions">
        <div>
          <h1>Appointments</h1>
          <p className="subtitle">Schedule and manage appointments</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn-secondary ${hasActiveFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            disabled={loading || refetching}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters {hasActiveFilters && '(Active)'}
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowForm(!showForm)}
            disabled={loading || refetching}
          >
            {showForm ? 'Cancel' : '+ New Appointment'}
          </button>
        </div>
      </div>

      {isLoading && <GlobalLoader />}
      {refetching && (
        <div className="text-sm text-gray-500 py-2 text-right">Updating...</div>
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
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Doctor</label>
              <select
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(Number(e.target.value) || '')}
                disabled={loading || refetching}
              >
                <option value="">All Doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDoctorName(d)} - {d.specialization || d.specialty || 'General'}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as AppointmentFilters['status'])}
                disabled={loading || refetching}
              >
                <option value="">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="filters-actions">
            <button
              type="button"
              className="btn-text"
              onClick={clearFilters}
              disabled={!hasActiveFilters || loading}
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={refetch}
              disabled={loading || refetching}
            >
              {refetching ? 'Updating...' : 'Apply Filters'}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form className="create-form" onSubmit={handleSubmit(onSubmit)}>
          <h3>New Appointment</h3>
          {apiError && <div className="error-message">{apiError}</div>}
          <div className="form-grid">
            <div className="form-group">
              <label>Patient</label>
              <select {...register('patient_id', { valueAsNumber: true })} disabled={isSubmitting}>
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatPatientName(p)}
                  </option>
                ))}
              </select>
              {errors.patient_id && <span className="field-error">{errors.patient_id.message}</span>}
            </div>
            <div className="form-group">
              <label>Doctor</label>
              <select {...register('doctor_id', { valueAsNumber: true })} disabled={isSubmitting}>
                <option value="">Select doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDoctorName(d)} - {d.specialization || d.specialty || 'General'}
                  </option>
                ))}
              </select>
              {errors.doctor_id && <span className="field-error">{errors.doctor_id.message}</span>}
            </div>
            <div className="form-group">
              <label>Date & Time</label>
              <input type="datetime-local" {...register('scheduled_at')} disabled={isSubmitting} />
              {errors.scheduled_at && <span className="field-error">{errors.scheduled_at.message}</span>}
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea {...register('notes')} rows={2} disabled={isSubmitting} />
          </div>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Scheduling...' : 'Schedule Appointment'}
          </button>
        </form>
      )}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Date & Time</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => {
              const appointmentTime = apt.appointment_time || apt.scheduled_at;
              return (
                <tr key={apt.id}>
                  <td>{formatPatientName(apt.patient)}</td>
                  <td>{formatDoctorName(apt.doctor)}</td>
                  <td>{formatDateTimeSafe(appointmentTime)}</td>
                  <td>
                    <span className={getStatusBadgeClass(apt.status)}>{apt.status}</span>
                  </td>
                  <td>{apt.notes || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
