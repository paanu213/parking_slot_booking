import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Plus, X, ShieldCheck, Shield, User,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { KebabMenu, MenuItem } from '@/components/KebabMenu';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type Role   = 'SUPER_ADMIN' | 'ADMIN' | 'SUB_ADMIN';
type Status = 'ACTIVE' | 'INACTIVE';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: Status;
  createdAt: string;
}

interface CreateForm {
  email: string;
  fullName: string;
  password: string;
  role: 'ADMIN' | 'SUB_ADMIN';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROLE_META: Record<Role, { label: string; cls: string; Icon: typeof Shield }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    cls:   'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    Icon:  ShieldCheck,
  },
  ADMIN: {
    label: 'Admin',
    cls:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    Icon:  Shield,
  },
  SUB_ADMIN: {
    label: 'Sub-Admin',
    cls:   'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    Icon:  User,
  },
};

type TabValue = 'ALL' | 'ADMIN' | 'SUB_ADMIN';
const TABS: { value: TabValue; label: string }[] = [
  { value: 'ALL',       label: 'All' },
  { value: 'ADMIN',     label: 'Admins' },
  { value: 'SUB_ADMIN', label: 'Sub-Admins' },
];

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const initials = (name: string) =>
  name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// RowMenu uses KebabMenu from @/components/KebabMenu — portal-based, always on top.

// ── Create Admin Modal ────────────────────────────────────────────────────────
const CreateModal = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) => {
  const { register, handleSubmit, reset, formState } = useForm<CreateForm>({
    defaultValues: { role: 'SUB_ADMIN' },
  });

  const create = useMutation({
    mutationFn: (v: CreateForm) => api.post('/admin/admins', v).then((r) => r.data),
    onSuccess: () => {
      reset();
      onCreated();
    },
  });

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Add New Admin</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Create an Admin or Sub-Admin account.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Full Name</label>
            <input
              className="input w-full"
              placeholder="Jane Doe"
              required
              {...register('fullName')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              className="input w-full"
              placeholder="jane@autosahay.com"
              required
              {...register('email')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Temporary Password</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Min. 8 characters"
              required
              minLength={8}
              {...register('password')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Role</label>
            <select className="input w-full" {...register('role')}>
              <option value="SUB_ADMIN">Sub-Admin</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          {create.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {(create.error as Error).message}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={formState.isSubmitting || create.isPending}
            >
              {create.isPending ? 'Creating…' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ── Main Page ─────────────────────────────────────────────────────────────────
export const AdminsPage = () => {
  const qc = useQueryClient();
  const [tab, setTab]               = useState<TabValue>('ALL');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get('/admin/admins')).data,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      api.patch(`/admin/admins/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const allUsers: AdminUser[] = data?.items ?? [];
  const filtered = tab === 'ALL'
    ? allUsers
    : allUsers.filter((u) => u.role === tab);

  const superAdmins = filtered.filter((u) => u.role === 'SUPER_ADMIN');
  const admins      = filtered.filter((u) => u.role === 'ADMIN');
  const subAdmins   = filtered.filter((u) => u.role === 'SUB_ADMIN');

  return (
    <>
      <section className="p-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admins</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage admin and sub-admin accounts. Only Super Admin can create or remove accounts.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex shrink-0 items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Admin
          </button>
        </div>

        {/* Filter tabs */}
        <div className="mt-5 flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tab === t.value
                  ? 'bg-white shadow text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
              {t.value !== 'ALL' && (
                <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-slate-700">
                  {allUsers.filter((u) => u.role === t.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">
              No admins found for this filter.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Super Admins */}
              {superAdmins.length > 0 && (tab === 'ALL') && (
                <AdminGroup
                  title="Super Admins"
                  users={superAdmins}
                  onToggleStatus={(u) =>
                    toggleStatus.mutate({ id: u.id, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
                  }
                  isPending={toggleStatus.isPending}
                />
              )}

              {/* Admins */}
              {admins.length > 0 && (
                <AdminGroup
                  title="Admins"
                  users={admins}
                  onToggleStatus={(u) =>
                    toggleStatus.mutate({ id: u.id, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
                  }
                  isPending={toggleStatus.isPending}
                />
              )}

              {/* Sub-Admins */}
              {subAdmins.length > 0 && (
                <AdminGroup
                  title="Sub-Admins"
                  users={subAdmins}
                  onToggleStatus={(u) =>
                    toggleStatus.mutate({ id: u.id, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
                  }
                  isPending={toggleStatus.isPending}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['admin-users'] });
          }}
        />
      )}

    </>
  );
};

// ── Admin Group (shared list section) ─────────────────────────────────────────
const AdminGroup = ({
  title,
  users,
  onToggleStatus,
  isPending,
}: {
  title: string;
  users: AdminUser[];
  onToggleStatus: (u: AdminUser) => void;
  isPending: boolean;
}) => (
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
    <div className="card divide-y divide-slate-100 dark:divide-slate-800">
      {users.map((u) => {
        const rm = ROLE_META[u.role];
        return (
          <div key={u.id} className="flex items-center gap-4 px-4 py-3">
            {/* Avatar */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
              {initials(u.fullName)}
            </div>

            {/* Name + email */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{u.fullName}</p>
              <p className="truncate text-xs text-slate-500">{u.email}</p>
            </div>

            {/* Role badge */}
            <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex ${rm.cls}`}>
              <rm.Icon className="h-3 w-3" />
              {rm.label}
            </span>

            {/* Status badge */}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              u.status === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            </span>

            {/* Joined date */}
            <span className="hidden shrink-0 text-xs text-slate-400 lg:block">
              Joined {fmtDate(u.createdAt)}
            </span>

            {/* Kebab menu — portal-based, always on top */}
            {u.role !== 'SUPER_ADMIN' && (
              <KebabMenu>
                <MenuItem
                  disabled={isPending}
                  icon={u.status === 'ACTIVE'
                    ? <ToggleLeft  className="h-4 w-4 text-slate-400" />
                    : <ToggleRight className="h-4 w-4 text-emerald-500" />}
                  onClick={() => onToggleStatus(u)}
                >
                  {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </MenuItem>
              </KebabMenu>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
