import { Link } from 'react-router-dom';
import { Mail, Phone, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { BRAND_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@/lib/config';

/**
 * Placeholder Privacy Policy page.
 *
 * The full legal copy is in flight with our counsel. This stub gives users a
 * clear status, the contact channels to ask data questions in the meantime,
 * and an `effective from` date placeholder we can fill on launch.
 */
export const PrivacyPage = () => (
  <>
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        to="/"
        className="text-xs text-slate-500 hover:text-brand-600 dark:text-slate-400"
      >
        ← Back to home
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Privacy Policy</h1>
      </div>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Effective from: <span className="font-medium">date to be finalised at launch</span>
      </p>

      <div className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <p>
          The full {BRAND_NAME} privacy policy is being finalised with our legal counsel and will
          be published here at launch. In short, here's how we'll treat your data:
        </p>

        <Section title="What we collect">
          Your name, email, and phone (so we can confirm a booking), the parking spots you book
          (to issue passes and refunds), and basic device + payment metadata that lets us run the
          service securely.
        </Section>

        <Section title="What we don't do">
          We do not sell your personal data. We do not share it with advertisers. Vendor partners
          only see the contact details needed to fulfil your specific booking.
        </Section>

        <Section title="Your choices">
          You can request a copy or deletion of your data at any time by writing to{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-semibold text-brand-600 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </Section>

        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          This is interim copy. For specific questions about how we'll process your data, please
          reach out using the channels below.
        </p>
      </div>

      <ContactStrip />
    </main>
    <Footer />
  </>
);

// ── Trans-pages helpers, kept local to avoid a tiny new shared module ──
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    <p className="mt-1">{children}</p>
  </div>
);

const ContactStrip = () => (
  <div className="mt-6 grid gap-2 sm:grid-cols-2">
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
);
