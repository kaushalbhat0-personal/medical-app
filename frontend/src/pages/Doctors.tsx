import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDoctors } from '../hooks';
import { doctorsApi } from '../services';
import { formatDoctorName, formatDoctorInitials } from '../utils';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonCard } from '../components/common/skeletons';
import { FormWrapper, FormInput } from '../components/common';
import { doctorSchema, type DoctorFormData, type DoctorFormInput } from '../validation';
import { EMPTY_DOCTOR } from '../constants';

export function Doctors() {
  const location = useLocation();

  // Data fetching via hook
  const { doctors, loading, error, refetch } = useDoctors();

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
        const formElement = document.getElementById('doctor-form');
        formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showForm, location.state]);

  const form = useForm<DoctorFormInput, any, DoctorFormData>({
    resolver: zodResolver(doctorSchema),
    defaultValues: EMPTY_DOCTOR,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const { reset } = form;

  // Delete handler
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this doctor?')) return;

    try {
      await doctorsApi.delete(id);
      toast.success('Doctor deleted successfully');
      await refetch();
    } catch (err: any) {
      console.error('[Doctors.handleDelete] Error:', err);
      const errorMessage = err?.detail || err?.message || 'Failed to delete doctor';
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  // Create handler
  const onSubmit = async (data: DoctorFormData) => {
    console.log('SUBMIT TRIGGERED - Doctors form');
    setApiError('');

    console.log('[Doctors.onSubmit] Submitting:', data);

    try {
      await doctorsApi.create(data);

      toast.success('Doctor created successfully', {
        duration: 3000,
        icon: '👨‍⚕️',
      });

      reset();
      setShowForm(false);

      // Refetch to update UI
      if (import.meta.env.DEV) {
        console.log('[Doctors.onSubmit] Refetching data...');
      }
      await refetch();

      console.log('[Doctors.onSubmit] Success - form reset and data refreshed');
    } catch (err: any) {
      console.error('[Doctors.onSubmit] Error:', err);

      let errorMessage = 'Failed to create doctor';

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
  const isEmpty = !loading && doctors.length === 0;

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
          description="There are no doctors to display at the moment."
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
              <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">Doctors</h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1">Medical staff directory</p>
            </>
          )}
        </div>
        <button
          className="min-h-[44px] px-4 py-2.5 inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200 sm:w-auto"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add Doctor'}
        </button>
      </div>

      {showForm && (
        <div id="doctor-form" className="p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">New Doctor</h3>
          <FormWrapper<DoctorFormInput, DoctorFormData>
            form={form}
            onSubmit={onSubmit}
            submitLabel="Create Doctor"
            loadingLabel="Creating..."
            apiError={apiError}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <FormInput<DoctorFormInput>
                name="name"
                label="Full Name"
                disabled={form.formState.isSubmitting}
                required
              />
              <FormInput<DoctorFormInput>
                name="specialization"
                label="Specialization"
                disabled={form.formState.isSubmitting}
                placeholder="e.g., Cardiology, Pediatrics"
              />
              <FormInput<DoctorFormInput>
                name="license_number"
                label="License Number"
                disabled={form.formState.isSubmitting}
                placeholder="e.g., MED123456"
              />
              <FormInput<DoctorFormInput>
                name="experience_years"
                label="Years of Experience"
                type="number"
                disabled={form.formState.isSubmitting}
                placeholder="e.g., 5"
              />
            </div>
          </FormWrapper>
        </div>
      )}

      {/* Grid */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="flex items-start gap-4 p-4 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <div className="doctor-avatar flex-shrink-0">{formatDoctorInitials(doctor)}</div>
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-semibold text-gray-900 truncate">{formatDoctorName(doctor)}</h3>
                <p className="text-sm font-medium text-blue-600">
                  {doctor.specialization || doctor.specialty || 'General'}
                </p>
                <p className="text-sm text-gray-500">
                  {doctor.experience_years ? `${doctor.experience_years} years exp.` : ''}
                </p>
                <p className="text-sm text-gray-400 truncate">{doctor.user?.email || ''}</p>
              </div>
              <button
                onClick={() => handleDelete(String(doctor.id))}
                disabled={loading}
                className="flex-shrink-0 inline-flex items-center justify-center px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
