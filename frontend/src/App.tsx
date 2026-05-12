import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { PatientCareHub } from './pages/patient/PatientCareHub';
import { PatientDiscover } from './pages/patient/PatientDiscover';
import { PatientProfile } from './pages/patient/PatientProfile';
import { PatientProfileSettings } from './pages/patient/PatientProfileSettings';

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
import { PatientAppointments } from './pages/patient/PatientAppointments';
import { PatientBills } from './pages/patient/PatientBills';
import { PatientDoctorDetail } from './pages/patient/PatientDoctorDetail';
import { PatientHealthTimeline } from './pages/patient/PatientHealthTimeline';
import { PatientEncounterDetail } from './pages/patient/PatientEncounterDetail';
import { PatientVitalsHistory } from './pages/patient/PatientVitalsHistory';
import { PatientFollowUps } from './pages/patient/PatientFollowUps';
import { PatientCommunicationCenter } from './pages/patient/PatientCommunicationCenter';
import { PatientDocuments } from './pages/patient/PatientDocuments';
import { PatientMedicines } from './pages/patient/PatientMedicines';

import { DoctorHome } from './pages/doctor/DoctorHome';
import { DoctorDoctorsPage } from './pages/doctor/DoctorDoctorsPage';
import { DoctorPatientsPage } from './pages/doctor/DoctorPatientsPage';
import { DoctorPatientDetailPage } from './pages/doctor/DoctorPatientDetailPage';
import { DoctorAppointmentsPage } from './pages/doctor/DoctorAppointmentsPage';
import { EncounterWorkspacePage } from './pages/doctor/EncounterWorkspacePage';
import { DoctorBillsPage } from './pages/doctor/DoctorBillsPage';
import { DoctorBillDetailPage } from './pages/doctor/DoctorBillDetailPage';
import { DoctorAvailabilityPage } from './pages/doctor/DoctorAvailabilityPage';
import { PatientInventory } from './pages/doctor/PatientInventory';
import { AdminInventoryPage } from './pages/InventoryPage';
import { AdminTenantsPage } from './pages/AdminTenantsPage';
import { AdminDoctorVerificationsPage } from './pages/AdminDoctorVerificationsPage';
import AdminBrandingPage from './pages/AdminBrandingPage';
import AdminCommunicationsPage from './pages/AdminCommunicationsPage';

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

/**
 * Redirect wrapper components for backward-compatible routes.
 * These use useParams to properly interpolate route params into the target URL,
 * avoiding the bug where literal ":appointmentId" strings were sent to the API.
 */
function RedirectEncounterDetail() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  return <Navigate to={`/patient/care/encounters/${appointmentId}`} replace />;
}

