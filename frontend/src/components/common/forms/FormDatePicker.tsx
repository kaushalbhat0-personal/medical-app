import { useFormContext } from 'react-hook-form';
import type { FormDatePickerProps } from './types';

export function FormDatePicker<TFieldValues extends Record<string, unknown>>({
  name,
  label,
  placeholder,
  min,
  max,
  disabled,
  required,
}: FormDatePickerProps<TFieldValues>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TFieldValues>();

  const error = errors[name];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="date"
        {...register(name)}
        placeholder={placeholder}
        min={min}
        max={max}
        disabled={disabled}
        className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 ${
          error
            ? 'border-red-500 focus:border-red-500'
            : 'border-gray-300 focus:border-blue-500'
        }`}
      />
      {error && (
        <span className="text-sm text-red-500 mt-1 block">{error.message as string}</span>
      )}
    </div>
  );
}
