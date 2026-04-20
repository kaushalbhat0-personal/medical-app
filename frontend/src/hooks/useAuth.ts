import { useState, useEffect, useCallback } from 'react';
import type { User, LoginCredentials, LoginResponse } from '../types';
import { authApi, formatLoginError } from '../services';

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const safeParseUser = (): User | null => {
  try {
    const storedUser = localStorage.getItem('user');
    if (!storedUser || storedUser === 'undefined') return null;
    return JSON.parse(storedUser);
  } catch {
    return null;
  }
};

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = safeParseUser();

    if (import.meta.env.DEV) {
      console.log('[useAuth] Token on init:', token ? `${token.substring(0, 10)}...` : 'none');
    }

    if (token) {
      setIsAuthenticated(true);
      if (storedUser) {
        setUser(storedUser);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      if (import.meta.env.DEV) {
        console.log('[useAuth] Attempting login for:', credentials.email);
      }

      const response: LoginResponse = await authApi.login(credentials.email, credentials.password);

      if (import.meta.env.DEV) {
        console.log('[useAuth] Login response:', { hasToken: !!response.access_token, hasUser: !!response.user });
      }

      if (response.access_token) {
        localStorage.setItem('token', response.access_token);
        setIsAuthenticated(true);

        // Store user data if provided, otherwise use minimal data
        const userData = response.user || { email: credentials.email } as User;
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);

        return { success: true };
      }
      return { success: false, error: 'No access token received' };
    } catch (error) {
      const errorMessage = formatLoginError(error);
      if (import.meta.env.DEV) {
        console.error('[useAuth] Login error:', error);
      }
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    // Force redirect to login
    window.location.href = '/login';
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
};
