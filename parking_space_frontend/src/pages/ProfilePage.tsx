import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Mail, Phone, UserCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { toast } from '@/components/Toast';
import { Footer } from '@/components/Footer';
import { Skeleton } from '@/components/Skeleton';
import { cn } from '@/lib/cn';

interface ProfileForm {
  fullName: string;
  phone: string;
}

export const ProfilePage = () => {
  const { user: authUser, setSession } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: async () => (await api.get('/customer/me/profile')).data.user,
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<ProfileForm>();

  useEffect(() => {
    if (data) reset({ fullName: data.fullName ?? '', phone: data.phone ?? '' });
  }, [data, reset]);

  const save = useMutation({
    mutationFn: (vals: ProfileForm) =>
      api.patch('/customer/me/profile', {
        fullName: vals.fullName.trim() || undefined,
        phone:    vals.phone.trim()    || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['customer-profile'] });
      // Keep the nav avatar in sync
      setSession({ ...authUser!, fullName: res.data.user.fullName });
      toast.success('Profile updated', 'Your changes have been saved.');
    },
    onError: (e: any) => toast.error('Could not save', e?.response?.data?.error?.message ?? 'Please try again.'),
  });

  return (
    <>
      <main className="mx-auto max-w-xl px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600">
          <ArrowLeft className="h-3 w-3" /> Back to home
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <UserCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold">My profile</h1>
            <p className="text-sm text-slate-500">Update your name and contact details</p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* Read-only info */}
            <div className="card p-5 space-y-3">
              <Row label="Email" value={data?.email} icon={<Mail className="h-4 w-4" />}>
                {data?.emailVerified ? (
                  <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                  </span>
                ) : (
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Unverified
                  </span>
                )}
              </Row>
              <Row label="Signed in via" value={data?.provider === 'GOOGLE' ? 'Google' : 'Email'} icon={<UserCircle2 className="h-4 w-4" />} />
              <Row label="Member since" value={data?.createdAt ? new Date(data.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} icon={<CheckCircle2 className="h-4 w-4" />} />
            </div>

            {/* Editable form */}
            <form onSubmit={handleSubmit((v) => save.mutate(v))} className="card space-y-4 p-5">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Edit details</h2>

              <div>
                <label className="text-sm font-medium">Full name</label>
                <input
                  className={cn('input mt-1 w-full', errors.fullName && 'border-rose-500')}
                  placeholder="Your full name"
                  {...register('fullName', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })}
                />
                {errors.fullName && <p className="mt-1 text-xs text-rose-600">{errors.fullName.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium">
                  Phone <span className="text-slate-400 text-xs">(optional)</span>
                </label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className={cn('input w-full pl-9', errors.phone && 'border-rose-500')}
                    placeholder="10-digit mobile"
                    {...register('phone', {
                      onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); },
                    })}
                  />
                </div>
                {errors.phone && <p className="mt-1 text-xs text-rose-600">{errors.phone.message}</p>}
              </div>

              <button
                type="submit"
                disabled={!isDirty || isSubmitting || save.isPending}
                className="btn-primary w-full justify-center"
              >
                {save.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
};

const Row = ({ label, value, icon, children }: { label: string; value?: string; icon: React.ReactNode; children?: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm">
    <span className="text-slate-400">{icon}</span>
    <span className="w-28 shrink-0 text-slate-500">{label}</span>
    <span className="font-medium text-slate-800 dark:text-slate-100">{value ?? '—'}</span>
    {children}
  </div>
);
