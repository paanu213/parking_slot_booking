import { API_URL } from '@/lib/config';
import { cn } from '@/lib/cn';

type Provider = 'google' | 'facebook' | 'apple';

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'facebook', label: 'Continue with Facebook' },
  { id: 'apple', label: 'Continue with Apple' },
];

/**
 * Resolve where to send the user *after* login — the page they actually wanted,
 * not the auth page they're standing on. If we're on /login (or /register), that
 * route carries the real intent in its own `?returnTo=`, so prefer that; else use
 * the current path. Restrict to safe same-site relative paths (no protocol-relative
 * `//host`, no absolute URLs) to prevent open-redirects, and never loop back to an
 * auth page. Path + query are preserved so deep links like /explore?category=design
 * survive the round-trip.
 */
const resolvePostLoginPath = (): string => {
  const { pathname, search } = window.location;
  const inner = new URLSearchParams(search).get('returnTo');
  const candidate = inner ?? `${pathname}${search}`;
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) return '/';
  if (/^\/(login|register)(\/|\?|#|$)/.test(candidate)) return '/';
  return candidate;
};

export const OAuthButtons = ({ className }: { className?: string }) => {
  const go = (provider: Provider) => {
    const returnTo = encodeURIComponent(resolvePostLoginPath());
    const origin = encodeURIComponent(window.location.origin);
    window.location.href = `${API_URL}/auth/${provider}?portal=customer&returnTo=${returnTo}&origin=${origin}`;
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative my-4 text-center">
        <span className="relative z-10 bg-white px-2 text-xs uppercase text-slate-400 dark:bg-slate-950">
          or continue with
        </span>
        <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200 dark:bg-slate-800" />
      </div>
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => go(p.id)}
          className="btn-ghost w-full border border-slate-200 dark:border-slate-700"
        >
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );
};
