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
import { GlobalLoader } from '../components/common/GlobalLoader';
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
      setShowForm(false);
      reset();
      refetch();
    } catch {
      setApiError('Failed to create patient');
    }
  };

  // Safe rendering guards - only show empty after loading completes
  const isLoading = loading;
  const isEmpty = !loading && patients.length === 0;

  return (
    <div className="page-container">
      {isLoading && <GlobalLoader />}

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
      <div className="page-header with-actions">
        <div>
          <h1>Patients</h1>
          <p className="subtitle">Manage patient records</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Patient'}
        </button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search patients..."
          value={searchInput}
          onChange={(e) => {
            const value = e.target.value;
            setSearchInput(value);
            debouncedSearch(value);
          }}
          className="search-input"
        />
      </div>

      {showForm && (
        <form className="create-form" onSubmit={handleSubmit(onSubmit)}>
          <h3>New Patient</h3>
          {apiError && <div className="error-message">{apiError}</div>}
          <div className="form-grid">
            <div className="form-group">
              <label>First Name</label>
              <input {...register('first_name')} disabled={isSubmitting} />
              {errors.first_name && <span className="field-error">{errors.first_name.message}</span>}
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input {...register('last_name')} disabled={isSubmitting} />
              {errors.last_name && <span className="field-error">{errors.last_name.message}</span>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" {...register('email')} disabled={isSubmitting} />
              {errors.email && <span className="field-error">{errors.email.message}</span>}
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input {...register('phone')} disabled={isSubmitting} />
              {errors.phone && <span className="field-error">{errors.phone.message}</span>}
            </div>
            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" {...register('date_of_birth')} disabled={isSubmitting} />
              {errors.date_of_birth && <span className="field-error">{errors.date_of_birth.message}</span>}
            </div>
          </div>
          <div className="form-group">
            <label>Medical History</label>
            <textarea {...register('medical_history')} rows={3} disabled={isSubmitting} />
          </div>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Patient'}
          </button>
        </form>
      )}

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>DOB / Age</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td><strong>{formatPatientName(patient)}</strong></td>
                <td>{patient.email || '-'}</td>
                <td>{patient.phone || '-'}</td>
                <td>{formatPatientDobOrAge(patient)}</td>
                <td>{formatDateSafe(patient.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
