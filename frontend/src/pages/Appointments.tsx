import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Filter, X } from 'lucide-react';
import { appointmentsApi, patientsApi, doctorsApi } from '../services';
import { ErrorState } from '../components/common/ErrorState';
import { GlobalLoader } from '../components/common/GlobalLoader';
import type { Appointment, Patient, Doctor } from '../types';
import { appointmentSchema, type AppointmentFormData } from '../validation';

export function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [apiError, setApiError] = useState('');
  
  // Filter states
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<'scheduled' | 'completed' | 'cancelled' | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patient_id: 0,
      doctor_id: 0,
      scheduled_at: '',
      notes: '',
    },
  });

  // Fetch data with filters
  const fetchData = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      
      const filters = {
        doctor_id: filterDoctor || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        status: filterStatus || undefined,
        limit: 100,
      };
      
      const [appointmentsData, patientsData, doctorsData] = await Promise.all([
        appointmentsApi.getAll(filters),
        patientsApi.getAll(),
        doctorsApi.getAll(),
      ]);
      
      // Safe array handling - ensure we always set arrays
      const safeAppointments = Array.isArray(appointmentsData) ? appointmentsData : [];
      const safePatients = Array.isArray(patientsData) ? patientsData : [];
      const safeDoctors = Array.isArray(doctorsData) ? doctorsData : [];
      
      console.log('appointments:', safeAppointments);
      console.log('patients:', safePatients);
      console.log('doctors:', safeDoctors);
      
      setAppointments(safeAppointments);
      setPatients(safePatients);
      setDoctors(safeDoctors);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load appointments';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filterDoctor, filterDateFrom, filterDateTo, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearFilters = () => {
    setFilterDoctor('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('');
  };
  
  const hasActiveFilters = filterDoctor || filterDateFrom || filterDateTo || filterStatus;

  const onSubmit = async (data: AppointmentFormData) => {
    setApiError('');
    try {
      setLoading(true);
      await appointmentsApi.create(data);
      setShowForm(false);
      reset();
      await fetchData();
    } catch {
      setApiError('Failed to create appointment');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      scheduled: 'status-badge scheduled',
      completed: 'status-badge completed',
      cancelled: 'status-badge cancelled',
    };
    return <span className={statusClasses[status] || 'status-badge'}>{status}</span>;
  };

  // Array validation before rendering
  if (!Array.isArray(appointments) || !Array.isArray(patients) || !Array.isArray(doctors)) {
    return (
      <div className="page-container">
        <ErrorState 
          title="Data Error"
          description="Invalid data received from server."
          onRetry={fetchData}
        />
      </div>
    );
  }

  if (loading && appointments.length === 0) {
    return (
      <div className="page-container relative min-h-[400px]">
        <h1>Appointments</h1>
        <GlobalLoader message="Loading appointments..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <ErrorState 
          title="Failed to load appointments"
          description="Unable to fetch appointment records. Please try again."
          error={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

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
            disabled={loading}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters {hasActiveFilters && '(Active)'}
          </button>
          <button 
            className="btn-primary"
            onClick={() => setShowForm(!showForm)}
            disabled={loading}
          >
            {showForm ? 'Cancel' : '+ New Appointment'}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Doctor</label>
              <select 
                value={filterDoctor} 
                onChange={(e) => setFilterDoctor(e.target.value)}
                disabled={loading}
              >
                <option value="">All Doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || d.user?.full_name || 'Unknown'} - {d.specialization || d.specialty || 'General'}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>From Date</label>
              <input 
                type="date" 
                value={filterDateFrom} 
                onChange={(e) => setFilterDateFrom(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="filter-group">
              <label>To Date</label>
              <input 
                type="date" 
                value={filterDateTo} 
                onChange={(e) => setFilterDateTo(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="filter-group">
              <label>Status</label>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                disabled={loading}
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
              onClick={fetchData}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Apply Filters'}
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
                <option value="0">Select patient</option>
                {patients?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown'}</option>
                ))}
              </select>
              {errors.patient_id && <span className="field-error">{errors.patient_id.message}</span>}
            </div>
            <div className="form-group">
              <label>Doctor</label>
              <select {...register('doctor_id', { valueAsNumber: true })} disabled={isSubmitting}>
                <option value="0">Select doctor</option>
                {doctors?.map((d) => (
                  <option key={d.id} value={d.id}>{d.name || d.user?.full_name || 'Unknown'} - {d.specialization || d.specialty || 'General'}</option>
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

      {error && <div className="error-message">{error}</div>}

      {appointments?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No appointments scheduled</h3>
          <p>Create your first appointment to get started</p>
        </div>
      ) : (
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
              {appointments?.map((apt) => {
                const appointmentTime = apt.appointment_time || apt.scheduled_at;
                const isValidDate = appointmentTime && !isNaN(new Date(appointmentTime).getTime());
                return (
                  <tr key={apt.id}>
                    <td>{apt.patient?.name}</td>
                    <td>{apt.doctor?.name}</td>
                    <td>{isValidDate ? new Date(appointmentTime).toLocaleString() : '-'}</td>
                    <td>{getStatusBadge(apt.status)}</td>
                    <td>{apt.notes || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
