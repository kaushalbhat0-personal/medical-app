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
  // Ensure proper data types and format for API
  const payload = {
    patient_id: Number(data.patient_id),
    amount: Number(data.amount),
    currency: data.currency,
    description: data.description,
    due_date: data.due_date,
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
