import { cn } from '@/lib/cn';

const PALETTES = [
  'from-fuchsia-500 via-rose-500 to-orange-400',
  'from-sky-500 via-indigo-500 to-violet-500',
  'from-emerald-500 via-teal-500 to-cyan-500',
  'from-amber-500 via-orange-500 to-rose-500',
  'from-violet-500 via-purple-500 to-fuchsia-500',
  'from-lime-500 via-emerald-500 to-teal-500',
  'from-rose-500 via-pink-500 to-fuchsia-500',
  'from-blue-500 via-cyan-500 to-teal-500',
];

export const gradientFor = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length]!;
};

export const initialsFor = (name?: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
};

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | null;
  className?: string;
}

const sizeMap = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };
const dotMap = { sm: 'h-2 w-2 right-0 bottom-0', md: 'h-2.5 w-2.5 right-0 bottom-0', lg: 'h-3 w-3 right-0.5 bottom-0.5' };

export const Avatar = ({ name, src, size = 'md', status = null, className }: AvatarProps) => {
  const gradient = gradientFor(name ?? 'user');
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name ?? 'avatar'}
          className={cn(sizeMap[size], 'rounded-full object-cover ring-2 ring-white dark:ring-slate-900 shadow')}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            sizeMap[size],
            'rounded-full bg-gradient-to-br text-white font-semibold',
            'flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow',
            gradient,
          )}
        >
          {initialsFor(name)}
        </span>
      )}
      {status && (
        <span
          className={cn(
            'absolute rounded-full ring-2 ring-white dark:ring-slate-900',
            dotMap[size],
            status === 'online' ? 'bg-emerald-500' : 'bg-slate-400',
          )}
        >
          {status === 'online' && (
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
          )}
        </span>
      )}
    </span>
  );
};
