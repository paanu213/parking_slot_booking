import { forwardRef, useId } from 'react';
import { cn } from './cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const uid = useId();
    const inputId = id ?? uid;

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
          {props.required && (
            <span className="ml-0.5 text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            // Base
            'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition',
            'placeholder:text-slate-400',
            // Focus — uses each app's brand color via Tailwind config
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15',
            // Dark mode
            'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
            'dark:placeholder:text-slate-500 dark:focus:ring-brand-500/20',
            // Disabled
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 dark:disabled:bg-slate-800/50',
            // Error state overrides
            error &&
              'border-red-400 focus:border-red-500 focus:ring-red-500/15 dark:border-red-600 dark:focus:ring-red-500/20',
            className,
          )}
          {...props}
        />

        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-red-500 dark:text-red-400">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
