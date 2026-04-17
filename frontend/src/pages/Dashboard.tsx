import { useDashboard } from '../hooks';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { GlobalLoader } from '../components/common/GlobalLoader';

export function Dashboard() {
  // Data fetching via hook
  const { stats, loading, error, refetch } = useDashboard();

  // Show loader only during initial data fetch (when data is null)
  // Don't show loader on refetch or when we have cached data
  const showLoader = loading && !stats;

  // Empty state: data loaded successfully but all counts are zero
  const isEmpty =
    !loading &&
    !error &&
    stats.total_patients === 0 &&
    stats.total_doctors === 0;

  return (
    <div className="page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {showLoader && <GlobalLoader />}

      {error && (
        <ErrorState
          title="Failed to load dashboard"
          description="Unable to fetch dashboard statistics. Please try again."
          error={error}
          onRetry={refetch}
        />
      )}

      {!error && !loading && isEmpty && (
        <EmptyState
          title="No data available"
          description="Dashboard statistics are currently empty. Add patients, doctors, or appointments to see data here."
        />
      )}

      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="subtitle">Overview of your hospital's performance</p>
      </div>

      <div className="stats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div className="stat-content">
            <h3>Total Patients</h3>
            <p className="stat-value">
              {(stats?.total_patients ?? 0).toLocaleString()}
            </p>
            <span className="stat-label">Registered patients</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👨‍⚕️</div>
          <div className="stat-content">
            <h3>Total Doctors</h3>
            <p className="stat-value">
              {(stats?.total_doctors ?? 0).toLocaleString()}
            </p>
            <span className="stat-label">Available doctors</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Today's Appointments</h3>
            <p className="stat-value">
              {stats?.today_appointments ?? 0}
            </p>
            <span className="stat-label">{new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Total Revenue</h3>
            <p className="stat-value">
              ${(stats?.total_revenue ?? 0).toLocaleString()}
            </p>
            <span className="stat-label">All time revenue</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-buttons flex flex-col sm:flex-row gap-2">
          <a href="/patients/new" className="action-btn">
            <span>👤</span>
            Add Patient
          </a>
          <a href="/appointments/new" className="action-btn">
            <span>📅</span>
            New Appointment
          </a>
          <a href="/billing/new" className="action-btn">
            <span>🧾</span>
            Create Bill
          </a>
        </div>
      </div>
    </div>
  );
}
