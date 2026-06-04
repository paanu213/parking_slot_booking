import { create } from 'zustand';
import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Lightweight toast system. No external deps — Zustand store + a portal-less
// container the app mounts once at the root.
// ---------------------------------------------------------------------------

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => string;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, durationMs: 4000, ...t };
    set({ toasts: [...get().toasts, toast] });
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'error', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ tone: 'info', title, description }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

const toneStyles: Record<ToastTone, { ring: string; bg: string; icon: string; Icon: typeof CheckCircle2 }> = {
  success: {
    ring: 'ring-emerald-500/30',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  error: {
    ring: 'ring-rose-500/30',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    icon: 'text-rose-600 dark:text-rose-400',
    Icon: AlertCircle,
  },
  info: {
    ring: 'ring-sky-500/30',
    bg: 'bg-sky-50 dark:bg-sky-500/10',
    icon: 'text-sky-600 dark:text-sky-400',
    Icon: Info,
  },
};

const ToastItem = ({ t }: { t: Toast }) => {
  const dismiss = useToastStore((s) => s.dismiss);
  const tone = toneStyles[t.tone];
  const { Icon } = tone;

  useEffect(() => {
    const handle = setTimeout(() => dismiss(t.id), t.durationMs);
    return () => clearTimeout(handle);
  }, [t.id, t.durationMs, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-slate-200 p-3 pr-2 shadow-lg ring-1 backdrop-blur',
        'dark:border-slate-800',
        tone.bg,
        tone.ring,
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-900',
          tone.icon,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
        {t.description && (
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{t.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss"
        className="rounded-lg p-1 text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800/60"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export const Toaster = () => {
  const toasts = useToastStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end"
    >
      <div className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
};
