import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Menu,
  X,
  LayoutDashboard,
  MapPin,
  CalendarCheck,
  Building2,
  Sun,
  Moon,
} from 'lucide-react';
import { ProfileMenu } from '@/components/ProfileMenu';
import { useTheme } from '@/store/theme';
import { cn } from '@/lib/cn';
import { BRAND_NAME, LOGO_URL } from '@/lib/config';

const NAV: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/spaces', label: 'Parking Spaces', icon: MapPin },
  { to: '/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/profile', label: 'Profile', icon: Building2 },
];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
          {/* LEFT: menu toggle (mobile) + brand */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2" aria-label={`${BRAND_NAME} Vendor Portal`}>
            <img
              src={LOGO_URL}
              alt={BRAND_NAME}
              className="h-8 w-auto object-contain"
              loading="eager"
              decoding="async"
            />
            <span className="hidden text-sm font-semibold text-slate-500 sm:inline">Vendor</span>
          </Link>
          <div className="flex-1" />
          {/* RIGHT: theme + profile */}
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <ProfileMenu />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200/70 p-4 dark:border-slate-800/70 md:block">
          <SidebarNav onNavigate={() => {}} />
        </aside>

        <div
          className={cn('fixed inset-0 z-40 md:hidden transition', mobileOpen ? 'visible' : 'invisible')}
          aria-hidden={!mobileOpen}
        >
          <div
            onClick={() => setMobileOpen(false)}
            className={cn(
              'absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity',
              mobileOpen ? 'opacity-100' : 'opacity-0',
            )}
          />
          <aside
            className={cn(
              'absolute left-0 top-0 h-full w-72 max-w-[85%] border-r border-slate-200/70 bg-white p-4 shadow-2xl transition-transform dark:border-slate-800/70 dark:bg-slate-950',
              mobileOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-lg font-bold">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

const SidebarNav = ({ onNavigate }: { onNavigate: () => void }) => (
  <nav className="space-y-1 text-sm">
    {NAV.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-xl px-3 py-2 transition',
            'hover:bg-slate-100 dark:hover:bg-slate-800/70',
            isActive &&
              'bg-gradient-to-r from-brand-500/10 to-transparent font-semibold text-brand-700 dark:text-brand-300',
          )
        }
      >
        <Icon className="h-4 w-4" />
        {label}
      </NavLink>
    ))}
  </nav>
);
