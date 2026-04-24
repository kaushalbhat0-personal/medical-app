import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { AppModeProvider } from './contexts/AppModeContext';
import { initDoctorSlotsCacheCrossTabSync } from './services';
import { setNavigator } from './utils/navigation';
import { getEffectiveRoles, postLoginHomePath } from './utils/roles';
import AppLayout from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { SuperAdminRoute } from './components/layout/SuperAdminRoute';
import { StaffRoute } from './components/layout/StaffRoute';
import { PatientRoute } from './components/layout/PatientRoute';
import { PatientLayout } from './components/layout/PatientLayout';
import { DoctorLayout } from './components/layout/DoctorLayout';
import { DoctorRoute } from './components/layout/DoctorRoute';
import { AnimatedPage } from './animations';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { Patients } from './pages/Patients';
import { Doctors } from './pages/Doctors';
import { Appointments } from './pages/Appointments';
import { Billing } from './pages/Billing';
import { PatientHome } from './pages/patient/PatientHome';
import { PatientClinicDoctors } from './pages/patient/PatientClinicDoctors';
import { PatientDoctors } from './pages/patient/PatientDoctors';
import { PatientAppointments } from './pages/patient/PatientAppointments';
import { PatientBills } from './pages/patient/PatientBills';
import { PatientDoctorDetail } from './pages/patient/PatientDoctorDetail';
import { DoctorHome } from './pages/doctor/DoctorHome';
import { DoctorDoctorsPage } from './pages/doctor/DoctorDoctorsPage';
import { DoctorPatientsPage } from './pages/doctor/DoctorPatientsPage';
import { DoctorPatientDetailPage } from './pages/doctor/DoctorPatientDetailPage';
import { DoctorAppointmentsPage } from './pages/doctor/DoctorAppointmentsPage';
import { DoctorAppointmentDetailPage } from './pages/doctor/DoctorAppointmentDetailPage';
import { DoctorBillsPage } from './pages/doctor/DoctorBillsPage';
import { DoctorBillDetailPage } from './pages/doctor/DoctorBillDetailPage';
import { DoctorAvailabilityPage } from './pages/doctor/DoctorAvailabilityPage';
import { AdminInventoryPage, DoctorInventoryPage } from './pages/InventoryPage';
import { AdminTenantsPage } from './pages/AdminTenantsPage';
import { Signup } from './pages/Signup';
import { SignupPatient } from './pages/SignupPatient';
import { SignupDoctor } from './pages/SignupDoctor';
import { SignupHospital } from './pages/SignupHospital';
import { ResetPassword } from './pages/ResetPassword';
import { ClinicOnboardingPage } from './pages/doctor/ClinicOnboardingPage';
import { CompleteProfilePage } from './pages/doctor/CompleteProfilePage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const warmUpBackend = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('[App] Backend warmed up successfully');
  } catch (err) {
    console.log('[App] Backend warmup call failed (may be cold starting):', err);
  }
};

