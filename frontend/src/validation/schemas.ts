import { z } from 'zod';

// Login form validation
export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

// Patient form validation
export const patientSchema = z.object({
  first_name: z.string().min(1, 'First name is required').min(2, 'First name must be at least 2 characters'),
  last_name: z.string().min(1, 'Last name is required').min(2, 'Last name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
  phone: z.string().min(1, 'Phone is required').regex(/^\+?[\d\s-()]{10,}$/, 'Please enter a valid phone number'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  medical_history: z.string().optional(),
});

// Appointment form validation
export const appointmentSchema = z.object({
  patient_id: z.number().min(1, 'Please select a patient'),
  doctor_id: z.number().min(1, 'Please select a doctor'),
  scheduled_at: z.string().min(1, 'Date and time is required'),
  notes: z.string().optional(),
});

// Billing form validation
export const billingSchema = z.object({
  patient_id: z.number().min(1, 'Please select a patient'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  currency: z.enum(['USD', 'EUR', 'GBP'], { message: 'Please select a currency' }),
  description: z.string().min(1, 'Description is required').min(3, 'Description must be at least 3 characters'),
  due_date: z.string().min(1, 'Due date is required'),
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type PatientFormData = z.infer<typeof patientSchema>;
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
export type BillingFormData = z.infer<typeof billingSchema>;
