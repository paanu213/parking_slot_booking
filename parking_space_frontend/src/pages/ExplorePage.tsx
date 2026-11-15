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
  Bike,
  Truck,
  Building2,
  BadgePercent,
  Sparkles,
  TrendingUp,
  Star,
  ChevronDown,
  ArrowRight,
  Quote,
  Wrench,
  Cog,
  Droplets,
  Disc3,
  SprayCan,
  Handshake,
  Phone,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CardSkeleton } from '@/components/Skeleton';
import { Footer } from '@/components/Footer';
import { Select } from '@/components/Select';
import { SaveButton } from '@/components/SaveButton';
import { useCities } from '@/hooks/useCities';
import { cn } from '@/lib/cn';
import { VENDOR_URL } from '@/lib/config';

export interface Location {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  area?: string | null;
  images: { url: string }[];
  slots?: { hourlyPrice: number; vehicleType?: string }[];
}

// Cities are loaded dynamically from the API (see useCities) so the filter
// always reflects what's really in the catalog.

// Short vehicle-type badges shown on cards so users can tell at a glance what
// kind of parking a space offers without opening the detail page.
const VEHICLE_BADGE: Record<string, { label: string; Icon: typeof Car }> = {
  TWO_WHEELER:  { label: '2-Wheeler', Icon: Bike  },
  FOUR_WHEELER: { label: '4-Wheeler', Icon: Car   },
  CAR:          { label: '4-Wheeler', Icon: Car   }, // legacy value
  HEAVY:        { label: 'Heavy',     Icon: Truck },
};

/** Distinct vehicle types a space offers (de-duped, legacy CAR folded into 4-Wheeler). */
export const vehicleBadgesFor = (slots?: { vehicleType?: string }[]) => {
  const seen = new Set<string>();
  const out: { label: string; Icon: typeof Car }[] = [];
  for (const s of slots ?? []) {
    const badge = s.vehicleType ? VEHICLE_BADGE[s.vehicleType] : undefined;
    if (badge && !seen.has(badge.label)) {
      seen.add(badge.label);
      out.push(badge);
    }
  }
  return out;
};