function AnimatedRoutes() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setNavigator(navigate);
  }, [navigate]);

  const effectiveRoles = getEffectiveRoles(user, localStorage.getItem('token'));
  const needsPasswordReset = user?.force_password_reset === true;
  const loginRedirect = needsPasswordReset
    ? '/reset-password'
    : postLoginHomePath(effectiveRoles, user);

  if (
    !isLoading &&
    isAuthenticated &&
    needsPasswordReset &&
    location.pathname !== '/reset-password'
  ) {
    return <Navigate to="/reset-password" replace />;
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            isLoading ? (
              <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
                <div className="spinner" />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            ) : isAuthenticated ? (
              <Navigate to={loginRedirect} replace />
            ) : (
              <Login onLogin={login} />
            )
          }
        />

        <Route
          path="/signup"
          element={
            isLoading ? (
              <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
                <div className="spinner" />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            ) : isAuthenticated ? (
              <Navigate to={loginRedirect} replace />
            ) : (
              <Signup />
            )
          }
        />

        <Route
          path="/signup/patient"
          element={
            isLoading ? (
              <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
                <div className="spinner" />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            ) : isAuthenticated ? (
              <Navigate to={loginRedirect} replace />
            ) : (
              <SignupPatient />
            )
          }
        />

        <Route
          path="/signup/doctor"
          element={
            isLoading ? (
              <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
                <div className="spinner" />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            ) : isAuthenticated ? (
              <Navigate to={loginRedirect} replace />
            ) : (
              <SignupDoctor />
            )
          }
        />

        <Route
          path="/signup/hospital"
          element={
            isLoading ? (
              <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
                <div className="spinner" />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            ) : isAuthenticated ? (
              <Navigate to={loginRedirect} replace />
            ) : (
              <SignupHospital />
            )
          }
        />

        <Route
          path="/reset-password"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              {isAuthenticated && !needsPasswordReset ? (
                <Navigate to={postLoginHomePath(effectiveRoles, user)} replace />
              ) : (
                <ResetPassword />
              )}
            </ProtectedRoute>
          }
        />

        <Route
          path="/complete-profile"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <CompleteProfilePage />
            </ProtectedRoute>
          }
        />

        <Route path="/create-tenant" element={<Navigate to="/onboarding/clinic" replace />} />

        <Route
          path="/onboarding/clinic"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <DoctorRoute user={user}>
                <AnimatedPage>
                  <ClinicOnboardingPage />
                </AnimatedPage>
              </DoctorRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <AppLayout user={user} onLogout={logout}>
                  <AnimatedPage>
                    <Dashboard />
                  </AnimatedPage>
                </AppLayout>
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <AdminRoute user={user}>
                  <AppLayout user={user} onLogout={logout}>
                    <AnimatedPage>
                      <AdminDashboard />
                    </AnimatedPage>
                  </AppLayout>
                </AdminRoute>
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/inventory"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <AdminRoute user={user}>
                  <AppLayout user={user} onLogout={logout}>
                    <AnimatedPage>
                      <AdminInventoryPage />
                    </AnimatedPage>
                  </AppLayout>
                </AdminRoute>
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/tenants"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <SuperAdminRoute user={user}>
                  <AppLayout user={user} onLogout={logout}>
                    <AnimatedPage>
                      <AdminTenantsPage />
                    </AnimatedPage>
                  </AppLayout>
                </SuperAdminRoute>
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patients"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <AppLayout user={user} onLogout={logout}>
                  <AnimatedPage>
                    <Patients />
                  </AnimatedPage>
                </AppLayout>
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctors"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <AppLayout user={user} onLogout={logout}>
                  <AnimatedPage>
                    <Doctors />
                  </AnimatedPage>
                </AppLayout>
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/appointments"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <AppLayout user={user} onLogout={logout}>
                  <AnimatedPage>
                    <Appointments />
                  </AnimatedPage>
                </AppLayout>
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <AppLayout user={user} onLogout={logout}>
                  <AnimatedPage>
                    <Billing />
                  </AnimatedPage>
                </AppLayout>
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <DoctorRoute user={user}>
                <DoctorLayout />
              </DoctorRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="home" element={<Navigate to="/doctor/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <AnimatedPage>
                <DoctorHome />
              </AnimatedPage>
            }
          />
          <Route
            path="doctors"
            element={
              <AnimatedPage>
                <DoctorDoctorsPage />
              </AnimatedPage>
            }
          />
          <Route
            path="patients"
            element={
              <AnimatedPage>
                <DoctorPatientsPage />
              </AnimatedPage>
            }
          />
          <Route
            path="patients/:id"
            element={
              <AnimatedPage>
                <DoctorPatientDetailPage />
              </AnimatedPage>
            }
          />
          <Route
            path="appointments/:appointmentId"
            element={
              <AnimatedPage>
                <DoctorAppointmentDetailPage />
              </AnimatedPage>
            }
          />
          <Route
            path="appointments"
            element={
              <AnimatedPage>
                <DoctorAppointmentsPage />
              </AnimatedPage>
            }
          />
          <Route
            path="bills/:billId"
            element={
              <AnimatedPage>
                <DoctorBillDetailPage />
              </AnimatedPage>
            }
          />
          <Route
            path="bills"
            element={
              <AnimatedPage>
                <DoctorBillsPage />
              </AnimatedPage>
            }
          />
          <Route
            path="availability"
            element={
              <AnimatedPage>
                <DoctorAvailabilityPage />
              </AnimatedPage>
            }
          />
          <Route
            path="inventory"
            element={
              <AnimatedPage>
                <DoctorInventoryPage />
              </AnimatedPage>
            }
          />
        </Route>

        <Route
          path="/patient"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <PatientRoute user={user}>
                <PatientLayout />
              </PatientRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route
            path="home"
            element={
              <AnimatedPage>
                <PatientHome />
              </AnimatedPage>
            }
          />
          <Route
            path="clinic/:tenantId"
            element={
              <AnimatedPage>
                <PatientClinicDoctors />
              </AnimatedPage>
            }
          />
          <Route
            path="doctors"
            element={
              <AnimatedPage>
                <PatientDoctors />
              </AnimatedPage>
            }
          />
          <Route
            path="doctor/:id"
            element={
              <AnimatedPage>
                <PatientDoctorDetail />
              </AnimatedPage>
            }
          />
          <Route
            path="appointments"
            element={
              <AnimatedPage>
                <PatientAppointments />
              </AnimatedPage>
            }
          />
          <Route
            path="bills"
            element={
              <AnimatedPage>
                <PatientBills />
              </AnimatedPage>
            }
          />
        </Route>

        <Route
          path="/"
          element={
            isLoading ? (
              <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
                <div className="spinner" />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            ) : (
              <Navigate to={isAuthenticated ? loginRedirect : '/login'} replace />
            )
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  useEffect(() => {
    warmUpBackend();
  }, []);
  useEffect(() => {
    return initDoctorSlotsCacheCrossTabSync();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppModeProvider>
          <AnimatedRoutes />
        </AppModeProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.08)',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981',
                secondary: 'white',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#EF4444',
                secondary: 'white',
              },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
