import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBilling } from '../hooks';
import { createBillHandler, payBillHandler } from '../handlers';
import { BILLING_STATUS_CLASSES, CURRENCIES } from '../constants';
import { formatPatientName, formatDateSafe, formatCurrency } from '../utils';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { GlobalLoader } from '../components/common/GlobalLoader';
import { billingSchema, type BillingFormData } from '../validation';

export function Billing() {
  // Data fetching via hook
  const { bills, patients, loading, error, refetch } = useBilling();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BillingFormData>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      patient_id: 0,
      amount: 0,
      currency: 'USD',
      description: '',
      due_date: '',
    },
  });

  // Create handler
  const onSubmit = async (data: BillingFormData) => {
    setApiError('');
    // Form validation to prevent 422 errors
    if (!data.patient_id || !data.amount || data.amount <= 0) {
      setApiError('Please select a patient and enter a valid amount');
      return;
    }
    try {
      await createBillHandler(data);
      setShowForm(false);
      reset();
      refetch();
    } catch {
      setApiError('Failed to create bill');
    }
  };

  // Pay handler
  const handlePay = async (billId: number) => {
    try {
      await payBillHandler(billId);
      refetch();
    } catch {
      alert('Failed to process payment');
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
        <form className="create-form" onSubmit={handleSubmit(onSubmit)}>
          <h3>New Bill</h3>
          {apiError && <div className="error-message">{apiError}</div>}
          <div className="form-grid grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label>Patient</label>
              <select {...register('patient_id', { valueAsNumber: true })} disabled={isSubmitting}>
                <option value="0">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatPatientName(p)}
                  </option>
                ))}
              </select>
              {errors.patient_id && <span className="field-error">{errors.patient_id.message}</span>}
            </div>
            <div className="form-group">
              <label>Amount</label>
              <input
                type="number"
                step="0.01"
                {...register('amount', { valueAsNumber: true })}
                disabled={isSubmitting}
              />
              {errors.amount && <span className="field-error">{errors.amount.message}</span>}
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select {...register('currency')} disabled={isSubmitting}>
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {errors.currency && <span className="field-error">{errors.currency.message}</span>}
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" {...register('due_date')} disabled={isSubmitting} />
              {errors.due_date && <span className="field-error">{errors.due_date.message}</span>}
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input {...register('description')} placeholder="Service description" disabled={isSubmitting} />
            {errors.description && <span className="field-error">{errors.description.message}</span>}
          </div>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Bill'}
          </button>
        </form>
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
