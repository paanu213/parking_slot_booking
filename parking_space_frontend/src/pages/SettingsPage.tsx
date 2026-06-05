import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Lock, Moon, Settings as SettingsIcon, Sun } from 'lucide-react';
import { api } from '@/lib/api';
import { useTheme } from '@/store/theme';
import { toast } from '@/components/Toast';
import { Footer } from '@/components/Footer';
import { cn } from '@/lib/cn';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const SettingsPage = () => {
  const { theme, toggle } = useTheme();

  // Determine whether this account can change a password (email accounts only).
  const { data: profile } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: async () => (await api.get('/customer/me/profile')).data.user,
  });
  const isEmailAccount = profile?.provider !== 'GOOGLE';

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>();
  const [formError, setFormError] = useState<string | null>(null);

  const changePassword = useMutation({
    mutationFn: (vals: PasswordForm) =>
      api.post('/auth/change-password', {
        currentPassword: vals.currentPassword,
        newPassword: vals.newPassword,
      }),
    onSuccess: () => {
      toast.success('Password updated', 'Use your new password next time you sign in.');
      reset();
      setFormError(null);
    },
    onError: (e: any) =>
      setFormError(e?.response?.data?.error?.message ?? 'Could not update password.'),
  });

  const onSubmit = (vals: PasswordForm) => {
    setFormError(null);
    if (vals.newPassword !== vals.confirmPassword) {
      setFormError('New passwords do not match.');
      return;
    }
    changePassword.mutate(vals);
  };

  return (
    <>
      <main className="mx-auto max-w-xl px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600">
          <ArrowLeft className="h-3 w-3" /> Back to home
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <SettingsIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold">Settings</h1>
            <p className="text-sm text-slate-500">Appearance and security</p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {/* Appearance */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Appearance</h2>
            <button
              type="button"
              onClick={toggle}
              className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </span>
                <span className="text-sm font-medium">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              </span>
              <span
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition',
                  theme === 'dark' ? 'bg-brand-600' : 'bg-slate-300',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white shadow transition',
                    theme === 'dark' ? 'translate-x-4' : 'translate-x-1',
                  )}
                />
              </span>
            </button>
          </div>

          {/* Security — password change (email accounts only) */}
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Lock className="h-4 w-4" /> Security
            </h2>

            {isEmailAccount ? (
              <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
                <input
                  type="password"
                  autoComplete="current-password"
                  className={cn('input w-full', errors.currentPassword && 'border-rose-500')}
                  placeholder="Current password"
                  {...register('currentPassword', { required: 'Required' })}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  className={cn('input w-full', errors.newPassword && 'border-rose-500')}
                  placeholder="New password (min 8 characters)"
                  {...register('newPassword', { required: 'Required', minLength: { value: 8, message: 'At least 8 characters' } })}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  className={cn('input w-full', errors.confirmPassword && 'border-rose-500')}
                  placeholder="Confirm new password"
                  {...register('confirmPassword', { required: 'Required' })}
                />
                {(errors.newPassword || formError) && (
                  <p className="text-xs text-rose-600">{errors.newPassword?.message ?? formError}</p>
                )}
                <button type="submit" disabled={changePassword.isPending} className="btn-primary w-full justify-center">
                  {changePassword.isPending ? 'Updating…' : 'Update password'}
                </button>
              </form>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                You signed in with Google, so there's no password to change here. Manage your
                account security from your Google account.
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};
