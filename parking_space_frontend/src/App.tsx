import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { ExplorePage } from '@/pages/ExplorePage';
import { SpacesPage } from '@/pages/SpacesPage';
import { ListYourSpacePage } from '@/pages/ListYourSpacePage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { TermsPage } from '@/pages/TermsPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { LocationDetailPage } from '@/pages/LocationDetailPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { BookingsPage } from '@/pages/BookingsPage';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

/**
 * On first paint, ask the API who we are. Either:
 *  - the access cookie is valid → user is set;
 *  - the access cookie is missing/expired but refresh is valid → the axios
 *    interceptor silently refreshes and retries → user is set;
 *  - both are invalid → we treat this as a signed-out session.
 */
const HydrateSession = () => {
  const setSession = useAuth((s) => s.setSession);
  useEffect(() => {
    api
      .get('/auth/me')
      .then((r) => setSession(r.data?.user ?? null))
      .catch(() => setSession(null));
  }, [setSession]);
  return null;
};

/**
 * React Router v6 keeps the previous scroll position on navigation by default,
 * which feels wrong on a content site — clicking a footer link drops the user
 * at the bottom of the next page instead of its hero. Reset the scroll on
 * every pathname change, unless the new URL has a `#anchor` (then let the
 * browser handle the in-page scroll).
 */
const ScrollToTop = () => {
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) return; // honour in-page anchors like /list-your-space#lead-form
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [loc.pathname, loc.search, loc.hash]);
  return null;
};

const Protected = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    if (!user) nav(`/login?returnTo=${encodeURIComponent(loc.pathname)}`, { replace: true });
  }, [user, loc.pathname, nav]);
  if (!user) return null;
  return <>{children}</>;
};

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <HydrateSession />
        <ScrollToTop />
        <Header />
        <Routes>
          <Route path="/" element={<ExplorePage />} />
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/list-your-space" element={<ListYourSpacePage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/locations/:id" element={<LocationDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/bookings"
            element={
              <Protected>
                <BookingsPage />
              </Protected>
            }
          />
          <Route
            path="/checkout/:id"
            element={
              <Protected>
                <CheckoutPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
