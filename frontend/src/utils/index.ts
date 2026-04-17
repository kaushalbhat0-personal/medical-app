export { extractErrorMessage, handleApiError, logError, type ApiErrorResponse } from './errors';
export {
  formatDate,
  formatDateTime,
  formatTime,
  isPastDate,
  isToday,
  getRelativeTime,
  parseDate,
} from './date';

/**
 * Safely extract array from API response
 * Handles multiple response shapes: direct array, { data: array }, { detail: error }, etc.
 */
export const safeArray = <T = unknown>(res: unknown): T[] => {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object' && 'data' in res && Array.isArray((res as { data: unknown }).data)) {
    return (res as { data: T[] }).data;
  }
  // Log warning in development
  if (import.meta.env.DEV) {
    console.warn('[safeArray] Expected array but received:', res);
  }
  return [];
};

/**
 * Safely extract object from API response
 * Handles multiple response shapes: direct object, { data: object }, etc.
 */
export const safeObject = <T = Record<string, unknown>>(res: unknown): T | null => {
  if (!res) return null;
  if (typeof res === 'object' && !Array.isArray(res)) return res as T;
  if (res && typeof res === 'object' && 'data' in res && typeof (res as { data: unknown }).data === 'object') {
    return (res as { data: T }).data;
  }
  return null;
};
