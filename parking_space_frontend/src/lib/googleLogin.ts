import { API_URL } from '@/lib/config';

/**
 * Start Google sign-in for the customer site and come back to `returnPath`
 * (a same-site path, optionally with a #section) once signed in.
 * Used by the forms that require an account: QR sticker order, List your space.
 */
export const startGoogleLogin = (returnPath: string) => {
  const returnTo = encodeURIComponent(returnPath);
  const origin = encodeURIComponent(window.location.origin);
  window.location.href = `${API_URL}/auth/google?portal=customer&returnTo=${returnTo}&origin=${origin}`;
};
