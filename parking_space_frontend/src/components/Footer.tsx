import { Link } from 'react-router-dom';
import { Mail, Phone, Shield, BadgeCheck, HeartHandshake } from 'lucide-react';
import {
  BRAND_NAME,
  LOGO_URL,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_PHONE_DISPLAY,
  VENDOR_URL,
} from '@/lib/config';

interface FooterLink {
  label: string;
  to: string;
  /** Optional click handler — useful for forcing a scroll-to-top when the link
   *  target is the same as the current path (router does nothing in that case). */
  onClick?: () => void;
}

// A `to` starting with `http(s)://` is treated as an external link.
const isExternal = (to: string) => /^https?:\/\//i.test(to);

const Column = ({ title, items }: { title: string; items: FooterLink[] }) => (
  <div>
    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
    <ul className="mt-3 space-y-2 text-sm">
      {items.map((i) => (
        <li key={i.label}>
          {isExternal(i.to) ? (
            <a
              href={i.to}
              target="_blank"
              rel="noreferrer"
              className="text-slate-600 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
            >
              {i.label}
            </a>
          ) : (
            <Link
              to={i.to}
              onClick={i.onClick}
              className="text-slate-600 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
            >
              {i.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  </div>
);

/** Smooth-scroll to the top of the document. Used by footer links whose target
 *  is the same as the current path (router won't fire its location-change
 *  handler in that case, so we have to nudge the scroll ourselves). */
const scrollTop = () =>
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });

const TRUST = [
  { icon: Shield, title: 'Verified spaces only', desc: 'Every slot is vetted before it goes live.' },
  { icon: BadgeCheck, title: 'Secure payments', desc: 'Bank-grade encryption and instant refunds.' },
  { icon: HeartHandshake, title: '24×7 support', desc: 'Talk to a human in under a minute.' },
];

export const Footer = () => (
  <footer className="mt-16 border-t border-slate-200/70 bg-gradient-to-b from-white to-slate-50 dark:border-slate-800/70 dark:from-slate-950 dark:to-slate-900">
    {/* Trust strip */}
    <div className="border-b border-slate-200/70 dark:border-slate-800/70">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-3">
        {TRUST.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 ring-1 ring-brand-500/20">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Main footer */}
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-2">
        <Link to="/" className="flex items-center gap-3" aria-label={BRAND_NAME}>
          <img
            src={LOGO_URL}
            alt=""
            className="h-12 w-auto object-contain"
            loading="lazy"
            decoding="async"
          />
          <span className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {BRAND_NAME}
          </span>
        </Link>
        <p className="mt-3 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          India's friendliest parking marketplace. Hourly, daily, and monthly spots — verified, covered, and
          cashless. Wherever you're headed, we've saved you a space.
        </p>
        {/* Social-media icon row removed — restore once real account URLs are
            available so each icon points at the actual page. */}
        <div className="mt-5 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-2 transition hover:text-brand-600"
          >
            <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
          </a>
          <a
            href={`tel:+91${SUPPORT_PHONE}`}
            className="flex items-center gap-2 transition hover:text-brand-600"
          >
            <Phone className="h-4 w-4" /> +91 {SUPPORT_PHONE_DISPLAY}
          </a>
        </div>
      </div>

      <Column
        title="Quick links"
        items={[
          // Find parking always lands on the Explore page hero, even if the
          // user is already on /. The onClick guarantees a scroll reset that
          // the router's path-change listener can't trigger for same-path nav.
          { label: 'Find parking', to: '/', onClick: scrollTop },
          { label: 'List your space', to: '/list-your-space' },
          { label: 'Partner portal', to: VENDOR_URL },
        ]}
      />
      <Column
        title="Company"
        items={[
          { label: 'Privacy policy', to: '/privacy' },
          { label: 'Terms', to: '/terms' },
        ]}
      />
    </div>

    <div className="border-t border-slate-200/70 dark:border-slate-800/70">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center dark:text-slate-400">
        <p>© {new Date().getFullYear()} {BRAND_NAME} Technologies. All rights reserved.</p>
        <p className="flex items-center gap-1">
          Crafted in Hyderabad · Made with <span className="text-rose-500">♥</span> for commuters
        </p>
      </div>
    </div>
  </footer>
);
