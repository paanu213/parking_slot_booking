import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  CheckCircle2,
  Zap,
  Shield,
  Clock,
  Car,
  Building2,
  BadgePercent,
  Sparkles,
  TrendingUp,
  Star,
  ChevronDown,
  ArrowRight,
  Quote,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CardSkeleton } from '@/components/Skeleton';
import { Footer } from '@/components/Footer';
import { Select } from '@/components/Select';
import { SaveButton } from '@/components/SaveButton';
import { cn } from '@/lib/cn';
import { VENDOR_URL } from '@/lib/config';

export interface Location {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  area?: string | null;
  images: { url: string }[];
  slots?: { hourlyPrice: number }[];
}

export const CITIES = ['Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Chennai'];

const HIGHLIGHTS = [
  { icon: Shield, title: 'Verified & secure', desc: 'Every lot is vetted, CCTV-covered, and staffed.' },
  { icon: Clock, title: 'Book in 60 seconds', desc: 'From search to QR pass in under a minute.' },
  { icon: Zap, title: 'Instant confirmation', desc: 'Reserve now, park in the next hour.' },
  { icon: BadgePercent, title: 'Best price promise', desc: "We match any cheaper rate you find. Period." },
];

const STEPS = [
  { icon: Search, title: 'Search', desc: 'Tell us where and when — we find nearby verified spots.' },
  { icon: Calendar, title: 'Reserve', desc: 'Pick a slot, lock in the price, pay securely.' },
  { icon: Car, title: 'Park & go', desc: 'Show the QR at entry. We handle the rest.' },
];

const TESTIMONIALS = [
  {
    name: 'Anitha R.',
    role: 'Daily commuter · HITEC City',
    body: 'I used to circle the office block for 20 minutes. Now I book my slot on the cab ride and walk straight in.',
    rating: 5,
  },
  {
    name: 'Vikram S.',
    role: 'Weekender · Banjara Hills',
    body: 'Grabbed a monthly pass at GVK One — covered, valet, and cheaper than the mall rate. Brilliant.',
    rating: 5,
  },
  {
    name: 'Meera K.',
    role: 'EV owner · Gachibowli',
    body: 'Finding an EV-friendly slot used to be a chore. AutoSahay literally filters for it. Instant fan.',
    rating: 5,
  },
];

const FAQS = [
  {
    q: 'Do I need to pay upfront?',
    a: 'Yes — reservations are confirmed the moment your payment clears. This guarantees the slot is held for you and keeps prices predictable.',
  },
  {
    q: 'Can I cancel or reschedule?',
    a: 'Free cancellations up to 2 hours before your start time. Reschedules are free as long as the new time is available.',
  },
  {
    q: 'Is the slot exclusively mine?',
    a: 'Absolutely. Once you book, the exact slot code is held for you for the full duration. No overbooking, ever.',
  },
  {
    q: 'What if the space is full when I arrive?',
    a: "That simply doesn't happen on reserved slots — but if it ever does, we refund 100% and help find you another space.",
  },
];

