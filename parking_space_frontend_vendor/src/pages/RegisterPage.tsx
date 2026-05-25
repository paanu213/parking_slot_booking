import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

interface Form {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export const RegisterPage = () => {
  const nav = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm<Form>();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (values: Form) => {
    setError(null);
    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      const res = await api.post('/auth/register', {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone || undefined,
        password: values.password,
        role: 'VENDOR',
      });
      setSession(res.data.user);
      nav('/');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? 'Registration failed. Please try again.';
      setError(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Create Vendor Account</h1>
          <p className="text-center text-sm text-slate-500">
            Register to list your parking spaces on the platform
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Full Name</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Your name or business name"
              required
              {...register('fullName')}
            />
          </div>
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
            <label className="mb-1 block text-sm font-medium">
              Phone <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="tel"
              className="input w-full"
              placeholder="+91 98765 43210"
              {...register('phone')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              className="input w-full"
              autoComplete="new-password"
              placeholder="Min 8 chars, uppercase, lowercase, digit"
              required
              {...register('password')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirm Password</label>
            <input
              type="password"
              className="input w-full"
              autoComplete="new-password"
              required
              {...register('confirmPassword')}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}

          <button className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create Vendor Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
