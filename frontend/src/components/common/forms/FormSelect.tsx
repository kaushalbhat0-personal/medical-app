import { useFormContext } from 'react-hook-form';
import type { FormSelectProps } from './types';

export function FormSelect<TFieldValues extends Record<string, unknown>>({
  name,
  label,
  options,
  placeholder,
  disabled,
  required,
}: FormSelectProps<TFieldValues>) {
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
      <select
        {...register(name)}
        disabled={disabled}
        className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 bg-white ${
          error
            ? 'border-red-500 focus:border-red-500'
            : 'border-gray-300 focus:border-blue-500'
        }`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-sm text-red-500 mt-1 block">{error.message as string}</span>
      )}
    </div>
  );
}