export const ExplorePage = () => {
  const [q, setQ] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const { data, isLoading } = useQuery({
    queryKey: ['locations', q, city],
    queryFn: async () => {
      const res = await api.get<{ items: Location[] }>('/locations', {
        params: { q: q || undefined, city: city || undefined },
      });
      return res.data;
    },
  });

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200/60 dark:border-slate-800/60">
        {/* Background layers */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-30 [background:radial-gradient(800px_400px_at_10%_0%,rgba(255,255,255,0.35),transparent_60%),radial-gradient(600px_300px_at_90%_100%,rgba(255,255,255,0.25),transparent_60%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:40px_40px]"
        />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-white/20 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Now live in 6 cities
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Never hunt for parking
            <br />
            <span className="bg-gradient-to-r from-amber-200 via-orange-200 to-rose-200 bg-clip-text text-transparent">
              ever again.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/80 sm:text-lg">
            Book verified, secure parking by the hour, day, or month — near your office, the mall, or
            tonight's concert. Instant QR entry, zero drama.
          </p>

          {/* Search card */}
          <div className="mt-8 max-w-3xl rounded-2xl bg-white/95 p-3 shadow-2xl shadow-slate-900/20 ring-1 ring-white/30 backdrop-blur-md dark:bg-slate-900/90">
            <div className="grid gap-2 sm:grid-cols-[2fr,1fr,auto]">
              <label className="relative flex items-center rounded-xl bg-slate-50 px-3 dark:bg-slate-800/60">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Area, landmark, or parking name"
                  aria-label="Search"
                  className="w-full bg-transparent px-2 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                />
              </label>
              <div className="flex items-center rounded-xl bg-slate-50 px-3 dark:bg-slate-800/60">
                <Select
                  value={city ?? ''}
                  onChange={(v) => setCity(v || null)}
                  options={CITIES.map((c) => ({ value: c, label: c }))}
                  placeholder="All cities"
                  ariaLabel="City"
                  leadingIcon={<MapPin className="h-4 w-4 text-slate-500" />}
                  triggerClassName="w-full px-2 py-3 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                className="btn-primary h-12 w-full gap-2 sm:w-auto sm:px-6"
                onClick={() => {
                  document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Find slots <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Quick city chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2 px-1 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Popular:</span>
              {CITIES.slice(0, 5).map((c) => (
                <button
                  key={c}
                  onClick={() => setCity(c === city ? null : c)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition',
                    c === city
                      ? 'bg-brand-600 text-white shadow'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Trust stats */}
          <div className="mt-10 grid grid-cols-2 gap-6 text-white sm:grid-cols-4">
            {[
              { v: '12,400+', l: 'Verified slots' },
              { v: '48 sec', l: 'Avg booking time' },
              { v: '99.9%', l: 'Uptime at peak' },
              { v: '4.8★', l: 'Customer rating' },
            ].map((s) => (
              <div key={s.l}>
                <p className="font-display text-2xl font-bold sm:text-3xl">{s.v}</p>
                <p className="mt-1 text-xs text-white/70 sm:text-sm">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Why AutoSahay</p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">A proper parking experience</h2>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/10"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-brand-500/5 text-brand-600 ring-1 ring-brand-500/20 transition group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED LOCATIONS */}
      <section id="results" className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600">
              <TrendingUp className="h-3.5 w-3.5" /> Trending near you
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
              {city ? `Parking in ${city}` : 'Popular parking spots'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Fresh listings, recently booked by drivers like you.
            </p>
          </div>

          {/* Right: inline city switcher + View all → */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">City</span>
              <Select
                value={city ?? ''}
                onChange={(v) => setCity(v || null)}
                options={CITIES.map((c) => ({ value: c, label: c }))}
                placeholder="All cities"
                ariaLabel="Change city"
                leadingIcon={<MapPin className="h-3.5 w-3.5 text-brand-500" />}
                triggerClassName="min-w-[140px] text-sm font-semibold text-slate-900 dark:text-slate-100"
              />
            </div>
            <Link
              to={`/spaces${city ? `?city=${encodeURIComponent(city)}` : ''}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            {data && !isLoading && (
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:inline-block dark:bg-slate-800 dark:text-slate-300">
                {data.items.length} result{data.items.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          ) : data && data.items.length > 0 ? (
            data.items.map((l) => <LocationCard key={l.id} loc={l} />)
          ) : (
            <div className="col-span-full card p-10 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                No slots match right now. Try a different city or clear the search.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-brand-50/40 p-8 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/40 sm:p-12">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">How it works</p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Park in three simple steps</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-700">
                  <Icon className="h-6 w-6 text-brand-600" />
                </span>
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Loved by drivers</p>
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">What people are saying</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="card p-6 transition hover:shadow-md">
              <Quote className="h-6 w-6 text-brand-500/60" />
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{t.body}</p>
              <div className="mt-4 flex items-center gap-1 text-amber-500">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Questions</p>
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Frequently asked</h2>
        </div>
        <div className="space-y-2">
          {FAQS.map((f, i) => (
            <div
              key={f.q}
              className={cn(
                'card overflow-hidden transition',
                openFaq === i && 'ring-1 ring-brand-500/30',
              )}
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={openFaq === i}
              >
                <span className="text-sm font-semibold">{f.q}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-slate-500 transition-transform',
                    openFaq === i && 'rotate-180',
                  )}
                />
              </button>
              <div
                className={cn(
                  'grid overflow-hidden transition-all duration-200',
                  openFaq === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
              >
                <div className="min-h-0">
                  <p className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-400">{f.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-8 text-white sm:p-12">
          <div
            aria-hidden
            className="absolute inset-0 opacity-25 [background:radial-gradient(600px_300px_at_0%_0%,rgba(255,255,255,0.6),transparent_60%)]"
          />
          <div className="relative grid items-center gap-6 md:grid-cols-[1.5fr,1fr]">
            <div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Own a parking lot? Start earning today.</h2>
              <p className="mt-2 max-w-lg text-sm text-white/80 sm:text-base">
                List your slot in minutes. We bring the customers, handle payments, and payout weekly.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/list-your-space" className="btn bg-white text-brand-700 hover:bg-slate-100">
                  <Building2 className="mr-2 h-4 w-4" /> List your space
                </Link>
                <a
                  href={VENDOR_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn border border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  Partner login
                </a>
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur">
              <ul className="space-y-2 text-sm">
                {[
                  'Weekly payouts via UPI',
                  'Zero setup cost',
                  'Dynamic pricing handled for you',
                  'You stay fully in control',
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export const LocationCard = ({ loc }: { loc: Location }) => {
  const hasSlots = (loc.slots?.length ?? 0) > 0;
  const minHour = hasSlots
    ? Math.min(...loc.slots!.map((s) => Number(s.hourlyPrice)))
    : null;

  const inner = (
    <>
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {loc.images?.[0]?.url ? (
          <img
            src={loc.images[0].url}
            alt={loc.name}
            loading="lazy"
            decoding="async"
            className={cn(
              'h-full w-full object-cover transition duration-500',
              hasSlots && 'group-hover:scale-105',
              !hasSlots && 'opacity-60',
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Car className="h-8 w-8" />
          </div>
        )}

        {/* Top-right: save heart */}
        <SaveButton
          locationId={loc.id}
          className="absolute right-3 top-3 h-8 w-8 rounded-full bg-white/90 text-slate-600 shadow backdrop-blur hover:text-rose-500 dark:bg-slate-900/80 dark:text-slate-300"
        />

        {/* Top-left badges */}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow backdrop-blur">
            <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-500" />
            Verified
          </span>
          {!hasSlots && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow backdrop-blur">
              Coming Soon
            </span>
          )}
        </div>

        {/* Bottom-right: price or coming-soon pill */}
        {hasSlots ? (
          <div className="absolute bottom-3 right-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            From ₹{minHour}/hr
          </div>
        ) : (
          <div className="absolute bottom-3 right-3 rounded-full bg-slate-950/60 px-2.5 py-1 text-xs text-slate-300 backdrop-blur">
            Slots opening soon
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-display font-semibold leading-tight">{loc.name}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{loc.addressLine}, {loc.city}</span>
        </p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-amber-500">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              4.{5 + (loc.id.charCodeAt(0) % 4)}
            </span>
            <span className="text-slate-400">· CCTV · 24×7</span>
          </div>
          {hasSlots && (
            <span className="flex items-center gap-1 text-xs font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">
              Book <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
          {!hasSlots && (
            <span className="text-xs text-slate-400 italic">No slots yet</span>
          )}
        </div>
      </div>
    </>
  );

  if (!hasSlots) {
    return (
      <div className="card group overflow-hidden cursor-default select-none opacity-80">
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={`/locations/${loc.id}`}
      className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      {inner}
    </Link>
  );
};
