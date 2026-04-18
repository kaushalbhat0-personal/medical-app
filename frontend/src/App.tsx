import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { setNavigator } from './utils/navigation';
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
