import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { Doctors } from './pages/Doctors';
import { Appointments } from './pages/Appointments';
import { Billing } from './pages/Billing';

function App() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
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
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/patients"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MainLayout user={user} onLogout={logout}>
                <Patients />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/doctors"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MainLayout user={user} onLogout={logout}>
                <Doctors />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/appointments"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MainLayout user={user} onLogout={logout}>
                <Appointments />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/billing"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
              <MainLayout user={user} onLogout={logout}>
                <Billing />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
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