const HIGHLIGHTS = [
  { icon: Shield, title: 'Verified & secure', desc: 'Every lot is vetted, CCTV-covered, and staffed.' },
  // { icon: Clock, title: 'Book in 60 seconds', desc: 'From search to QR pass in under a minute.' },
  // { icon: Zap, title: 'Instant confirmation', desc: 'Reserve now, park in the next hour.' },
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

// Upcoming auto-service verticals we're recruiting partners for.
const SERVICES = [
  { icon: Wrench,   label: 'Mechanic' },
  { icon: Cog,      label: 'Car spare parts' },
  { icon: Droplets, label: 'Car wash' },
  { icon: Car,      label: 'Used cars / bikes' },
  { icon: Disc3,    label: 'Wheel alignment & balancing' },
  { icon: SprayCan, label: 'Car dent / paint service' },
  { icon: Truck,    label: 'Car towing service' },
];

const PARTNER_PHONE = '+91 83283 52730';

export const ExplorePage = () => {
  const [q, setQ] = useState('');
  const [city, setCity] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const cities = useCities();

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
      {/* QR CALLING HERO.
          Mobile and desktop are two separate layouts (only one is ever displayed):
          - Mobile: dark poster style — copy over the photo, green accents, feature row at the bottom.
          - Desktop (md+): light background, copy left, product photo right. */}
      <section className="relative border-b border-slate-200/60 md:bg-white dark:border-slate-800/60 md:dark:bg-slate-950">
        {/* ── Mobile hero ─────────────────────────────────────────────── */}
        <div className="relative isolate overflow-hidden bg-slate-950 md:hidden">
          <div aria-hidden className="absolute inset-0 -z-10">
            {/* Soft, dark fill from the same photo (trees / sky bokeh) behind the headline */}
            <img
              src="/images/qr-hero-scan.jpg"
              alt=""
              className="absolute inset-0 h-full w-full scale-110 object-cover object-[30%_center] blur-md brightness-[0.45]"
              loading="eager"
            />
            {/* The scan itself — phone + sticker on the car — crisp, anchored to the bottom */}
            <div className="absolute inset-x-0 bottom-0 aspect-[3/4] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_45%)] [mask-image:linear-gradient(to_bottom,transparent,black_45%)]">
              <img
                src="/images/qr-hero-scan.jpg"
                srcSet="/images/qr-hero-scan.jpg 900w, /images/qr-hero-scan@2x.jpg 1400w"
                sizes="200vw"
                alt=""
                className="h-full w-full object-cover object-[88%_center]"
                loading="eager"
                fetchPriority="high"
              />
            </div>
            {/* Readability: dark from the left (copy column) and the bottom (feature row) */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/45 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent via-45% to-slate-950" />
          </div>

          <div className="px-5 pb-7 pt-10">
            <span aria-hidden className="block h-1 w-14 rounded-full bg-emerald-400" />

            <h1 className="mt-5 font-display font-extrabold leading-[1.02] tracking-tight text-white">
              <span className="block text-[2.75rem]">One Scan.</span>
              <span className="block text-[2.75rem] text-emerald-400">One Call.</span>
              <span className="mt-1 block text-[1.7rem]">No Number Shared.</span>
            </h1>

            <p className="mt-4 max-w-[19rem] text-[15px] leading-relaxed text-slate-200">
              A simple QR sticker for your car or bike. Let anyone contact you when they need to,
              while your phone number stays private.
            </p>

            <div className="mt-6">
              <Link
                to="/qr-calling"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 text-[15px] font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-600 hover:to-green-600"
              >
                Get Your QR Sticker <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Space for the photo to show — the phone scanning the sticker */}
            <div aria-hidden className="h-44" />

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { icon: Lock, circle: 'bg-gradient-to-br from-blue-500 to-blue-800 text-white ring-blue-300/40', title: 'Call masking' },
                { icon: Phone, circle: 'bg-gradient-to-br from-emerald-500 to-green-700 text-white ring-emerald-300/40', title: 'Instant calling' },
                { icon: ShieldCheck, circle: 'bg-gradient-to-br from-amber-700 to-yellow-950 text-amber-300 ring-amber-400/50', title: 'Safe & secure' },
                { icon: Car, circle: 'bg-gradient-to-br from-blue-600 to-indigo-900 text-white ring-blue-300/40', title: 'For cars & bikes' },
              ].map(({ icon: Icon, circle, title }) => (
                <div key={title} className="flex flex-col items-center text-center">
                  <span className={cn('flex h-12 w-12 items-center justify-center gap-0.5 rounded-full shadow-lg ring-2', circle)}>
                    {Icon === Car ? (
                      <><Car className="h-4 w-4" /><Bike className="h-4 w-4" /></>
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </span>
                  <p className="mt-2 text-[12px] font-bold leading-tight text-white">{title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Desktop hero (unchanged design) ─────────────────────────── */}
        <div className="theme-qr mx-auto hidden max-w-6xl items-center gap-10 px-4 py-14 md:grid md:grid-cols-[1.15fr,1fr] md:gap-8 lg:gap-12">
          {/* Left: copy */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                New
              </span>
              <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                AutoSahay QR for Cars &amp; Bikes
              </span>
            </div>

            {/* Visual headline only — the mobile hero above carries the page's h1 */}
            <p role="heading" aria-level={2} className="mt-4 font-display text-5xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-white">
              Park with confidence.
              <br />
              <span className="text-emerald-500">Stay reachable.</span>
            </p>

            <p className="mt-4 max-w-md text-base text-slate-500 dark:text-slate-400">
              A simple QR code sticker for your vehicle. Let anyone scan and call you,
              your number stays private.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/qr-calling" className="btn btn-qr gap-2 px-6 py-3 text-[15px]">
                Get your QR sticker <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Feature strip */}
            <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
              {[
                { icon: Lock, iconCls: 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300', title: 'Call masking', desc: 'Your number stays private' },
                { icon: Phone, iconCls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300', title: 'Instant calling', desc: 'Scan & call directly' },
                { icon: ShieldCheck, iconCls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300', title: 'Safe & secure', desc: 'No number shared' },
                { icon: Car, iconCls: 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300', title: 'For cars & bikes', desc: 'Works for all vehicles' },
              ].map(({ icon: Icon, iconCls, title, desc }) => (
                <div key={title}>
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', iconCls)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: product photo + floating badges (desktop only — on mobile the photo is the background) */}
          <div className="relative mx-auto w-full max-w-md">
            <img
              src="/images/qr-hero-scan.jpg"
              srcSet="/images/qr-hero-scan.jpg 900w, /images/qr-hero-scan@2x.jpg 1400w"
              sizes="(min-width: 768px) 480px, 90vw"
              alt="Scanning an AutoSahay QR sticker on a car to place a masked call"
              width={1400}
              height={933}
              className="w-full rounded-3xl object-cover shadow-xl shadow-slate-900/10"
              loading="eager"
              fetchPriority="high"
            />

            {/* Top-left floating badge */}
            <div className="absolute -top-4 left-4 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-lg ring-1 ring-slate-900/5 sm:left-6 dark:bg-slate-900 dark:ring-white/10">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <p className="text-[11px] font-bold leading-tight text-slate-900 dark:text-slate-100">
                Private.
                <br />
                Secure.
                <br />
                Connected.
              </p>
            </div>

            {/* Bottom-right floating badge */}
            <div className="absolute bottom-3 right-3 max-w-[140px] rounded-xl bg-brand-600 p-2.5 text-white shadow-lg sm:bottom-4 sm:right-6 sm:max-w-[190px] sm:rounded-2xl sm:p-3">
              <div className="flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <Bike className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <p className="mt-1.5 text-[11px] font-bold leading-tight sm:text-xs">One QR. Any vehicle.</p>
              <p className="text-[11px] leading-tight text-white/80 sm:text-xs">Always reachable.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PARKING SEARCH HERO */}
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

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-16 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-white/20 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Now live in 6 cities
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Never hunt for parking
            <br />
            <span className="bg-gradient-to-r from-amber-200 via-orange-200 to-rose-200 bg-clip-text text-transparent">
              ever again.
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-base text-white/80 sm:text-lg">
            Book verified, secure parking by the hour, day, or month, near your office, the mall, or
            tonight's concert. Instant zero drama.
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
                  options={cities.map((c) => ({ value: c, label: c }))}
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
              {cities.slice(0, 5).map((c) => (
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
              { v: '100%', l: 'Verified slots' },
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
                options={cities.map((c) => ({ value: c, label: c }))}
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
            // Homepage shows at most 6 (filter-aware — the query already applies
            // q + city); the rest live on the dedicated /spaces catalog page.
            data.items.slice(0, 6).map((l) => <LocationCard key={l.id} loc={l} />)
          ) : (
            <div className="col-span-full card p-10 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                No slots match right now. Try a different city or clear the search.
              </p>
            </div>
          )}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
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


      
      {/* SERVICE PARTNERS — recruit partners for upcoming auto-service verticals.
          Sits right below the "List your space" CTA (both are partner pitches). */}
      <section className="mx-auto max-w-6xl px-4 pb-2">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-8 text-white sm:p-12">
          {/* soft light accent, matching the hero / parking CTA */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-25 [background:radial-gradient(600px_300px_at_0%_0%,rgba(255,255,255,0.5),transparent_60%)]"
          />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr,1.1fr] lg:gap-10">
            {/* Left: pitch + partner CTA */}
            <div className="flex flex-col gap-5">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white ring-1 ring-white/20 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> Coming soon
              </span>
              <div>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">
                  Your car's other needs — covered soon
                </h2>
                <p className="mt-2 max-w-md text-sm text-white/80 sm:text-base">
                  We're expanding beyond parking into a trusted network of on-demand auto
                  services. Run one of these businesses? Join AutoSahay early and grow with us.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/become-partner"
                  className="btn gap-2 bg-white text-brand-700 hover:bg-slate-100"
                >
                  <Handshake className="h-4 w-4" /> Become a partner
                </Link>
                <a
                  href={`tel:${PARTNER_PHONE.replace(/\s+/g, '')}`}
                  className="btn gap-2 border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20"
                >
                  <Phone className="h-4 w-4" /> {PARTNER_PHONE}
                </a>
              </div>
            </div>

            {/* Right: service grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SERVICES.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="group flex flex-col items-start gap-2.5 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/20"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/20 transition group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold leading-snug text-white">
                    {label}
                  </span>
                </div>
              ))}
              {/* trailing "and more" tile */}
              <div className="flex flex-col items-start justify-center gap-1 rounded-2xl border border-dashed border-white/25 p-4 text-white/70">
                <span className="text-sm font-semibold">+ more</span>
                <span className="text-xs">services on the way</span>
              </div>
            </div>
          </div>
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

       {/* List Your Space BANNER */}
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
                {/* <a
                  href={VENDOR_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn border border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  Partner login
                </a> */}
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

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Loved by Owners</p>
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



     

      <Footer />
    </>
  );
};

export const LocationCard = ({ loc }: { loc: Location }) => {
  const hasSlots = (loc.slots?.length ?? 0) > 0;
  const minHour = hasSlots
    ? Math.min(...loc.slots!.map((s) => Number(s.hourlyPrice)))
    : null;
  const vehicleBadges = vehicleBadgesFor(loc.slots);

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
        {vehicleBadges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vehicleBadges.map(({ label, Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
              >
                <Icon className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>
        )}
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
