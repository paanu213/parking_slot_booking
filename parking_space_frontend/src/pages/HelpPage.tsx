import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, HelpCircle, Mail, Phone } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { BRAND_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@/lib/config';
import { cn } from '@/lib/cn';

const FAQS = [
  {
    q: 'How do I find parking near me?',
    a: `Use the search and city filter on the home page or the "All parking spaces" page. Pick your city and locality to narrow down to spaces near your destination.`,
  },
  {
    q: 'How do I contact a parking space owner?',
    a: 'Open any space\'s detail page and use the "Call host" button — it dials the property\'s contact number directly so you can confirm availability and details.',
  },
  {
    q: 'How do I save a space for later?',
    a: 'Tap the heart icon on any space detail page. Saved spaces appear under "Saved spaces" in your profile menu so you can get back to them quickly.',
  },
  {
    q: 'Is online booking available?',
    a: `Online booking and payment are coming soon. For now, find a space, then call the host directly to reserve. We'll notify you when instant booking goes live.`,
  },
  {
    q: 'How do I list my own parking space?',
    a: 'Head to "List your space" from the footer. Fill the short form and our partnerships team will reach out within 24 hours to get you set up.',
  },
];

export const HelpPage = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600">
          <ArrowLeft className="h-3 w-3" /> Back to home
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <HelpCircle className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold">Help &amp; support</h1>
            <p className="text-sm text-slate-500">We're here to help — reach out anytime</p>
          </div>
        </div>

        {/* Contact cards */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a
            href={`tel:+91${SUPPORT_PHONE}`}
            className="card group flex items-center gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Phone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Call us</p>
              <p className="font-semibold">+91 {SUPPORT_PHONE_DISPLAY}</p>
            </div>
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="card group flex items-center gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email us</p>
              <p className="font-semibold break-all">{SUPPORT_EMAIL}</p>
            </div>
          </a>
        </div>

        {/* FAQ accordion */}
        <h2 className="mt-10 font-display text-lg font-bold">Frequently asked questions</h2>
        <div className="mt-4 space-y-2">
          {FAQS.map((f, i) => (
            <div
              key={f.q}
              className={cn(
                'overflow-hidden rounded-xl border transition',
                open === i ? 'border-brand-500/40 bg-brand-50/30 dark:bg-brand-500/5' : 'border-slate-200 dark:border-slate-700',
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold">{f.q}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform', open === i && 'rotate-180')} />
              </button>
              <div className={cn('grid overflow-hidden transition-all', open === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                <div className="min-h-0">
                  <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-400">{f.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Still stuck? Email us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-brand-600 hover:underline">
            {SUPPORT_EMAIL}
          </a>{' '}
          and the {BRAND_NAME} team will get back within a day.
        </p>
      </main>
      <Footer />
    </>
  );
};
