import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

const getInitial = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('theme') as Theme | null;
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const apply = (t: Theme) => {
  const root = document.documentElement;
  root.classList.toggle('dark', t === 'dark');
  localStorage.setItem('theme', t);
};

export const useTheme = create<ThemeState>((set, get) => ({
  theme: getInitial(),
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    apply(next);
    set({ theme: next });
  },
  set: (t) => {
    apply(t);
    set({ theme: t });
  },
}));

if (typeof window !== 'undefined') apply(getInitial());
