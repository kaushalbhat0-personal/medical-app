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

// Request interceptor - attach auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      // Debug: Log token being sent (mask most of it)
      if (import.meta.env.DEV) {
        console.log('[API] Sending request with token:', `${token.substring(0, 10)}...`);
      }
    } else if (import.meta.env.DEV) {
      console.log('[API] No token found for request to:', config.url);
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
        window.location.href = '/login';
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
