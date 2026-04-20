import { z } from 'zod';

// Helper to check if date is in the future
const isFutureDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  return date > now;
};

// Helper to check if date is valid (not in the distant past)
const isValidDate = (dateString: string) => {
  const date = new Date(dateString);
  const minDate = new Date('1900-01-01');
  const maxDate = new Date('2100-12-31');
  return date >= minDate && date <= maxDate && !isNaN(date.getTime());
};

// Login form validation
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

// Patient form validation
export const patientSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be less than 255 characters'),
  age: z.coerce.number({ message: 'Age must be a valid number' }).int().min(0, 'Age must be 0 or greater').max(150, 'Age must be 150 or less'),
  gender: z.string().min(1, 'Gender is required'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+?[\d\s-()]{10,}$/, 'Phone number must be at least 10 digits')
    .refine(
      (val) => val.replace(/\D/g, '').length >= 10,
      'Phone number must contain at least 10 digits'
    ),
});

// Appointment form validation
export const appointmentSchema = z.object({
  patient_id: z.string().min(1, 'Please select a patient'),
  doctor_id: z.string().min(1, 'Please select a doctor'),
  scheduled_at: z
    .string()
    .min(1, 'Date and time is required')
    .refine(isValidDate, 'Please enter a valid date and time')
    .refine(isFutureDate, 'Appointment must be scheduled for a future date and time'),
  notes: z
    .string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
});

// Billing form validation
export const billingSchema = z.object({
  patient_id: z.string().min(1, 'Please select a patient'),
  appointment_id: z.string().optional(), // Optional - backend supports bills without appointments
  amount: z.coerce.number().positive('Amount must be greater than 0').max(999999999.99, 'Amount is too large'),
  currency: z.string().default('INR'),
  description: z
    .string()
    .min(1, 'Description is required')
    .min(3, 'Description must be at least 3 characters')
    .max(200, 'Description must be less than 200 characters'),
  due_date: z
    .string()
    .min(1, 'Due date is required')
    .refine(isValidDate, 'Please enter a valid due date'),
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type PatientFormData = z.infer<typeof patientSchema>;
export type PatientFormInput = z.input<typeof patientSchema>;
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
export type AppointmentFormInput = z.input<typeof appointmentSchema>;
export type BillingFormData = z.infer<typeof billingSchema>;
export type BillingFormInput = z.input<typeof billingSchema>;
