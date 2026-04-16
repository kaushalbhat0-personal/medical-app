import { useState, useEffect } from 'react';
import { dashboardApi } from '../services';
import { ErrorState } from '../components/common/ErrorState';
import type { DashboardStats } from '../types';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setError(null);
        const data = await dashboardApi.getStats();
        console.log('dashboard stats:', data);
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Stats validation
  if (!loading && stats && typeof stats !== 'object') {
    return (
      <div className="page-container">
        <ErrorState 
          title="Data Error"
          description="Invalid dashboard data received."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <h1>Dashboard</h1>
        <div className="stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card skeleton">
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <ErrorState 
          title="Failed to load dashboard"
          description="Unable to fetch dashboard statistics. Please try again."
          error={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="subtitle">Overview of your hospital's performance</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">�</div>
          <div className="stat-content">
            <h3>Total Patients</h3>
            <p className="stat-value">
              {stats?.total_patients.toLocaleString() || '0'}
            </p>
            <span className="stat-label">Registered patients</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">�‍⚕️</div>
          <div className="stat-content">
            <h3>Total Doctors</h3>
            <p className="stat-value">
              {stats?.total_doctors.toLocaleString() || '0'}
            </p>
            <span className="stat-label">Available doctors</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Today's Appointments</h3>
            <p className="stat-value">
              {stats?.today_appointments || 0}
            </p>
            <span className="stat-label">{new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Total Revenue</h3>
            <p className="stat-value">
              ${stats?.total_revenue.toLocaleString() || '0'}
            </p>
            <span className="stat-label">All time revenue</span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
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
