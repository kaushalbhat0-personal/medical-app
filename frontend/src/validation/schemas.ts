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
  first_name: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens and apostrophes'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens and apostrophes'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+?[\d\s-()]{10,}$/, 'Phone number must be at least 10 digits')
    .refine(
      (val) => val.replace(/\D/g, '').length >= 10,
      'Phone number must contain at least 10 digits'
    ),
  date_of_birth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine(isValidDate, 'Please enter a valid date')
    .refine(
      (val) => {
        const dob = new Date(val);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        return age >= 0 && age <= 150;
      },
      'Age must be between 0 and 150 years'
    ),
  medical_history: z
    .string()
    .max(2000, 'Medical history must be less than 2000 characters')
    .optional(),
});

// Helper for coercing number inputs with clean type inference
const numberField = (schema: z.ZodNumber) =>
  z.any().transform((val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) return Number(val);
    return val;
  }).pipe(schema);

// Appointment form validation
export const appointmentSchema = z.object({
  patient_id: numberField(z.number().min(1, 'Please select a patient')),
  doctor_id: numberField(z.number().min(1, 'Please select a doctor')),
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
  patient_id: numberField(z.number().min(1, 'Please select a patient')),
  amount: numberField(z.number().positive('Amount must be greater than 0').max(999999999.99, 'Amount is too large')),
  currency: z.literal('INR'),
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
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
export type BillingFormData = z.infer<typeof billingSchema>;