function RedirectDoctorDetail() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/patient/discover/doctor/${id}`} replace />;
}

function RedirectDoctorDetailByDoctorId() {
  const { doctorId } = useParams<{ doctorId: string }>();
  return <Navigate to={`/patient/discover/doctor/${doctorId}`} replace />;
}

function RedirectClinicDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <Navigate to={`/patient/discover/clinic/${tenantId}`} replace />;
}

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
          path="/admin/doctor-verifications"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <AppLayout user={user} onLogout={logout}>
                  <AnimatedPage>
                    <AdminDoctorVerificationsPage />
                  </AnimatedPage>
                </AppLayout>
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/branding"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <AdminRoute user={user}>
                  <AppLayout user={user} onLogout={logout}>
                    <AnimatedPage>
                      <AdminBrandingPage />
                    </AnimatedPage>
                  </AppLayout>
                </AdminRoute>
              </StaffRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/communications"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <StaffRoute user={user}>
                <AdminRoute user={user}>
                  <AppLayout user={user} onLogout={logout}>
                    <AnimatedPage>
                      <AdminCommunicationsPage />
                    </AnimatedPage>
                  </AppLayout>
                </AdminRoute>
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
          {/*
            Encounter Workspace - Future-proof clinical workspace for patient visits
            Replaces the legacy DoctorAppointmentDetailPage with encounter-centric architecture
            that supports Phase 2 clinical features (prescriptions, vitals, SOAP notes, etc.)
          */}
          <Route
            path="appointments/:appointmentId"
            element={
              <AnimatedPage>
                <EncounterWorkspacePage />
              </AnimatedPage>
            }
          />
          {/* Legacy route preserved for backward compatibility - redirects to workspace */}
          <Route
            path="encounter/:appointmentId"
            element={
              <AnimatedPage>
                <EncounterWorkspacePage />
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
                <PatientInventory />
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

          {/* ── HOME ─────────────────────────────────────────────────────── */}
          <Route
            path="home"
            element={
              <AnimatedPage>
                <PatientHome />
              </AnimatedPage>
            }
          />

          {/* ── CARE HUB ─────────────────────────────────────────────────── */}
          <Route path="care" element={<PatientCareHub />}>
            <Route index element={<Navigate to="timeline" replace />} />
            <Route
              path="timeline"
              element={
                <AnimatedPage>
                  <PatientHealthTimeline />
                </AnimatedPage>
              }
            />
            <Route
              path="medicines"
              element={
                <AnimatedPage>
                  <PatientMedicines />
                </AnimatedPage>
              }
            />
            <Route
              path="vitals"
              element={
                <AnimatedPage>
                  <PatientVitalsHistory />
                </AnimatedPage>
              }
            />
            <Route
              path="follow-ups"
              element={
                <AnimatedPage>
                  <PatientFollowUps />
                </AnimatedPage>
              }
            />
            <Route
              path="encounters/:appointmentId"
              element={
                <AnimatedPage>
                  <PatientEncounterDetail />
                </AnimatedPage>
              }
            />
          </Route>

          {/* ── MESSAGES ─────────────────────────────────────────────────── */}
          <Route
            path="messages"
            element={
              <AnimatedPage>
                <PatientCommunicationCenter />
              </AnimatedPage>
            }
          />

          {/* ── DISCOVER ─────────────────────────────────────────────────── */}
          <Route
            path="discover"
            element={
              <AnimatedPage>
                <PatientDiscover />
              </AnimatedPage>
            }
          />
          <Route
            path="discover/doctor/:id"
            element={
              <AnimatedPage>
                <PatientDoctorDetail />
              </AnimatedPage>
            }
          />
          <Route
            path="discover/clinic/:tenantId"
            element={
              <AnimatedPage>
                <PatientClinicDoctors />
              </AnimatedPage>
            }
          />

          {/* ── PROFILE ──────────────────────────────────────────────────── */}
          <Route path="profile" element={<PatientProfile />}>
            <Route index element={<Navigate to="documents" replace />} />
            <Route
              path="documents"
              element={
                <AnimatedPage>
                  <PatientDocuments />
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
            <Route
              path="appointments"
              element={
                <AnimatedPage>
                  <PatientAppointments />
                </AnimatedPage>
              }
            />
            <Route
              path="settings"
              element={
                <AnimatedPage>
                  <PatientProfileSettings />
                </AnimatedPage>
              }
            />
          </Route>

          {/* ── BACKWARD-COMPATIBLE REDIRECTS ────────────────────────────── */}
          {/* Old primary tab routes → new locations */}
          <Route path="timeline" element={<Navigate to="/patient/care/timeline" replace />} />
          <Route path="medicines" element={<Navigate to="/patient/care/medicines" replace />} />
          <Route path="vitals" element={<Navigate to="/patient/care/vitals" replace />} />
          <Route path="follow-ups" element={<Navigate to="/patient/care/follow-ups" replace />} />
          <Route path="encounters/:appointmentId" element={<RedirectEncounterDetail />} />
          <Route path="communications" element={<Navigate to="/patient/messages" replace />} />
          <Route path="doctors" element={<Navigate to="/patient/discover" replace />} />
          <Route path="doctor/:id" element={<RedirectDoctorDetail />} />
          <Route path="doctors/:doctorId" element={<RedirectDoctorDetailByDoctorId />} />
          <Route path="clinic/:tenantId" element={<RedirectClinicDetail />} />
          <Route path="documents" element={<Navigate to="/patient/profile/documents" replace />} />
          <Route path="bills" element={<Navigate to="/patient/profile/bills" replace />} />
          <Route path="appointments" element={<Navigate to="/patient/profile/appointments" replace />} />
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
