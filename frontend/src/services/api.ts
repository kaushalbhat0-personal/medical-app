/**
 * Core API Configuration
 *
 * SECURITY NOTE: Currently using localStorage for token storage.
 * For production, migrate to httpOnly cookies to prevent XSS attacks.
 * See SECURITY.md for implementation details.
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { handleApiError, type ApiErrorResponse } from '../utils/errors';
import { cleanParams } from '../utils/api';
import { navigateTo } from '../utils/navigation';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Debug: Log API configuration
if (import.meta.env.DEV) {
  console.log('[API] Base URL:', API_BASE_URL);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach auth token + clean params + dev logging
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Log request details in dev mode
    if (import.meta.env.DEV) {
      console.log('API REQUEST:', {
        url: config.url,
        method: config.method,
        params: config.params,
        data: config.data,
      });
    }

    const token = localStorage.getItem('token');
    if (import.meta.env.DEV) {
      console.log('TOKEN:', token ? `${token.substring(0, 15)}...` : 'none');
    }
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // GLOBAL FIX: Clean params to prevent FastAPI 422 errors from empty strings
    if (config.params) {
      config.params = cleanParams(config.params);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors and common error cases
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Debug: Log error details
    console.error('API ERROR:', error.response?.data || error.message);

    // Extract error message from response
    const data = error.response?.data as { detail?: string; message?: string; errors?: string[] } | undefined;
    const message =
      data?.detail ||
      data?.message ||
      data?.errors?.[0] ||
      handleApiError(error as AxiosError<ApiErrorResponse>);

    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      // Prevent redirect loops if already on login page
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        toast.error('Session expired. Please log in again.');
        navigateTo('/login');
      }
      return Promise.reject(error.response?.data || error);
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      toast.error('Access denied. You do not have permission.');
    }

    // Handle 404 Not Found
    else if (error.response?.status === 404) {
      toast.error('Resource not found.');
    }

    // Handle validation errors (422)
    else if (error.response?.status === 422) {
      toast.error(message);
    }

    // Handle 500+ Server errors
    else if (error.response?.status && error.response.status >= 500) {
      toast.error('Server error. Please try again later.');
    }

    // Handle network errors (no response)
    else if (error.request && !error.response) {
      toast.error('Network error. Please check your connection.');
    }

    // Generic fallback for other errors
    else if (![400, 409].includes(error.response?.status || 0)) {
      toast.error(message);
    }

    // Return clean error data for consistent error handling
    return Promise.reject(error.response?.data || error);
  }
);
