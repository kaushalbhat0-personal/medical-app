import { useState, useEffect } from 'react';
import { dashboardApi } from '../services';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
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
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div className="loading-spinner">Loading...</div>;

  if (error) {
    return (
      <ErrorState
        title="Something went wrong"
        description="Failed to load data"
        error={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!stats || typeof stats !== 'object') {
    return (
      <EmptyState
        title="No data available"
        description="Dashboard statistics are currently unavailable."
      />
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
