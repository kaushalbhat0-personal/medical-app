import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { doctorProfileApi } from '../../services/doctorProfile';
import { Button, Card, Input } from '../../components/common';
import {
  completeStructuredDoctorProfileSchema,
  type CompleteStructuredDoctorProfileFormData,
  type CompleteStructuredDoctorProfileFormInput,
} from '../../validation';
import {
  doctorHomePath,
  getEffectiveRoles,
  isAdminRole,
  isSuperAdminRole,
} from '../../utils/roles';

export function CompleteProfilePage() {
  const { user, refreshUser, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const eff = getEffectiveRoles(user, token);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompleteStructuredDoctorProfileFormInput, unknown, CompleteStructuredDoctorProfileFormData>({
    resolver: zodResolver(completeStructuredDoctorProfileSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      profile_image: '',
      specialization: '',
      experience_years: 0,
      qualification: '',
      registration_number: '',
      registration_council: '',
      clinic_name: '',
      address: '',
      city: '',
      state: '',
    },
  });

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (!user?.doctor_id) {
      if (isSuperAdminRole(eff) || isAdminRole(eff)) {
        navigate('/admin/dashboard', { replace: true });
        return;
      }
      navigate('/dashboard', { replace: true });
      return;
    }
    if (user.doctor_profile_complete === true) {
      navigate(doctorHomePath(), { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await doctorProfileApi.get();
        if (cancelled) return;
        reset({
          full_name: p.full_name,
          phone: p.phone ?? '',
          profile_image: p.profile_image ?? '',
          specialization: p.specialization ?? '',
          experience_years: p.experience_years ?? 0,
          qualification: p.qualification ?? '',
          registration_number: p.registration_number ?? '',
          registration_council: p.registration_council ?? '',
          clinic_name: p.clinic_name ?? '',
          address: p.address ?? '',
          city: p.city ?? '',
          state: p.state ?? '',
        });
      } catch {
        if (!cancelled) {
          toast.error('Could not load your profile. Try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, user, eff, navigate, reset]);

  const onSubmit = async (data: CompleteStructuredDoctorProfileFormData) => {
    try {
      await doctorProfileApi.put({
        full_name: data.full_name,
        phone: data.phone,
        profile_image: data.profile_image || null,
        specialization: data.specialization,
        experience_years: data.experience_years,
        qualification: data.qualification || null,
        registration_number: data.registration_number,
        registration_council: data.registration_council,
        clinic_name: data.clinic_name || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
      });
      await refreshUser();
      toast.success('Profile saved');
      navigate(doctorHomePath(), { replace: true });
    } catch (e) {
      console.error(e);
      toast.error('Failed to save profile');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <div className="spinner" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!user?.doctor_id) {
    return null;
  }
  if (user.doctor_profile_complete === true) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card padding="lg" className="w-full max-w-2xl">
        <h1 className="text-xl font-bold text-text-primary mb-1">Complete your professional profile</h1>
        <p className="text-sm text-text-secondary mb-6">
          A few required details for licensing and contact. You can update these anytime later.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Basic</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Full name"
                error={errors.full_name?.message}
                disabled={isSubmitting}
                {...register('full_name')}
              />
              <Input
                label="Phone"
                error={errors.phone?.message}
                disabled={isSubmitting}
                {...register('phone')}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Profile photo URL (optional)"
                  error={errors.profile_image?.message}
                  disabled={isSubmitting}
                  placeholder="https://…"
                  {...register('profile_image')}
                />
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Professional</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Specialization"
                error={errors.specialization?.message}
                disabled={isSubmitting}
                {...register('specialization')}
              />
              <Input
                label="Experience (years)"
                type="number"
                error={errors.experience_years?.message}
                disabled={isSubmitting}
                {...register('experience_years')}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Qualification (optional)"
                  error={errors.qualification?.message}
                  disabled={isSubmitting}
                  {...register('qualification')}
                />
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Registration & verification</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Medical registration number"
                error={errors.registration_number?.message}
                disabled={isSubmitting}
                {...register('registration_number')}
              />
              <Input
                label="Registration council / medical body"
                error={errors.registration_council?.message}
                disabled={isSubmitting}
                {...register('registration_council')}
              />
            </div>
          </section>
          <section>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Clinic (optional)</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Clinic or practice name"
                  error={errors.clinic_name?.message}
                  disabled={isSubmitting}
                  {...register('clinic_name')}
                />
              </div>
              <div className="sm:col-span-2">
                <Input label="Address" error={errors.address?.message} disabled={isSubmitting} {...register('address')} />
              </div>
              <Input label="City" error={errors.city?.message} disabled={isSubmitting} {...register('city')} />
              <Input label="State" error={errors.state?.message} disabled={isSubmitting} {...register('state')} />
            </div>
          </section>
          <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isSubmitting}>
            Save and continue
          </Button>
        </form>
      </Card>
    </div>
  );
}
