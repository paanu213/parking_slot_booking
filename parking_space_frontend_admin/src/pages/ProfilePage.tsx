import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, User, Mail, Phone, ShieldCheck, Save, Settings } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, setSession } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone,    setPhone]    = useState(user?.phone ?? '');
  const [saved,    setSaved]    = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch('/auth/me', {
        fullName: fullName.trim(),
        phone:    phone.trim() || null,
      });
      return data.user;
    },
    onSuccess: (updated) => {
      setSession(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Failed to update profile.');
    },
  });

  const dirty =
    fullName.trim() !== (user?.fullName ?? '') ||
    (phone.trim() || '') !== (user?.phone ?? '');

  return (
    <section className="mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">View and update your personal details.</p>
      </div>

      {/* Identity card */}
      <div className="card flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          {(user?.fullName?.[0] ?? 'A').toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold">{user?.fullName ?? 'Admin'}</p>
          <p className="inline-flex items-center gap-1 text-xs text-slate-500">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            {user?.role?.replace('_', ' ') ?? 'Admin'}
          </p>
        </div>
      </div>

      {/* Editable details */}
      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Personal Details</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input w-full pl-9"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input w-full pl-9 opacity-60" value={user?.email ?? ''} disabled />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Email can't be changed here. Contact a Super Admin if needed.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input w-full pl-9"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            className="btn-primary inline-flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Profile updated ✓</span>}
        </div>
      </div>

      {/* Quick link to account settings */}
      <button
        onClick={() => navigate('/account')}
        className="card flex w-full items-center justify-between p-4 text-left transition hover:shadow-md"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Settings className="h-4 w-4 text-slate-400" />
          Account Settings — change password
        </span>
        <ArrowLeft className="h-4 w-4 rotate-180 text-slate-400" />
      </button>
    </section>
  );
};
