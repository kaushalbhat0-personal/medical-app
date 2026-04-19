import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../hooks';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonCard } from '../components/common/skeletons';
import { FadeContent, staggerContainer, staggerItem } from '../animations';

export function Dashboard() {
  const navigate = useNavigate();

  // Data fetching via hook
  const { stats, loading, error, refetch } = useDashboard();

  // Quick action navigation handlers
  const handleAddPatient = () => navigate('/patients', { state: { showForm: true } });
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
            <div className="h-8 bg-gray-200 rounded-xl w-48 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded-lg w-64 animate-pulse" />
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
              <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">Dashboard</h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1">Overview of your hospital's performance</p>
            </div>

            {/* Stats Grid */}
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <motion.div
                className="flex items-center gap-4 p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm"
                variants={staggerItem}
              >
                <div className="stat-icon">👤</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-500">Total Patients</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                    {(stats?.total_patients ?? 0).toLocaleString()}
                  </p>
                  <span className="text-xs sm:text-sm text-gray-400">Registered patients</span>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-4 p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm"
                variants={staggerItem}
              >
                <div className="stat-icon">👨‍⚕️</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-500">Total Doctors</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                    {(stats?.total_doctors ?? 0).toLocaleString()}
                  </p>
                  <span className="text-xs sm:text-sm text-gray-400">Available doctors</span>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-4 p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm"
                variants={staggerItem}
              >
                <div className="stat-icon">📅</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-500">Today's Appointments</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                    {stats?.today_appointments ?? 0}
                  </p>
                  <span className="text-xs sm:text-sm text-gray-400">{new Date().toLocaleDateString()}</span>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-4 p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm"
                variants={staggerItem}
              >
                <div className="stat-icon">💰</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                    ${(stats?.total_revenue ?? 0).toLocaleString()}
                  </p>
                  <span className="text-xs sm:text-sm text-gray-400">All time revenue</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="pt-2"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <motion.button
                  onClick={handleAddPatient}
                  className="min-h-[44px] px-4 py-3 inline-flex items-center justify-center sm:justify-start gap-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-all duration-200 cursor-pointer"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-lg">👤</span>
                  Add Patient
                </motion.button>
                <motion.button
                  onClick={handleNewAppointment}
                  className="min-h-[44px] px-4 py-3 inline-flex items-center justify-center sm:justify-start gap-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-all duration-200 cursor-pointer"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-lg">📅</span>
                  New Appointment
                </motion.button>
                <motion.button
                  onClick={handleCreateBill}
                  className="min-h-[44px] px-4 py-3 inline-flex items-center justify-center sm:justify-start gap-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-all duration-200 cursor-pointer"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-lg">🧾</span>
                  Create Bill
                </motion.button>
              </div>
            </motion.div>
          </div>
        </FadeContent>
      )}
    </div>
  );
}
