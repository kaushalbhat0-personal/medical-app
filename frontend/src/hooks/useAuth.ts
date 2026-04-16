import { useState, useEffect, useCallback } from 'react';
import type { User, LoginCredentials, LoginResponse } from '../types';
import { authApi } from '../services';

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
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

    if (token) {
      setIsAuthenticated(true);
      if (storedUser) {
        setUser(storedUser);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response: LoginResponse = await authApi.login(credentials.email, credentials.password);

      if (response.access_token) {
        localStorage.setItem('token', response.access_token);
        setIsAuthenticated(true);

        // Only store user if backend returns it
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
          setUser(response.user);
        }

        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
};
