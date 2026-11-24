import { useEffect, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/Header';
const ExplorePage = lazyPage(() => import('@/pages/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const SpacesPage = lazyPage(() => import('@/pages/SpacesPage').then((m) => ({ default: m.SpacesPage })));
const ListYourSpacePage = lazyPage(() => import('@/pages/ListYourSpacePage').then((m) => ({ default: m.ListYourSpacePage })));
const ServicePartnerPage = lazyPage(() => import('@/pages/ServicePartnerPage').then((m) => ({ default: m.ServicePartnerPage })));
const PrivacyPage = lazyPage(() => import('@/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazyPage(() => import('@/pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const ShippingPolicyPage = lazyPage(() => import('@/pages/ShippingPolicyPage').then((m) => ({ default: m.ShippingPolicyPage })));
const LoginPage = lazyPage(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazyPage(() => import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const LocationDetailPage = lazyPage(() => import('@/pages/LocationDetailPage').then((m) => ({ default: m.LocationDetailPage })));
const CheckoutPage = lazyPage(() => import('@/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const BookingsPage = lazyPage(() => import('@/pages/BookingsPage').then((m) => ({ default: m.BookingsPage })));
const ProfilePage = lazyPage(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazyPage(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const HelpPage = lazyPage(() => import('@/pages/HelpPage').then((m) => ({ default: m.HelpPage })));
const SavedSpacesPage = lazyPage(() => import('@/pages/SavedSpacesPage').then((m) => ({ default: m.SavedSpacesPage })));
const MyVehiclesPage = lazyPage(() => import('@/pages/MyVehiclesPage').then((m) => ({ default: m.MyVehiclesPage })));
const ScanPage = lazyPage(() => import('@/pages/ScanPage').then((m) => ({ default: m.ScanPage })));
const QrCallingLandingPage = lazyPage(() => import('@/pages/QrCallingLandingPage').then((m) => ({ default: m.QrCallingLandingPage })));
const QrProductPage = lazyPage(() => import('@/pages/QrProductPage').then((m) => ({ default: m.QrProductPage })));
const QrOrdersPage = lazyPage(() => import('@/pages/QrOrdersPage').then((m) => ({ default: m.QrOrdersPage })));
const TransactionsPage = lazyPage(() => import('@/pages/TransactionsPage').then((m) => ({ default: m.TransactionsPage })));
import { useAuth } from '@/store/auth';
import { useSaved } from '@/store/savedSpaces';
import { api } from '@/lib/api';
import { lazyPage } from '@/lib/lazyPage';
import { PageLoader } from '@/components/PageLoader';

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
        <Suspense fallback={<PageLoader />}>
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
          <Route path="/qr-calling" element={<QrProductPage />} />
          <Route path="/qr-calling/order" element={<QrCallingLandingPage />} />
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
</Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
