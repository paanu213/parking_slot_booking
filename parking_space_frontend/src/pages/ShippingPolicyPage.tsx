import { Link } from 'react-router-dom';
import { Mail, Phone, Truck } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@/lib/config';

const POINTS = [
  'Orders are generally processed and dispatched within 1–2 business days after confirmation.',
  'Delivery usually takes 3–7 business working days, depending on the delivery location.',
  'Delivery timelines may vary due to courier delays, weather, holidays, or other unforeseen circumstances.',
  'Customers will receive order/shipping updates when applicable.',
  'Please ensure the delivery address and contact details provided during checkout are accurate.',
];

/** Shipping policy for physical QR sticker orders — linked from the footer and the order form. */
export const ShippingPolicyPage = () => (
  <>
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/" className="text-xs text-slate-500 hover:text-brand-600 dark:text-slate-400">
        ← Back to home
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <Truck className="h-5 w-5" />
        </span>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Shipping Policy</h1>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <ul className="space-y-3">
          {POINTS.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Questions about your delivery? Reach us:</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
        >
          <Mail className="h-4 w-4" />
          {SUPPORT_EMAIL}
        </a>
        <a
          href={`tel:+91${SUPPORT_PHONE}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          <Phone className="h-4 w-4" />
          +91 {SUPPORT_PHONE_DISPLAY}
        </a>
      </div>
    </main>
    <Footer />
  </>
);
