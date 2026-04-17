import { useState, useEffect, useCallback } from 'react';
import { doctorsApi } from '../services';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import type { Doctor } from '../types';

export function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDoctors = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const data = await doctorsApi.getAll();
      // Safe array handling - ensure we always set an array
      setDoctors(Array.isArray(data) ? data : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load doctors';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  if (loading) return <div className="loading-spinner">Loading...</div>;

  if (error) {
    return (
      <ErrorState
        title="Something went wrong"
        description="Failed to load data"
        error={error}
        onRetry={fetchDoctors}
      />
    );
  }

  if (!Array.isArray(doctors) || doctors.length === 0) {
    return (
      <EmptyState
        title="No data available"
        description="There are no doctors to display at the moment."
      />
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Doctors</h1>
        <p className="subtitle">Medical staff directory</p>
      </div>

      <div className="doctors-grid">
          {doctors?.map((doctor) => (
            <div key={doctor.id} className="doctor-card">
              <div className="doctor-avatar">
                {(doctor.name || doctor.user?.full_name || 'D').charAt(0).toUpperCase()}
              </div>
              <div className="doctor-info">
                <h3>{doctor.name || doctor.user?.full_name || 'Unknown Doctor'}</h3>
                <p className="specialty">{doctor.specialization || doctor.specialty || 'General'}</p>
                <p className="experience">{doctor.experience_years ? `${doctor.experience_years} years exp.` : ''}</p>
                <p className="email">{doctor.user?.email || ''}</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
