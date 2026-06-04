import { Link } from 'react-router-dom';
import { FileText, Mail, Phone } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { BRAND_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@/lib/config';

/**
 * Placeholder Terms of Service page.
 *
 * Same shape as the Privacy stub — interim copy + a contact strip so users
 * have somewhere real to land from the footer link while the full T&Cs are
 * being finalised.
 */
export const TermsPage = () => (
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
          <FileText className="h-5 w-5" />
        </span>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Terms of Service</h1>
      </div>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Effective from: <span className="font-medium">date to be finalised at launch</span>
      </p>

      <div className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <p>
          The full {BRAND_NAME} Terms of Service is being finalised with our legal counsel and
          will be published here at launch. The summary below captures the spirit of what we'll
          ship:
        </p>

        <Section title="Use of the platform">
          {BRAND_NAME} connects drivers with verified parking spaces. By booking a slot, you agree
          to use it for the parking purpose described and to follow the vendor's posted rules
          (height limit, hours, vehicle type, etc.).
        </Section>

        <Section title="Bookings and payments">
          Reservations are confirmed once payment clears. Prices, taxes, and cancellation windows
          are shown before you confirm — there are no hidden fees.
        </Section>

        <Section title="Cancellations & refunds">
          Free cancellation up to 2 hours before your booking starts. Refunds settle to the
          original payment method within standard banking timelines.
        </Section>

        <Section title="Liability">
          Vendors are responsible for the safety of their facility. {BRAND_NAME} is not the
          custodian of vehicles. Disputes are handled in good faith between rider, vendor, and our
          support team.
        </Section>

        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          This is interim copy. The binding Terms of Service will replace this content at launch.
          For specific clarifications, please get in touch.
        </p>
      </div>

      <ContactStrip />
    </main>
    <Footer />
  </>
);

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
