import { Link } from 'react-router-dom';
import { Clock, Mail, Phone } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@/lib/config';

/**
 * Checkout / online payment is paused until we re-enable the booking flow.
 *
 * The previous version of this page integrated a third-party payment gateway —
 * removed for now so no gateway brand or script is loaded by the customer site.
 * When online booking ships again, restore the gateway integration alongside
 * lifting the BOOKING_ENABLED flag on LocationDetailPage.
 */
export const CheckoutPage = () => (
  <main className="mx-auto max-w-xl px-4 py-12">
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
        <Clock className="h-6 w-6" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold">Online payment coming soon</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        We're finalising the secure online payment flow. For now, please reach out to the host
        directly to confirm your slot — or talk to us:
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <a
          href={`tel:+91${SUPPORT_PHONE}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <Phone className="h-4 w-4" />
          +91 {SUPPORT_PHONE_DISPLAY}
        </a>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
        >
          <Mail className="h-4 w-4" />
          {SUPPORT_EMAIL}
        </a>
      </div>

      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
      >
        Back to home
      </Link>
    </div>
  </main>
);
