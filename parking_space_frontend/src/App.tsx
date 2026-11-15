import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { ExplorePage } from '@/pages/ExplorePage';
import { SpacesPage } from '@/pages/SpacesPage';
import { ListYourSpacePage } from '@/pages/ListYourSpacePage';
import { ServicePartnerPage } from '@/pages/ServicePartnerPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { TermsPage } from '@/pages/TermsPage';
import { ShippingPolicyPage } from '@/pages/ShippingPolicyPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { LocationDetailPage } from '@/pages/LocationDetailPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { BookingsPage } from '@/pages/BookingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { HelpPage } from '@/pages/HelpPage';
import { SavedSpacesPage } from '@/pages/SavedSpacesPage';
import { MyVehiclesPage } from '@/pages/MyVehiclesPage';
import { ScanPage } from '@/pages/ScanPage';
import { QrCallingLandingPage } from '@/pages/QrCallingLandingPage';
import { QrOrdersPage } from '@/pages/QrOrdersPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { useAuth } from '@/store/auth';
import { useSaved } from '@/store/savedSpaces';
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
 * Once the user is known to be signed in, fetch their saved-space IDs so the
 * heart buttons across the app reflect the correct state immediately.
 * Clears the set on sign-out.
 */
const HydrateSavedSpaces = () => {
  const user = useAuth((s) => s.user);
  const setIds = useSaved((s) => s.setIds);
  useEffect(() => {
    if (!user) {
      setIds([]);
      return;
    }
    api
      .get('/customer/me/saved-spaces/ids')
      .then((r) => setIds(r.data?.ids ?? []))
      .catch(() => setIds([]));
  }, [user, setIds]);
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

const QR_ROUTE = /^\/(qr-calling|qr-orders|vehicles|c)(\/|$)/;

/** QR Calling pages use green as the primary colour — see `.theme-qr` in styles/index.css. */
const QrThemeSync = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    document.documentElement.classList.toggle('theme-qr', QR_ROUTE.test(pathname));
  }, [pathname]);
  return null;
};

const Protected = ({ children }: { children: React.ReactNode }) => {
  const { user, hydrated } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    // Wait for the session check to finish before deciding — otherwise a
    // logged-in user is wrongly redirected on a hard refresh / deep-link.
    if (hydrated && !user) nav(`/login?returnTo=${encodeURIComponent(loc.pathname)}`, { replace: true });
  }, [hydrated, user, loc.pathname, nav]);
  if (!hydrated || !user) return null;
  return <>{children}</>;
};

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <HydrateSession />
        <HydrateSavedSpaces />
        <ScrollToTop />
        <QrThemeSync />
        <Header />
        <Routes>
          <Route path="/" element={<ExplorePage />} />
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/list-your-space" element={<ListYourSpacePage />} />
          <Route path="/become-partner" element={<ServicePartnerPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/locations/:id" element={<LocationDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/c" element={<ScanPage />} />
          <Route path="/c/:token" element={<ScanPage />} />
          <Route path="/qr-calling" element={<QrCallingLandingPage />} />
          <Route
            path="/profile"
            element={
              <Protected>
                <ProfilePage />
              </Protected>
            }
          />
          <Route
            path="/settings"
            element={
              <Protected>
                <SettingsPage />
              </Protected>
            }
          />
          <Route
            path="/saved"
            element={
              <Protected>
                <SavedSpacesPage />
              </Protected>
            }
          />
          <Route
            path="/vehicles"
            element={
              <Protected>
                <MyVehiclesPage />
              </Protected>
            }
          />
          <Route
            path="/qr-orders"
            element={
              <Protected>
                <QrOrdersPage />
              </Protected>
            }
          />
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
          <Route
            path="/transactions"
            element={
              <Protected>
                <TransactionsPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
