import { API_URL } from '@/lib/config';
import { cn } from '@/lib/cn';

type Provider = 'google' | 'facebook' | 'apple';

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'facebook', label: 'Continue with Facebook' },
  { id: 'apple', label: 'Continue with Apple' },
];

export const OAuthButtons = ({ className }: { className?: string }) => {
  const go = (provider: Provider) => {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `${API_URL}/auth/${provider}?portal=customer&returnTo=${returnTo}`;
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
