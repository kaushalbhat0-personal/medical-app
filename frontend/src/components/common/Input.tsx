import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = true,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'flex-1 bg-transparent border-none outline-none text-text-primary placeholder:text-text-muted text-sm';
    const wrapperClasses = `flex items-center gap-3 px-4 py-2.5 bg-surface border rounded-lg transition-all duration-200 ease-smooth focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary ${
      error ? 'border-danger focus-within:border-danger focus-within:ring-danger/30' : 'border-border hover:border-border-light'
    } ${disabled ? 'opacity-50 cursor-not-allowed bg-surface-hover' : ''} ${
      fullWidth ? 'w-full' : ''
    } ${className}`;

    return (
      <div className={fullWidth ? 'w-full' : 'inline-block'}>
        {label && (
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <div className={wrapperClasses}>
          {leftIcon && (
            <span className="text-text-muted flex-shrink-0">{leftIcon}</span>
          )}
          <input ref={ref} className={baseClasses} disabled={disabled} {...props} />
          {rightIcon && (
            <span className="text-text-muted flex-shrink-0">{rightIcon}</span>
          )}
        </div>
        {(error || helperText) && (
          <p
            className={`mt-1.5 text-xs ${
              error ? 'text-danger' : 'text-text-muted'
            }`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
