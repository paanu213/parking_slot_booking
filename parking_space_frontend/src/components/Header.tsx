import { Link, NavLink } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/store/theme';
import { cn } from '@/lib/cn';
import { BRAND_NAME, LOGO_URL } from '@/lib/config';
import { ProfileMenu } from '@/components/ProfileMenu';

export const Header = () => {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/80">
      <div className="mx-auto flex h-20 max-w-6xl items-center gap-4 px-3 sm:px-4 sm:gap-8">
        {/* LEFT: brand — logo + wordmark text */}
        <Link to="/" className="flex items-center gap-2 sm:gap-3" aria-label={BRAND_NAME}>
          <img
            src={LOGO_URL}
            alt=""
            className="h-14 w-auto object-contain"
            loading="eager"
            decoding="async"
          />
          <span className="hidden font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:inline">
            {BRAND_NAME}
          </span>
        </Link>

        {/* Center nav */}
        <nav className="flex items-center gap-1 text-sm">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-1.5 transition',
                'hover:bg-slate-100 dark:hover:bg-slate-800',
                isActive && 'bg-slate-100 font-semibold dark:bg-slate-800',
              )
            }
          >
            Explore
          </NavLink>
        </nav>

        {/* Spacer pushes profile cluster to right */}
        <div className="flex-1" />

        {/* RIGHT: theme toggle + profile */}
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
  );
};
