import { create } from 'zustand';
import type { UserDTO } from '@ps/types';

interface AuthState {
  user: UserDTO | null;
  loading: boolean;
  setSession: (u: UserDTO | null) => void;
  setLoading: (v: boolean) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setSession: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, loading: false }),
}));
