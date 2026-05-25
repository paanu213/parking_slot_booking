import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Crown } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'];

interface Form {
  email: string;
  password: string;
}

export const LoginPage = () => {
  const nav = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (values: Form) => {
    setError(null);
    try {
      const res = await api.post('/auth/login', values);
      const user = res.data.user;
      if (!ADMIN_ROLES.includes(user.role)) {
        setError('Access denied. This console is for admins only.');
        return;
      }
      setSession(user);
      nav('/');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Invalid email or password.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
            <Crown className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Admin Console</h1>
          <p className="text-sm text-slate-500">Sign in with your admin credentials</p>
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
            <input
              type="password"
              className="input w-full"
              autoComplete="current-password"
              required
              {...register('password')}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}

          <button className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
