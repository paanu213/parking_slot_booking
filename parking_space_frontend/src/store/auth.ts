import { create } from 'zustand';
import type { UserDTO } from '@ps/types';

interface AuthState {
  user: UserDTO | null;
  accessToken: string | null;
  /** False until the initial /auth/me check resolves. Guards must wait for this
   *  before redirecting, otherwise a logged-in user is bounced to /login on a
   *  hard refresh / deep-link before the session has been hydrated. */
  hydrated: boolean;
  setSession: (u: UserDTO | null, t?: string | null) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  hydrated: false,
  setSession: (user, accessToken = null) => set({ user, accessToken, hydrated: true }),
  logout: () => set({ user: null, accessToken: null }),
}));
