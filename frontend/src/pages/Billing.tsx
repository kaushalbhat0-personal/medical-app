import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useBilling } from '../hooks';
import { createBillHandler, payBillHandler } from '../handlers';
import { BILLING_STATUS_CLASSES, CURRENCIES, EMPTY_BILL } from '../constants';
import { formatPatientName, formatDateSafe, formatCurrency } from '../utils';
import { ErrorState, EmptyState, GlobalLoader, FormWrapper, FormSelect, FormInput } from '../components/common';
import { billingSchema, type BillingFormData } from '../validation';

export function Billing() {
  // Data fetching via hook
  const { bills, patients, loading, error, refetch } = useBilling();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [apiError, setApiError] = useState('');

  const form = useForm({
    resolver: zodResolver(billingSchema),
    defaultValues: EMPTY_BILL,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const { reset } = form;

  // Create handler with robust error handling and toast notifications
  const onSubmit = async (data: BillingFormData) => {
    setApiError('');

    // Prevent double submission
    if (form.formState.isSubmitting) {
      return;
    }

    try {
      await createBillHandler(data);

      toast.success('Bill created successfully', {
        duration: 3000,
        icon: '💰',
      });

      reset();
      setShowForm(false);
      await refetch();
    } catch (err: any) {
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
  const handlePay = async (billId: number) => {
    try {
      await payBillHandler(billId);

      toast.success('Payment processed successfully', {
        duration: 3000,
        icon: '💳',
      });

      await refetch();
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
        <div className="p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">New Bill</h3>
          <FormWrapper<BillingFormData>
            form={form}
            onSubmit={onSubmit}
            submitLabel="Create Bill"
            loadingLabel="Creating..."
            apiError={apiError}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <FormSelect<BillingFormData>
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
              <FormInput<BillingFormData>
                name="amount"
                label="Amount"
                type="number"
                disabled={form.formState.isSubmitting}
                required
              />
              <FormSelect<BillingFormData>
                name="currency"
                label="Currency"
                options={CURRENCIES.map((c) => ({
                  value: c.value,
                  label: c.label,
                }))}
                disabled={form.formState.isSubmitting}
                required
              />
              <FormInput<BillingFormData>
                name="due_date"
                label="Due Date"
                type="date"
                disabled={form.formState.isSubmitting}
                required
              />
            </div>
            <FormInput<BillingFormData>
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
                <td>{formatPatientName(bill.patient)}</td>
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
