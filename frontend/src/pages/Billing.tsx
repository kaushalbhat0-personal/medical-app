import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { billingApi, patientsApi } from '../services';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import type { Bill, Patient } from '../types';
import { billingSchema, type BillingFormData } from '../validation';

export function Billing() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [billsData, patientsData] = await Promise.all([
        billingApi.getAll(),
        patientsApi.getAll(),
      ]);
      // Safe array handling - ensure we always set arrays
      setBills(Array.isArray(billsData) ? billsData : []);
      setPatients(Array.isArray(patientsData) ? patientsData : []);
    } catch {
      setError('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: BillingFormData) => {
    setApiError('');
    try {
      await billingApi.create(data);
      setShowForm(false);
      reset();
      fetchData();
    } catch {
      setApiError('Failed to create bill');
    }
  };

  const handlePay = async (billId: number) => {
    try {
      await billingApi.pay(billId);
      fetchData();
    } catch {
      alert('Failed to process payment');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      pending: 'status-badge pending',
      paid: 'status-badge paid',
      cancelled: 'status-badge cancelled',
      refunded: 'status-badge refunded',
    };
    return <span className={statusClasses[status] || 'status-badge'}>{status}</span>;
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;

  if (error) {
    return (
      <ErrorState
        title="Something went wrong"
        description="Failed to load data"
        error={error}
        onRetry={fetchData}
      />
    );
  }

  if (!Array.isArray(bills) || bills.length === 0) {
    return (
      <EmptyState
        title="No data available"
        description="There are no bills to display at the moment."
      />
    );
  }

  return (
    <div className="page-container">
      <div className="page-header with-actions">
        <div>
          <h1>Billing</h1>
          <p className="subtitle">Manage invoices and payments</p>
        </div>
        <button 
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Create Bill'}
        </button>
      </div>

      {showForm && (
        <form className="create-form" onSubmit={handleSubmit(onSubmit)}>
          <h3>New Bill</h3>
          {apiError && <div className="error-message">{apiError}</div>}
          <div className="form-grid">
            <div className="form-group">
              <label>Patient</label>
              <select {...register('patient_id', { valueAsNumber: true })} disabled={isSubmitting}>
                <option value="0">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown'}</option>
                ))}
              </select>
              {errors.patient_id && <span className="field-error">{errors.patient_id.message}</span>}
            </div>
            <div className="form-group">
              <label>Amount</label>
              <input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} disabled={isSubmitting} />
              {errors.amount && <span className="field-error">{errors.amount.message}</span>}
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select {...register('currency')} disabled={isSubmitting}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
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

      <div className="data-table">
          <table>
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
                  <td>{bill.patient?.name || `${bill.patient?.first_name || ''} ${bill.patient?.last_name || ''}`.trim() || '-'}</td>
                  <td>{bill.description || '-'}</td>
                  <td className="amount">${(bill.amount ?? 0).toFixed(2)} {bill.currency || 'USD'}</td>
                  <td>{bill.due_date && !isNaN(new Date(bill.due_date).getTime()) ? new Date(bill.due_date).toLocaleDateString() : '-'}</td>
                  <td>{getStatusBadge(bill.status || 'pending')}</td>
                  <td>
                    {bill.status === 'pending' && (
                      <button 
                        className="btn-small btn-pay"
                        onClick={() => handlePay(bill.id)}
                      >
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
