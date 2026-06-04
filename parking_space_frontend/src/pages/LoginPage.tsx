import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/store/auth';
import { OAuthButtons } from '@/components/OAuthButtons';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/cn';

const Schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type Form = z.infer<typeof Schema>;

const OAUTH_ERRORS: Record<string, string> = {
  not_registered: 'Could not finish Google sign-in. Please try again.',
  wrong_portal:   'That Google account belongs to a different portal. Use the customer site.',
  inactive:       'Your account is inactive. Contact support.',
};

export const LoginPage = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const setSession = useAuth((s) => s.setSession);
  const user = useAuth((s) => s.user);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Form>();
  const [submitError, setSubmitError] = useState<string | null>(() => {
    const code = params.get('error');
    return code ? (OAUTH_ERRORS[code] ?? 'Sign-in failed. Please try again.') : null;
  });

  // Where to send the user after a successful sign-in. Honour ?returnTo if it
  // points to a same-origin path; fall back to "/" otherwise. Reject `/login`
  // and `/login?...` themselves so we never loop the user back here.
  const safeReturnTo = (() => {
    const raw = params.get('returnTo');
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
    if (raw === '/login' || raw.startsWith('/login?') || raw.startsWith('/login#')) return '/';
    return raw;
  })();

  // Already-signed-in user landed on /login (browser back, manual URL, etc.)
  // — bounce them straight to the destination instead of showing the form.
  useEffect(() => {
    if (user) nav(safeReturnTo, { replace: true });
  }, [user, safeReturnTo, nav]);

  const onSubmit = async (values: Form) => {
    setSubmitError(null);
    const parsed = Schema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof Form | undefined;
        if (field) setError(field, { message: issue.message });
      }
      return;
    }
    try {
      const res = await api.post('/auth/login', parsed.data);
      setSession(res.data.user, res.data.accessToken);
      toast.success('Welcome back', `Signed in as ${res.data.user.fullName}`);
      nav(safeReturnTo, { replace: true });
    } catch (e) {
      setSubmitError(errorMessage(e));
    }
  };

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to manage bookings, payments, and saved spots.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-3" noValidate>
        <Field label="Email" error={errors.email?.message}>
          <input
            type="email"
            className={cn('input mt-1', errors.email && 'border-rose-500 focus:border-rose-500')}
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input
            type="password"
            className={cn('input mt-1', errors.password && 'border-rose-500 focus:border-rose-500')}
            autoComplete="current-password"
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
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <OAuthButtons className="mt-6" />

      <p className="mt-6 text-center text-sm text-slate-500">
        New here?{' '}
        <Link to="/register" className="font-semibold text-brand-600">
          Create account
        </Link>
      </p>
    </main>
  );
};

const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    <label className="text-sm font-medium">{label}</label>
    {children}
    {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
  </div>
);
