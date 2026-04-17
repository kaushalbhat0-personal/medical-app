import { useDoctors } from '../hooks';
import { formatDoctorName, formatDoctorInitials } from '../utils';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { GlobalLoader } from '../components/common/GlobalLoader';

export function Doctors() {
  // Data fetching via hook
  const { doctors, loading, error, refetch } = useDoctors();

  // Safe rendering guards
  const isEmpty = doctors.length === 0;

  return (
    <div className="page-container">
      {loading && <GlobalLoader />}

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
          description="There are no doctors to display at the moment."
        />
      )}
      <div className="page-header">
        <h1>Doctors</h1>
        <p className="subtitle">Medical staff directory</p>
      </div>

      <div className="doctors-grid">
        {doctors.map((doctor) => (
          <div key={doctor.id} className="doctor-card">
            <div className="doctor-avatar">{formatDoctorInitials(doctor)}</div>
            <div className="doctor-info">
              <h3>{formatDoctorName(doctor)}</h3>
              <p className="specialty">
                {doctor.specialization || doctor.specialty || 'General'}
              </p>
              <p className="experience">
                {doctor.experience_years ? `${doctor.experience_years} years exp.` : ''}
              </p>
              <p className="email">{doctor.user?.email || ''}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
