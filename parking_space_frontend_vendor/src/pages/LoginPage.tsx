import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { BRAND_NAME, LOGO_URL } from '@/lib/config';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

const OAUTH_ERRORS: Record<string, string> = {
  not_registered: 'No vendor account exists for that Google email. Register as a vendor first, then sign in with Google.',
  wrong_portal:   'That Google account is registered but not as a vendor. Use the matching portal instead.',
  inactive:       'Your vendor account is inactive or suspended. Contact support.',
};

interface Form {
  email: string;
  password: string;
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6.01-2.74-6.01-6.12s2.7-6.12 6.01-6.12c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.83 3.36 14.65 2.4 12 2.4 6.85 2.4 2.7 6.55 2.7 11.7s4.15 9.3 9.3 9.3c5.37 0 8.93-3.78 8.93-9.1 0-.62-.07-1.08-.15-1.55H12z" />
  </svg>
);

export const LoginPage = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const setSession = useAuth((s) => s.setSession);
  const { user, loading } = useAuth();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>();
  const [error, setError] = useState<string | null>(() => {
    const code = params.get('error');
    return code ? (OAUTH_ERRORS[code] ?? 'Sign-in failed. Please try again.') : null;
  });
  const [showPassword, setShowPassword] = useState(false);

  // Where to send the user after a successful sign-in. Honour ?returnTo if it
  // points to a same-origin path; fall back to "/" otherwise. Reject `/login`
  // and `/login?...` themselves so we never loop the user back here.
  const safeReturnTo = (() => {
    const raw = params.get('returnTo');
    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
    if (raw === '/login' || raw.startsWith('/login?') || raw.startsWith('/login#')) return '/';
    return raw;
  })();

  // Already-signed-in vendor landed on /login (browser back, manual URL, etc.)
  // — bounce them straight to the destination instead of showing the form.
  useEffect(() => {
    if (!loading && user && user.role === 'VENDOR') {
      nav(safeReturnTo, { replace: true });
    }
  }, [user, loading, safeReturnTo, nav]);

  const onSubmit = async (values: Form) => {
    setError(null);
    try {
      const res = await api.post('/auth/login', values);
      const user = res.data.user;
      if (user.role !== 'VENDOR') {
        setError('This portal is for vendors only. Please use the correct login.');
        return;
      }
      setSession(user);
      nav(safeReturnTo, { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Invalid email or password.');
    }
  };

  const signInWithGoogle = () => {
    setError(null);
    const returnTo = encodeURIComponent(safeReturnTo);
    const origin = encodeURIComponent(window.location.origin);
    window.location.href = `${API_BASE}/auth/google?portal=vendor&returnTo=${returnTo}&origin=${origin}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img
            src={LOGO_URL}
            alt={BRAND_NAME}
            className="h-12 w-auto object-contain"
            loading="eager"
            decoding="async"
          />
          <h1 className="text-2xl font-bold">Vendor Portal</h1>
          <p className="text-sm text-slate-500">Sign in to manage your parking spaces</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              className="input w-full"
              autoComplete="email"
              required
              {...register('email')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input w-full pr-10"
                autoComplete="current-password"
                required
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}

          <button className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="relative my-2 text-center">
            <span className="relative z-10 bg-white px-2 text-xs uppercase text-slate-400 dark:bg-slate-900">
              or
            </span>
            <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          New vendor?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
};
