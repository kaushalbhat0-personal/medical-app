import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import debounce from 'lodash.debounce';
import { patientsApi } from '../services';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import type { Patient } from '../types';
import { patientSchema, type PatientFormData } from '../validation';

export function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [apiError, setApiError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearch(value);
      }, 400),
    []
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      medical_history: '',
    },
  });

  useEffect(() => {
    fetchPatients();
  }, [search]);

  const fetchPatients = async () => {
    try {
      setError(null);
      // Pass search as undefined if empty - global sanitizer will clean it
      const data = await patientsApi.getAll({
        search: search.trim() || undefined,
      });
      // Safe array handling - ensure we always set an array
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load patients';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: PatientFormData) => {
    setApiError('');
    try {
      await patientsApi.create(data);
      setShowForm(false);
      reset();
      fetchPatients();
    } catch {
      setApiError('Failed to create patient');
    }
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;

  if (error) {
    return (
      <ErrorState
        title="Something went wrong"
        description="Failed to load data"
        error={error}
        onRetry={fetchPatients}
      />
    );
  }

  if (!Array.isArray(patients) || patients.length === 0) {
    return (
      <EmptyState
        title="No data available"
        description="There are no patients to display at the moment."
      />
    );
  }

  return (
    <div className="page-container">
      <div className="page-header with-actions">
        <div>
          <h1>Patients</h1>
          <p className="subtitle">Manage patient records</p>
        </div>
        <button 
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
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
                  <td>
                    <strong>{patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || '-'}</strong>
                  </td>
                  <td>{patient.email || '-'}</td>
                  <td>{patient.phone || '-'}</td>
                  <td>{patient.date_of_birth && !isNaN(new Date(patient.date_of_birth).getTime()) ? new Date(patient.date_of_birth).toLocaleDateString() : (patient.age ? `${patient.age} years` : '-')}</td>
                  <td>{patient.created_at && !isNaN(new Date(patient.created_at).getTime()) ? new Date(patient.created_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
