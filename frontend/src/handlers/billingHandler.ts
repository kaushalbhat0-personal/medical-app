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
  await billingApi.create(data);
};

/**
 * Pay a bill
 */
export const payBillHandler = async (billId: number): Promise<void> => {
  await billingApi.pay(billId);
};
