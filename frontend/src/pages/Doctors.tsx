import { useState, useEffect, useCallback } from 'react';
import { doctorsApi } from '../services';
import { ErrorState } from '../components/common/ErrorState';
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
      const safeData = Array.isArray(data) ? data : [];
      console.log('doctors:', safeData);
      setDoctors(safeData);
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

  // Array validation before rendering
  if (!Array.isArray(doctors)) {
    return (
      <div className="page-container">
        <ErrorState
          title="Data Error"
          description="Invalid doctor data received from server."
          onRetry={fetchDoctors}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <h1>Doctors</h1>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Doctors</h1>
        <p className="subtitle">Medical staff directory</p>
      </div>

      {error && (
        <ErrorState
          title="Failed to load doctors"
          description="Unable to fetch doctor records. Please try again."
          error={error}
          onRetry={fetchDoctors}
        />
      )}

      {doctors?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👨‍⚕️</div>
          <h3>No doctors found</h3>
          <p>Doctor list will appear here</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
