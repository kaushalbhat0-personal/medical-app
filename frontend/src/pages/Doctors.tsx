import { useDoctors } from '../hooks';
import { formatDoctorName, formatDoctorInitials } from '../utils';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { GlobalLoader } from '../components/common/GlobalLoader';

export function Doctors() {
  // Data fetching via hook
  const { doctors, loading, error, refetch } = useDoctors();

  // Safe rendering guards - only show empty after loading completes
  const isLoading = loading;
  const isEmpty = !loading && doctors.length === 0;

  return (
    <div className="page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
          description="There are no doctors to display at the moment."
        />
      )}
      <div className="page-header">
        <h1>Doctors</h1>
        <p className="subtitle">Medical staff directory</p>
      </div>

      <div className="doctors-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
