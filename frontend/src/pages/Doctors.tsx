import { useState, useEffect } from 'react';
import { doctorsApi } from '../services';
import type { Doctor } from '../types';

export function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const data = await doctorsApi.getAll();
        // Handle both { data: [...] } and direct array responses
        const doctorsData = Array.isArray(data) ? data : data?.data || [];
        setDoctors(doctorsData);
      } catch {
        setError('Failed to load doctors');
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  if (!doctors) {
    return (
      <div className="page-container">
        <h1>Doctors</h1>
        <div className="loading-spinner">Loading...</div>
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

      {error && <div className="error-message">{error}</div>}

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
