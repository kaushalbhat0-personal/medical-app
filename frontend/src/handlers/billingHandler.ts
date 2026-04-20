/**
 * Billing Handler
 * Business logic for billing operations
 */

import { billingApi, patientsApi } from '../services';
import { BILLING_DEFAULT_PARAMS } from '../constants';
import { safeArray } from '../utils';
import type { Bill, Patient } from '../types';
import type { BillingFormData } from '../validation';

export interface BillingDataResult {
  bills: Bill[];
  patients: Patient[];
}

/**
 * Fetch bills and patients for dropdown
 */
export const fetchBillingDataHandler = async (): Promise<BillingDataResult> => {
  const [billsData, patientsData] = await Promise.all([
    billingApi.getAll(BILLING_DEFAULT_PARAMS),
    patientsApi.getAll(),
  ]);

  return {
    bills: safeArray<Bill>(billsData),
    patients: safeArray<Patient>(patientsData),
  };
};

/**
 * Create a new bill
 */
export const createBillHandler = async (data: BillingFormData): Promise<void> => {
  // Convert date to ISO format for API (or keep as YYYY-MM-DD based on API expectations)
  // For due_date, typically APIs expect YYYY-MM-DD or full ISO string
  const dueDate = new Date(data.due_date);

  // Ensure proper data types and format for API
  // patient_id is UUID string, keep as-is
  const payload = {
    patient_id: data.patient_id,
    amount: Number(data.amount),
    currency: data.currency,
    description: data.description,
    due_date: dueDate.toISOString().split('T')[0], // YYYY-MM-DD format
  };

  if (import.meta.env.DEV) {
    console.log('[createBillHandler] Payload:', payload);
  }

  await billingApi.create(payload);
};

/**
 * Pay a bill
 */
export const payBillHandler = async (billId: number): Promise<void> => {
  await billingApi.pay(billId);
};
