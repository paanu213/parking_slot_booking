import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Lock, KeyRound, Save, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

export const AccountPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () =>
      api.post('/auth/change-password', { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setDone(true);
      setCurrent(''); setNext(''); setConfirm(''); setError(null);
      setTimeout(() => setDone(false), 3000);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Failed to change password.');
    },
  });

  const submit = () => {
    setError(null);
    if (next.length < 8)      { setError('New password must be at least 8 characters.'); return; }
    if (next !== confirm)     { setError('New password and confirmation do not match.'); return; }
    if (next === current)     { setError('New password must be different from the current one.'); return; }
    change.mutate();
  };

  return (
    <section className="mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your sign-in credentials.</p>
      </div>

      {/* Account summary */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Account</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-400">Name</dt>
            <dd className="font-medium">{user?.fullName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Email</dt>
            <dd className="font-medium">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Role</dt>
            <dd className="font-medium">{user?.role?.replace('_', ' ') ?? '—'}</dd>
          </div>
        </dl>
      </div>

      {/* Change password */}
      <div className="card p-5">
        <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-slate-400" />
          Change Password
        </h2>

        <div className="space-y-4">
          <PasswordField label="Current Password" value={current} onChange={setCurrent} placeholder="Enter current password" />
          <PasswordField label="New Password"     value={next}    onChange={setNext}    placeholder="At least 8 characters" />
          <PasswordField label="Confirm New Password" value={confirm} onChange={setConfirm} placeholder="Re-enter new password" />
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}
        {done && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> Password changed successfully.
          </p>
        )}

        <div className="mt-5">
          <button
            onClick={submit}
            disabled={!current || !next || !confirm || change.isPending}
            className="btn-primary inline-flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {change.isPending ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>
    </section>
  );
};

const PasswordField = ({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="password"
        className="input w-full pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  </div>
);
