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

    // Handle network errors (no response) - CRITICAL: Do NOT logout on network errors
    if (error.request && !error.response) {
      // This is likely a Render cold start or network issue, NOT an auth failure
      const isColdStart = error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !navigator.onLine;
      if (isColdStart) {
        console.log('[API] Cold start or network issue detected, not logging out');
      }
      // Return special error object that components can detect
      return Promise.reject({
        __networkError: true,
        __coldStart: isColdStart,
        message: 'Server is waking up, please wait...',
        originalError: error,
      });
    }

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

    // Generic fallback for other errors
    else if (![400, 409].includes(error.response?.status || 0)) {
      toast.error(message);
    }

    // Return clean error data for consistent error handling
    return Promise.reject(error.response?.data || error);
  }
);

// Retry utility for handling Render cold starts
export const retryRequest = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 2000
): Promise<T> => {
  try {
    return await fn();
  } catch (err: any) {
    // Only retry on network errors (cold start), not on 4xx/5xx responses
    const isNetworkError = err?.__networkError || (!err?.response && err?.request);

    if (retries > 0 && isNetworkError) {
      console.log(`[API] Retrying request, ${retries} attempts left...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryRequest(fn, retries - 1, delay);
    }

    throw err;
  }
};

// Helper to check if error is a network/cold start error
export const isNetworkError = (error: any): boolean => {
  return error?.__networkError === true || (!error?.response && error?.request);
};

// Helper to check if error is a cold start error
export const isColdStartError = (error: any): boolean => {
  return error?.__coldStart === true || error?.code === 'ECONNABORTED';
};
