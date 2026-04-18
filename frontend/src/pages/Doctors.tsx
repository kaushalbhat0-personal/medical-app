import { useDoctors } from '../hooks';
import { formatDoctorName, formatDoctorInitials } from '../utils';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonCard } from '../components/common/skeletons';

export function Doctors() {
  // Data fetching via hook
  const { doctors, loading, error, refetch } = useDoctors();

  // Safe rendering guards - only show empty after loading completes
  const isEmpty = !loading && doctors.length === 0;

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
          description="There are no doctors to display at the moment."
        />
      )}
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded-xl w-32 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded-lg w-48 animate-pulse" />
          </div>
        ) : (
          <>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">Doctors</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">Medical staff directory</p>
          </>
        )}
      </div>

      {/* Grid */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="flex items-start gap-4 p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="doctor-avatar flex-shrink-0">{formatDoctorInitials(doctor)}</div>
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-semibold text-gray-900 truncate">{formatDoctorName(doctor)}</h3>
                <p className="text-sm font-medium text-blue-600">
                  {doctor.specialization || doctor.specialty || 'General'}
                </p>
                <p className="text-sm text-gray-500">
                  {doctor.experience_years ? `${doctor.experience_years} years exp.` : ''}
                </p>
                <p className="text-sm text-gray-400 truncate">{doctor.user?.email || ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
