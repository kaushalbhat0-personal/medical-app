import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../hooks';
import { ErrorState, EmptyState, Button, Card } from '../components/common';
import { SkeletonCard } from '../components/common/skeletons';
import { FadeContent, staggerContainer, staggerItem } from '../animations';

export function Dashboard() {
  const navigate = useNavigate();

  // Data fetching via hook
  const { stats, loading, error, refetch } = useDashboard();

  // Quick action navigation handlers
  const handleAddPatient = () => navigate('/patients', { state: { showForm: true } });
  const handleAddDoctor = () => navigate('/doctors', { state: { showForm: true } });
  const handleNewAppointment = () => navigate('/appointments', { state: { showForm: true } });
  const handleCreateBill = () => navigate('/billing', { state: { showForm: true } });

  // Show skeletons only during initial data fetch (when still loading and no valid data yet)
  // Prevents flicker by checking loading state first
  const showSkeletons = loading && !error;

  // Empty state: data loaded successfully but all counts are zero
  const isEmpty =
    !loading &&
    !error &&
    stats.total_patients === 0 &&
    stats.total_doctors === 0;

  return (
    <div className="page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {showSkeletons && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-6 sm:space-y-8"
        >
          <div className="space-y-2">
            <div className="h-8 bg-surface rounded-xl w-48 animate-pulse" />
            <div className="h-4 bg-surface rounded-lg w-64 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </motion.div>
      )}

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

      {!error && !showSkeletons && (
        <FadeContent show={!showSkeletons}>
          <div className="space-y-6 sm:space-y-8">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-text-primary">Dashboard</h1>
              <p className="text-sm sm:text-base text-text-secondary mt-1">Overview of your hospital's performance</p>
            </div>

            {/* Stats Grid */}
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <motion.div variants={staggerItem}>
                <Card padding="md" className="flex items-center gap-4 hover:border-border-light transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                    👤
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-secondary">Total Patients</h3>
                    <p className="text-2xl sm:text-3xl font-bold text-text-primary mt-1">
                      {(stats?.total_patients ?? 0).toLocaleString()}
                    </p>
                    <span className="text-xs sm:text-sm text-text-muted">Registered patients</span>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={staggerItem}>
                <Card padding="md" className="flex items-center gap-4 hover:border-border-light transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                    👨‍⚕️
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-secondary">Total Doctors</h3>
                    <p className="text-2xl sm:text-3xl font-bold text-text-primary mt-1">
                      {(stats?.total_doctors ?? 0).toLocaleString()}
                    </p>
                    <span className="text-xs sm:text-sm text-text-muted">Available doctors</span>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={staggerItem}>
                <Card padding="md" className="flex items-center gap-4 hover:border-border-light transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                    📅
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-secondary">Today's Appointments</h3>
                    <p className="text-2xl sm:text-3xl font-bold text-text-primary mt-1">
                      {stats?.today_appointments ?? 0}
                    </p>
                    <span className="text-xs sm:text-sm text-text-muted">{new Date().toLocaleDateString()}</span>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={staggerItem}>
                <Card padding="md" className="flex items-center gap-4 hover:border-border-light transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                    💰
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-secondary">Total Revenue</h3>
                    <p className="text-2xl sm:text-3xl font-bold text-text-primary mt-1">
                      ${(stats?.total_revenue ?? 0).toLocaleString()}
                    </p>
                    <span className="text-xs sm:text-sm text-text-muted">All time revenue</span>
                  </div>
                </Card>
              </motion.div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="pt-2"
            >
              <h2 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h2>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  variant="secondary"
                  onClick={handleAddPatient}
                  leftIcon={<span className="text-lg">👤</span>}
                >
                  Add Patient
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleAddDoctor}
                  leftIcon={<span className="text-lg">👨‍⚕️</span>}
                >
                  Add Doctor
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleNewAppointment}
                  leftIcon={<span className="text-lg">📅</span>}
                >
                  New Appointment
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCreateBill}
                  leftIcon={<span className="text-lg">🧾</span>}
                >
                  Create Bill
                </Button>
              </div>
            </motion.div>
          </div>
        </FadeContent>
      )}
    </div>
  );
}
