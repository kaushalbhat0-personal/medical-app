import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { setNavigator } from './utils/navigation';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Warm up backend on app load to reduce cold start latency
const warmUpBackend = async () => {
  try {
    // Use a timeout to prevent hanging if backend is down
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('[App] Backend warmed up successfully');
  } catch (err) {
    // Silently fail - this is just a warmup call
    console.log('[App] Backend warmup call failed (may be cold starting):', err);
  }
};
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AnimatedPage } from './animations';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { Doctors } from './pages/Doctors';
import { Appointments } from './pages/Appointments';
import { Billing } from './pages/Billing';

function AnimatedRoutes() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setNavigator(navigate);
  }, [navigate]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={login} />
          } 
        />
        
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MainLayout user={user} onLogout={logout}>
                <AnimatedPage>
                  <Dashboard />
                </AnimatedPage>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/patients"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MainLayout user={user} onLogout={logout}>
                <AnimatedPage>
                  <Patients />
                </AnimatedPage>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/doctors"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MainLayout user={user} onLogout={logout}>
                <AnimatedPage>
                  <Doctors />
                </AnimatedPage>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/appointments"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MainLayout user={user} onLogout={logout}>
                <AnimatedPage>
                  <Appointments />
                </AnimatedPage>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/billing"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MainLayout user={user} onLogout={logout}>
                <AnimatedPage>
                  <Billing />
                </AnimatedPage>
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  useEffect(() => {
    // Warm up backend on app load (helps with Render cold start)
    warmUpBackend();
  }, []);

  return (
    <BrowserRouter>
      <AnimatedRoutes />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
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
    </BrowserRouter>
  );
}

export default App;
