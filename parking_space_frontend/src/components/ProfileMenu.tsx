import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  LogOut,
  Settings,
  UserCircle2,
  CalendarCheck,
  HelpCircle,
  Sun,
  Moon,
  LogIn,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { Avatar, gradientFor } from '@/components/Avatar';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/store/theme';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { SUPPORT_EMAIL } from '@/lib/config';
import { toast } from '@/components/Toast';

type MenuLink = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  /** When true, render as a plain <a> (e.g. for mailto:/tel: URLs). */
  external?: boolean;
};

const LINKS: MenuLink[] = [
  { to: '/profile', label: 'My profile', icon: UserCircle2, description: 'Name, contact, preferences' },
  { to: '/bookings', label: 'My bookings', icon: CalendarCheck, description: 'Upcoming and past' },
  { to: '/settings', label: 'Settings', icon: Settings, description: 'Notifications & security' },
  {
    to: `mailto:${SUPPORT_EMAIL}`,
    label: 'Help & support',
    icon: HelpCircle,
    description: `Email us at ${SUPPORT_EMAIL}`,
    external: true,
  },
];

export const ProfileMenu = () => {
  const { user, logout: clearSession } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // When clicking Sign in / Sign up from any page, append the current path as
  // ?returnTo=... so the login page knows where to send the user after success.
  // Skip /login and /register themselves to avoid a redirect loop.
  const authReturnTo =
    loc.pathname === '/login' || loc.pathname === '/register'
      ? ''
      : `?returnTo=${encodeURIComponent(loc.pathname + loc.search)}`;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* logout is best-effort — local session is cleared regardless */
    }
    clearSession();
    qc.clear();
    setOpen(false);
    toast.info('Signed out', 'See you soon.');
    nav('/', { replace: true });
  };

  const displayName = user?.fullName ?? 'Guest';
  const accentGradient = gradientFor(displayName);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
        className={cn(
          'group flex items-center gap-2 rounded-full pl-1 pr-2 py-1 transition',
          'hover:bg-slate-100 dark:hover:bg-slate-800/80',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
          open && 'bg-slate-100 dark:bg-slate-800/80',
        )}
      >
        <Avatar name={displayName} src={user?.avatarUrl ?? null} size="sm" status={user ? 'online' : null} />
        <span className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {user ? 'Signed in' : 'Guest'}
          </span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 max-w-[140px] truncate">
            {user ? displayName.split(' ')[0] : 'Sign in'}
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-slate-500 transition-transform', open && 'rotate-180')}
        />
      </button>

      {/* Backdrop — only mobile */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm sm:hidden transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="menu"
        className={cn(
          'z-50 origin-top-right transition duration-150',
          'fixed left-3 right-3 top-[62px] sm:absolute sm:right-0 sm:left-auto sm:top-[calc(100%+10px)]',
          'sm:w-[340px]',
          'rounded-2xl border border-slate-200/70 bg-white/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10',
          'dark:border-slate-700/70 dark:bg-slate-900/95 dark:shadow-black/40',
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
        )}
      >
        {/* Header card */}
        <div className="relative overflow-hidden rounded-t-2xl p-4">
          <div
            aria-hidden
            className={cn(
              'absolute inset-0 bg-gradient-to-br opacity-90',
              user ? accentGradient : 'from-slate-600 via-slate-700 to-slate-900',
            )}
          />
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.35),transparent_60%)]" />
          <div className="relative flex items-center gap-3 text-white">
            <Avatar name={displayName} src={user?.avatarUrl ?? null} size="lg" status={user ? 'online' : null} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-display text-base font-semibold">{displayName}</p>
                {user && <Sparkles className="h-3.5 w-3.5 opacity-80" />}
              </div>
              <p className="truncate text-xs text-white/80">{user?.email ?? 'Not signed in'}</p>
              {user && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-white/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        {user ? (
          <>
            <ul className="p-1.5">
              {LINKS.map((l) => {
                const inner = (
                  <>
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/70 group-hover:bg-brand-500/10 group-hover:text-brand-600 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700/70 transition">
                      <l.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {l.label}
                      </span>
                      {l.description && (
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {l.description}
                        </span>
                      )}
                    </span>
                  </>
                );
                const className = cn(
                  'group flex items-start gap-3 rounded-xl px-3 py-2.5',
                  'hover:bg-brand-50 dark:hover:bg-brand-500/10 transition',
                );
                return (
                  <li key={l.to}>
                    {l.external ? (
                      <a href={l.to} onClick={() => setOpen(false)} className={className}>
                        {inner}
                      </a>
                    ) : (
                      <Link to={l.to} onClick={() => setOpen(false)} className={className}>
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-slate-200/70 dark:border-slate-800/70 p-1.5">
              <ThemeToggleRow theme={theme} onToggle={toggleTheme} />
            </div>

            <div className="border-t border-slate-200/70 dark:border-slate-800/70 p-1.5 rounded-b-2xl">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 transition"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
                  <LogOut className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">Sign out</span>
              </button>
            </div>
          </>
        ) : (
          <Fragment>
            <div className="p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Sign in to book a slot, track payments, and save favourites.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  to={`/login${authReturnTo}`}
                  onClick={() => setOpen(false)}
                  className="btn-primary w-full justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" /> Sign in
                </Link>
                <Link
                  to={`/register${authReturnTo}`}
                  onClick={() => setOpen(false)}
                  className="btn-ghost w-full justify-center gap-2 border border-slate-200 dark:border-slate-700"
                >
                  <UserPlus className="h-4 w-4" /> Sign up
                </Link>
              </div>
            </div>
            <div className="border-t border-slate-200/70 dark:border-slate-800/70 p-1.5 rounded-b-2xl">
              <ThemeToggleRow theme={theme} onToggle={toggleTheme} compact />
            </div>
          </Fragment>
        )}
      </div>
    </div>
  );
};

const ThemeToggleRow = ({
  theme,
  onToggle,
  compact,
}: {
  theme: 'light' | 'dark';
  onToggle: () => void;
  compact?: boolean;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition"
  >
    <span className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700/70">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </span>
    </span>
    {!compact && (
      <span
        aria-hidden
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
    )}
  </button>
);
