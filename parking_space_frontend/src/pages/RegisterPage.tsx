import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/store/auth';
import { OAuthButtons } from '@/components/OAuthButtons';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/cn';

const Schema = z.object({
  fullName: z.string().min(2, 'Name is too short').max(80),
  email: z.string().email('Enter a valid email'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[0-9]/, 'Include a digit'),
});
type Form = z.infer<typeof Schema>;

export const RegisterPage = () => {
  const nav = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Form>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (values: Form) => {
    setSubmitError(null);
    const parsed = Schema.safeParse({ ...values, phone: values.phone || undefined });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof Form | undefined;
        if (field) setError(field, { message: issue.message });
      }
      return;
    }
    try {
      const res = await api.post('/auth/register', parsed.data);
      setSession(res.data.user, res.data.accessToken);
      toast.success('Account created', 'You’re all set — happy parking!');
      nav('/');
    } catch (e) {
      setSubmitError(errorMessage(e));
    }
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold">Create account</h1>
      <p className="mt-1 text-sm text-slate-500">It takes less than a minute.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-3" noValidate>
        <Field label="Full name" error={errors.fullName?.message}>
          <input
            className={cn('input mt-1', errors.fullName && 'border-rose-500 focus:border-rose-500')}
            autoComplete="name"
            aria-invalid={!!errors.fullName}
            {...register('fullName')}
          />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input
            type="email"
            className={cn('input mt-1', errors.email && 'border-rose-500 focus:border-rose-500')}
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        <Field label="Phone (optional)" error={errors.phone?.message}>
          <input
            className={cn('input mt-1', errors.phone && 'border-rose-500 focus:border-rose-500')}
            autoComplete="tel"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            aria-invalid={!!errors.phone}
            {...register('phone', {
              onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); },
            })}
          />
        </Field>
        <Field
          label="Password"
          error={errors.password?.message}
          hint="8+ chars with an uppercase, a lowercase, and a digit."
        >
          <input
            type="password"
            className={cn('input mt-1', errors.password && 'border-rose-500 focus:border-rose-500')}
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </Field>

        {submitError && (
          <p
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {submitError}
          </p>
        )}

        <button className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <OAuthButtons className="mt-6" />

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600">
          Sign in
        </Link>
      </p>
    </main>
  );
};

const Field = ({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div>
    <label className="text-sm font-medium">{label}</label>
    {children}
    {error ? (
      <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>
    ) : (
      hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    )}
  </div>
);
