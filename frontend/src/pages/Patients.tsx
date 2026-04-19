import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'react-router-dom';
import debounce from 'lodash.debounce';
import toast from 'react-hot-toast';
import { usePatients } from '../hooks';
import { createPatientHandler } from '../handlers';
import { EMPTY_PATIENT } from '../constants';
import { formatPatientName, formatPatientDobOrAge, formatDateSafe } from '../utils';
import { ErrorState, EmptyState, SkeletonTable, FormWrapper, FormInput, FormSelect } from '../components/common';
import { patientSchema, type PatientFormData, type PatientFormInput } from '../validation';

export function Patients() {
  const location = useLocation();

  // Search state with debounce
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const debouncedSearch = useMemo(
    () => debounce((value: string) => setSearch(value), 400),
    []
  );

  // Data fetching via hook
  const { patients, loading, error, refetch } = usePatients(search);

  // Form state - auto-show if navigated from Quick Actions
  const [showForm, setShowForm] = useState(() => (location.state as { showForm?: boolean })?.showForm ?? false);
  const [apiError, setApiError] = useState('');

  // Scroll to form when shown via Quick Actions
  useEffect(() => {
    if (showForm && (location.state as { showForm?: boolean })?.showForm) {
      // Clear the state to prevent re-triggering on refresh
      window.history.replaceState({}, document.title);
      // Scroll to form with smooth animation
      setTimeout(() => {
        const formElement = document.getElementById('patient-form');
        formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showForm, location.state]);

  const form = useForm<PatientFormInput, any, PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: EMPTY_PATIENT,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const { reset } = form;

  // Create handler with robust error handling and toast notifications
  const onSubmit = async (data: PatientFormData) => {
    setApiError('');

    // Prevent double submission
    if (form.formState.isSubmitting) {
      return;
    }

    try {
      await createPatientHandler(data);

      toast.success('Patient created successfully', {
        duration: 3000,
        icon: '👤',
      });

      reset();
      setShowForm(false);
      await refetch().catch((err) => {
        console.error('Refetch failed:', err);
      });
    } catch (err: any) {
      let errorMessage = 'Failed to create patient';

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

  // Safe rendering guards - only show empty after loading completes
  const safePatients = Array.isArray(patients) ? patients : [];
  const isEmpty = !loading && safePatients.length === 0;

  return (
    <div className="page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

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
          description="There are no patients to display at the moment."
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-8 bg-gray-200 rounded-xl w-32 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded-lg w-48 animate-pulse" />
            </div>
          ) : (
            <>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">Patients</h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1">Manage patient records</p>
            </>
          )}
        </div>
        <button
          className="min-h-[44px] px-4 py-2.5 inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200 sm:w-auto"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add Patient'}
        </button>
      </div>

      {loading && (
        <div className="mb-6">
          <SkeletonTable rows={5} columns={5} />
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Search */}
          <div className="max-w-md">
            <input
              type="text"
              placeholder="Search patients..."
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value;
                setSearchInput(value);
                debouncedSearch(value);
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            />
          </div>

          {/* Create Form */}
          {showForm && (
            <div id="patient-form" className="p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">New Patient</h3>
              <FormWrapper<PatientFormInput, PatientFormData>
                form={form}
                onSubmit={onSubmit}
                submitLabel="Create Patient"
                loadingLabel="Creating..."
                apiError={apiError}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <FormInput<PatientFormInput>
                    name="name"
                    label="Full Name"
                    disabled={form.formState.isSubmitting}
                    required
                  />
                  <FormInput<PatientFormInput>
                    name="age"
                    label="Age"
                    type="number"
                    disabled={form.formState.isSubmitting}
                    required
                  />
                  <FormSelect<PatientFormInput>
                    name="gender"
                    label="Gender"
                    placeholder="Select gender"
                    options={[
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'other', label: 'Other' },
                    ]}
                    disabled={form.formState.isSubmitting}
                    required
                  />
                  <FormInput<PatientFormInput>
                    name="phone"
                    label="Phone"
                    type="tel"
                    disabled={form.formState.isSubmitting}
                    required
                  />
                </div>
              </FormWrapper>
            </div>
          )}

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">DOB / Age</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {safePatients.map((patient) => (
                    <tr key={patient?.id || Math.random()} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 sm:py-5">
                        <span className="font-semibold text-gray-900">{formatPatientName(patient)}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-600">{patient?.email || '-'}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-600">{patient?.phone || '-'}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-600">{formatPatientDobOrAge(patient)}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-gray-500">{formatDateSafe(patient?.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
