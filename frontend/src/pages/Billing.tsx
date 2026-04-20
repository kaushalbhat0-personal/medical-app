import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useBilling } from '../hooks';
import { createBillHandler, payBillHandler, fetchPatientAppointmentsHandler } from '../handlers';
import { BILLING_STATUS_CLASSES, CURRENCIES, EMPTY_BILL } from '../constants';
import { formatPatientName, formatDateSafe, formatCurrency } from '../utils';
import { ErrorState, EmptyState, GlobalLoader, FormWrapper, FormSelect, FormInput } from '../components/common';
import { billingSchema, type BillingFormData, type BillingFormInput } from '../validation';
import type { Appointment, Bill } from '../types';

export function Billing() {
  const location = useLocation();

  // Data fetching via hook
  const { bills, patients, loading, error, refetch } = useBilling();

  // Form state - auto-show if navigated from Quick Actions
  const [showForm, setShowForm] = useState(() => (location.state as { showForm?: boolean })?.showForm ?? false);
  const [apiError, setApiError] = useState('');
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // Scroll to form when shown via Quick Actions
  useEffect(() => {
    if (showForm && (location.state as { showForm?: boolean })?.showForm) {
      // Clear the state to prevent re-triggering on refresh
      window.history.replaceState({}, document.title);
      // Scroll to form with smooth animation
      setTimeout(() => {
        const formElement = document.getElementById('billing-form');
        formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showForm, location.state]);

  const form = useForm<BillingFormInput, any, BillingFormData>({
    resolver: zodResolver(billingSchema),
    defaultValues: EMPTY_BILL,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const { reset, watch, setValue } = form;

  // Watch patient selection to filter appointments
  const selectedPatientId = watch('patient_id');
  const selectedAppointmentId = watch('appointment_id');

  // Fetch patient-specific appointments when patient changes
  useEffect(() => {
    if (!selectedPatientId) {
      setPatientAppointments([]);
      return;
    }

    setLoadingAppointments(true);
    fetchPatientAppointmentsHandler(selectedPatientId)
      .then((appointments) => {
        setPatientAppointments(appointments);
      })
      .catch((err) => {
        console.error('[Billing] Failed to load appointments:', err);
        toast.error('Failed to load appointments');
        setPatientAppointments([]);
      })
      .finally(() => {
        setLoadingAppointments(false);
      });
  }, [selectedPatientId]);

  // Clear appointment when patient changes (if appointment doesn't belong to new patient)
  useEffect(() => {
    if (selectedPatientId && selectedAppointmentId) {
      const appointmentStillValid = patientAppointments.some(
        (a) => a.id === selectedAppointmentId
      );
      if (!appointmentStillValid) {
        setValue('appointment_id', '');
      }
    }
  }, [selectedPatientId, selectedAppointmentId, patientAppointments, setValue]);

  // Debug: Log form errors whenever they change
  if (import.meta.env.DEV) {
    const errors = form.formState.errors;
    if (Object.keys(errors).length > 0) {
      console.log('[Billing] Form errors:', errors);
    }
  }

  // Create handler with robust error handling and toast notifications
  const onSubmit = async (data: BillingFormData) => {
    console.log('SUBMIT TRIGGERED - Billing form');
    setApiError('');

    console.log('[Billing.onSubmit] Submitting:', data);

    try {
      await createBillHandler(data);

      toast.success('Bill created successfully', {
        duration: 3000,
        icon: '💰',
      });

      reset();
      setShowForm(false);

      if (import.meta.env.DEV) {
        console.log('[Billing.onSubmit] Refetching data...');
      }
      await refetch();

      console.log('[Billing.onSubmit] Success - form reset and data refreshed');
    } catch (err: any) {
      console.error('[Billing.onSubmit] Error:', err);

      let errorMessage = 'Failed to create bill';

      if (err?.detail) {
        errorMessage = err.detail;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setApiError(errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  // Pay handler with toast notifications
  const handlePay = async (billId: string) => {
    try {
      await payBillHandler(billId);

      toast.success('Payment processed successfully', {
        duration: 3000,
        icon: '💳',
      });

      await refetch().catch((err) => {
        console.error('Refetch failed:', err);
      });
    } catch (err: any) {
      let errorMessage = 'Failed to process payment';

      if (err?.detail) {
        errorMessage = err.detail;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      toast.error(errorMessage, { duration: 5000 });
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    return BILLING_STATUS_CLASSES[status] || 'status-badge';
  };

  // Helper to get patient name from bill (uses nested patient or falls back to patients list)
  const getPatientName = (bill: Bill): string => {
    // First try nested patient object from backend
    if (bill.patient?.name) {
      return bill.patient.name;
    }
    // Fallback: look up patient from patients list
    const patient = patients.find((p) => p.id === bill.patient_id);
    if (patient?.name) {
      return patient.name;
    }
    // Final fallback - show ID if nothing else works
    return `Patient #${String(bill.patient_id).slice(0, 8)}`;
  };

  // Safe rendering guards - only show empty after loading completes
  const isLoading = loading;
  const isEmpty = !loading && bills.length === 0;

  return (
    <div className="page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {isLoading && <GlobalLoader />}

      {error && (
        <ErrorState
          title="Something went wrong"
          description="Failed to load data"
          error={error}
          onRetry={refetch}
        />
      )}

      {!error && isEmpty && (
        <EmptyState
          title="No data available"
          description="There are no bills to display at the moment."
        />
      )}
      <div className="page-header with-actions flex flex-col sm:flex-row gap-2">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold">Billing</h1>
          <p className="subtitle">Manage invoices and payments</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Bill'}
        </button>
      </div>

      {showForm && (
        <div id="billing-form" className="p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">New Bill</h3>
          <FormWrapper<BillingFormInput, BillingFormData>
            form={form}
            onSubmit={onSubmit}
            submitLabel="Create Bill"
            loadingLabel="Creating..."
            apiError={apiError}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <FormSelect<BillingFormInput>
                name="patient_id"
                label="Patient"
                placeholder="Select patient"
                options={patients.map((p) => ({
                  value: p.id,
                  label: formatPatientName(p),
                }))}
                disabled={form.formState.isSubmitting}
                required
              />
              <FormSelect<BillingFormInput>
                name="appointment_id"
                label="Appointment (Optional)"
                placeholder={
                  !selectedPatientId
                    ? 'Select patient first'
                    : loadingAppointments
                    ? 'Loading...'
                    : patientAppointments.length === 0
                    ? 'No appointments found'
                    : 'Select appointment (optional)'
                }
                options={patientAppointments.map((a) => {
                  // Format date nicely
                  const dateStr = a.scheduled_at || a.appointment_time || '';
                  const formattedDate = dateStr 
                    ? new Date(dateStr).toLocaleDateString('en-IN', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'No date';
                  return {
                    value: a.id,
                    label: `Appt #${String(a.id).slice(0, 8)} - ${formattedDate}`,
                  };
                })}
                disabled={form.formState.isSubmitting || !selectedPatientId || loadingAppointments}
              />
              <FormInput<BillingFormInput>
                name="amount"
                label="Amount"
                type="number"
                disabled={form.formState.isSubmitting}
                required
              />
              <FormSelect<BillingFormInput>
                name="currency"
                label="Currency"
                options={CURRENCIES.map((c) => ({
                  value: c.value,
                  label: c.label,
                }))}
                disabled={form.formState.isSubmitting}
                required
              />
              <FormInput<BillingFormInput>
                name="due_date"
                label="Due Date"
                type="date"
                disabled={form.formState.isSubmitting}
                required
              />
            </div>
            <FormInput<BillingFormInput>
              name="description"
              label="Description"
              placeholder="Service description"
              disabled={form.formState.isSubmitting}
              required
            />
          </FormWrapper>
        </div>
      )}

      <div className="data-table overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td>{getPatientName(bill)}</td>
                <td>{bill.description || '-'}</td>
                <td className="amount">{formatCurrency(bill.amount, bill.currency)}</td>
                <td>{formatDateSafe(bill.due_date)}</td>
                <td>
                  <span className={getStatusBadgeClass(bill.status)}>{bill.status}</span>
                </td>
                <td>
                  {bill.status === 'pending' && (
                    <button className="btn-small btn-pay" onClick={() => handlePay(bill.id)}>
                      Pay
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
