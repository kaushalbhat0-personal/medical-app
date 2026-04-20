import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDoctors } from '../hooks';
import { doctorsApi } from '../services';
import { formatDoctorName, formatDoctorInitials } from '../utils';
import { ErrorState, EmptyState, Button, Card as CommonCard } from '../components/common';
import { Card, CardContent } from '@/components/ui/card';
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Doctors</h1>
          <p className="text-sm text-muted-foreground mt-1">Medical staff directory</p>
        </div>
        <Button
          variant={showForm ? 'ghost' : 'primary'}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add Doctor'}
        </Button>
      </div>

      {showForm && (
        <CommonCard id="doctor-form" className="mb-6">
          <h3 className="text-lg font-semibold mb-6">New Doctor</h3>
          <FormWrapper<DoctorFormInput, DoctorFormData>
            form={form}
            onSubmit={onSubmit}
            submitLabel="Create Doctor"
            loadingLabel="Creating..."
            apiError={apiError}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </CommonCard>
      )}

      {/* Grid */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor) => (
            <Card key={doctor.id}>
              <CardContent className="flex items-start gap-4 p-6">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold flex-shrink-0">
                  {formatDoctorInitials(doctor)}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="font-semibold truncate">{formatDoctorName(doctor)}</h3>
                  <p className="text-sm font-medium text-primary">
                    {doctor.specialization || doctor.specialty || 'General'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {doctor.experience_years ? `${doctor.experience_years} years exp.` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{doctor.user?.email || ''}</p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(String(doctor.id))}
                  disabled={loading}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
