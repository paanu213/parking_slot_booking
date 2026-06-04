import { create } from 'zustand';
import type { UserDTO } from '@ps/types';

interface AuthState {
  user: UserDTO | null;
  accessToken: string | null;
  setSession: (u: UserDTO | null, t?: string | null) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setSession: (user, accessToken = null) => set({ user, accessToken }),
  logout: () => set({ user: null, accessToken: null }),
}));
