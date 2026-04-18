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
      <div className="page-header with-actions flex flex-col sm:flex-row gap-2">
        <div>
          {loading ? (
            <>
              <div className="h-8 bg-gray-200 rounded w-32 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-48 mt-2 animate-pulse" />
            </>
          ) : (
            <>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold">Patients</h1>
              <p className="subtitle">Manage patient records</p>
            </>
          )}
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Patient'}
        </button>
      </div>

      {loading && <SkeletonTable rows={5} columns={5} className="mt-4" />}

      {!loading && (
        <>
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
          <div className="form-grid grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <div className="data-table overflow-x-auto">
        <table className="min-w-full">
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
            {safePatients.map((patient) => (
              <tr key={patient?.id || Math.random()}>
                <td><strong>{formatPatientName(patient)}</strong></td>
                <td>{patient?.email || '-'}</td>
                <td>{patient?.phone || '-'}</td>
                <td>{formatPatientDobOrAge(patient)}</td>
                <td>{formatDateSafe(patient?.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}
