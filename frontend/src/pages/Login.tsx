import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import type { LoginCredentials } from '../types';
import { loginSchema, type LoginFormData } from '../validation';

interface LoginPageProps {
  onLogin: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
}

export function Login({ onLogin }: LoginPageProps) {
  const [apiError, setApiError] = useState('');
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setApiError('');

    // Prevent double submission
    if (isSubmitting) {
      return;
    }

    try {
      const result = await onLogin({ email: data.email, password: data.password });

      if (result.success) {
        toast.success('Welcome back!', {
          duration: 2000,
          icon: '👋',
        });
        navigate('/dashboard');
      } else {
        const errorMessage = result.error || 'Login failed. Please check your credentials and try again.';
        setApiError(errorMessage);
        toast.error(errorMessage, { duration: 5000 });
      }
    } catch (err: any) {
      const errorMessage = 'An unexpected error occurred. Please try again.';
      setApiError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="logo-large">🏥</div>
          <h1>Hospital Management System</h1>
          <p>Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="login-form">
          {apiError && (
            <div className="error-message">
              ⚠️ {apiError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              {...register('email')}
              placeholder="admin@hospital.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <span className="field-error">{errors.email.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              {...register('password')}
              placeholder="Enter your password"
              disabled={isSubmitting}
            />
            {errors.password && (
              <span className="field-error">{errors.password.message}</span>
            )}
          </div>

          <button 
            type="submit" 
            className="login-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-small" /> Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Demo credentials:</p>
          <code>admin@hospital.com / admin123</code>
        </div>
      </div>
    </div>
  );
}
