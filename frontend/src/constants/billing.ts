/**
 * Billing Constants
 * Centralized constants for billing module
 */

export const BILLING_DEFAULT_PARAMS = {
  skip: 0,
  limit: 100,
};

export const EMPTY_BILL = {
  patient_id: 0,
  amount: 0,
  currency: 'INR' as const,
  description: '',
  due_date: '',
};

export const BILLING_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
] as const;

export const BILLING_STATUS_CLASSES: Record<string, string> = {
  pending: 'status-badge pending',
  paid: 'status-badge paid',
  cancelled: 'status-badge cancelled',
  refunded: 'status-badge refunded',
};

export const CURRENCIES = [
  { value: 'INR', label: 'INR' },
] as const;
