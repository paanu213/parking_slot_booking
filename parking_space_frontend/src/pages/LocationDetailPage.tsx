import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  MapPin,
  Car,
  Bike,
  Truck,
  Clock,
  Shield,
  Cctv,
  Zap,
  Accessibility,
  Umbrella,
  Wrench,
  CreditCard,
  BadgeCheck,
  Star,
  Share2,
  Heart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Store,
  Phone,
  MessageCircle,
  Info,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Navigation,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { inr, toLocalInput } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { PRICING } from '@/lib/config';
import { useAuth } from '@/store/auth';
import { CardSkeleton, Skeleton } from '@/components/Skeleton';
import { Footer } from '@/components/Footer';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/cn';

interface Slot {
  id: string;
  code: string;
  vehicleType: string;
  hourlyPrice: number;
  monthlyPrice?: number | null;
  available?: boolean;
}

interface Location {
  id: string;
  name: string;
  description?: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | string;
  longitude?: number | string;
  images: { url: string }[];
  slots: Slot[];
  vendor?: { businessName: string; contactPhone?: string | null };
}

// Map slot.vehicleType (TWO_WHEELER / FOUR_WHEELER / HEAVY / legacy CAR) → display label + icon
const VEHICLE_TYPE: Record<string, { label: string; Icon: typeof Car }> = {
  TWO_WHEELER:  { label: '2-Wheeler',     Icon: Bike  },
  FOUR_WHEELER: { label: 'Car / SUV',     Icon: Car   },
  CAR:          { label: 'Car / SUV',     Icon: Car   },   // legacy
  HEAVY:        { label: 'Heavy Vehicle', Icon: Truck },
};

const AMENITIES = [
  { icon: Cctv, label: 'CCTV monitored', always: true },
  { icon: Shield, label: '24×7 security', always: true },
  { icon: Umbrella, label: 'Covered parking' },
  { icon: Zap, label: 'EV charging' },
  { icon: Accessibility, label: 'Wheelchair access' },
  { icon: Wrench, label: 'On-site attendant' },
];

const HIGHLIGHTS = [
  { icon: ShieldCheck, label: 'Verified space', tone: 'emerald' },
  { icon: Clock, label: 'Open 24×7', tone: 'sky' },
  { icon: CreditCard, label: 'Cashless entry', tone: 'violet' },
  { icon: BadgeCheck, label: 'Best price', tone: 'amber' },
];

const toneMap: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20',
  sky: 'bg-sky-500/10 text-sky-600 ring-sky-500/20',
  violet: 'bg-violet-500/10 text-violet-600 ring-violet-500/20',
  amber: 'bg-amber-500/10 text-amber-600 ring-amber-500/20',
};

// Online booking is not live yet — flip to `true` once payments + booking flow ship.
// Toggles the "Reserve this space" hero section and the sticky sidebar "Reserve now" card.
const BOOKING_ENABLED = false;

const FAQS = [
  {
    q: 'Where exactly do I enter?',
    a: 'Your booking QR shows the gate address and a map pin. Approach the main entry; the attendant scans and directs you to the reserved slot.',
  },
  {
    q: 'What vehicle sizes are allowed?',
    a: 'Standard sedans, SUVs, and hatchbacks up to 5.5m length, 2m width, and 2.1m height. Filter for SUV-friendly if you drive a larger vehicle.',
  },
  {
    q: 'Can I extend my booking on the go?',
    a: 'Yes — open the booking in the app and tap Extend. If the slot is still free, the extension is instant.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'Cancel up to 2 hours before start time for a full refund. Within 2 hours, 50% refund. After start, charges apply as per hourly rate.',
  },
];

const nowPlusHours = (h: number) => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + h);
  return d;
};

const { PLATFORM_FEE_PCT, GST_PCT } = PRICING;

export const LocationDetailPage = () => {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [startAt, setStartAt] = useState(toLocalInput(nowPlusHours(1)));
  const [endAt, setEndAt] = useState(toLocalInput(nowPlusHours(3)));
  const [activeImg, setActiveImg] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['location', id],
    queryFn: async () => (await api.get<Location>(`/locations/${id}`)).data,
    enabled: !!id,
  });

  const availability = useQuery({
    queryKey: ['availability', id, startAt, endAt],
    queryFn: async () =>
      (
        await api.get<{ items: Slot[] }>(`/locations/${id}/availability`, {
          params: { startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() },
        })
      ).data,
    enabled: !!id && !!startAt && !!endAt,
  });

  const book = useMutation({
    mutationFn: async (slotId: string) =>
      (
        await api.post('/bookings', {
          slotId,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        })
      ).data,
    onSuccess: (booking: { id: string }) => nav(`/checkout/${booking.id}`),
    onError: (e) => toast.error('Could not reserve this slot', errorMessage(e)),
  });

  const hours = useMemo(() => {
    const ms = +new Date(endAt) - +new Date(startAt);
    return ms > 0 ? Math.max(1, Math.ceil(ms / 3600_000)) : 0;
  }, [startAt, endAt]);

  if (detail.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <Skeleton className="h-80 w-full" />
        <CardSkeleton />
      </main>
    );
  }
  if (!detail.data) return <main className="p-8">Not found</main>;

  const loc = detail.data;
  const images = loc.images.length ? loc.images : [{ url: '' }];
  const availMap = new Map((availability.data?.items ?? []).map((s) => [s.id, s.available]));

  const minHour = loc.slots.length ? Math.min(...loc.slots.map((s) => Number(s.hourlyPrice))) : 0;

  // Cheapest monthly across slots that have a positive monthly price; null if none.
  const monthlyPrices = loc.slots
    .map((s) => (s.monthlyPrice != null ? Number(s.monthlyPrice) : 0))
    .filter((p) => p > 0);
  const minMonth = monthlyPrices.length ? Math.min(...monthlyPrices) : null;

  // Distinct vehicle types offered at this location (de-duped via map keys)
  const vehicleTypeKeys = Array.from(new Set(loc.slots.map((s) => s.vehicleType)));
  const vehicleTypes = vehicleTypeKeys
    .map((k) => VEHICLE_TYPE[k] ?? { label: k, Icon: Car })
    // De-dupe legacy CAR + FOUR_WHEELER which both render as "Car / SUV"
    .filter((v, i, arr) => arr.findIndex((x) => x.label === v.label) === i);

  const selectedSlot = loc.slots.find((s) => s.id === selectedSlotId) ?? loc.slots[0];
  const base = selectedSlot ? Number(selectedSlot.hourlyPrice) * hours : 0;
  const platformFee = Math.round((base * PLATFORM_FEE_PCT) / 100);
  const gst = Math.round(((base + platformFee) * GST_PCT) / 100);
  const total = base + platformFee + gst;

  const onBook = (slotId: string) => {
    if (!user) return nav(`/login?returnTo=/locations/${id}`);
    book.mutate(slotId);
  };

  // Deterministic "rating" from id so it feels stable per location
  const rating = (4.3 + ((loc.id.charCodeAt(0) + loc.id.charCodeAt(1)) % 7) / 10).toFixed(1);
  const reviewCount = 60 + (loc.id.charCodeAt(2) % 140);

  const mapsUrl =
    loc.latitude && loc.longitude
      ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`
      : `https://www.google.com/maps/search/${encodeURIComponent(loc.addressLine + ', ' + loc.city)}`;

  // Google's `output=embed` endpoint works without an API key and shows the standard map tiles
  // with a marker at the queried point. Prefer lat/lng (exact); fall back to address string.
  const mapEmbedUrl =
    loc.latitude && loc.longitude
      ? `https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}&z=16&output=embed`
      : `https://maps.google.com/maps?q=${encodeURIComponent(
          `${loc.addressLine}, ${loc.city} ${loc.pincode}`,
        )}&z=16&output=embed`;

  return (
    <>
      {/* Breadcrumb */}
      <div className="mx-auto max-w-6xl px-4 pt-6 text-xs text-slate-500">
        <Link to="/" className="hover:text-brand-600">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-400">{loc.city}</span>
        <span className="mx-1.5">/</span>
        <span className="text-slate-700 dark:text-slate-300">{loc.name}</span>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-10 pt-4">
        {/* Heading row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">{loc.name}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-500/20">
                <ShieldCheck className="h-3 w-3" /> Verified
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {loc.addressLine}, {loc.city} {loc.pincode}
              </span>
              <span className="flex items-center gap-1 text-amber-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-semibold text-slate-900 dark:text-slate-100">{rating}</span>
                <span className="text-slate-500">· {reviewCount} reviews</span>
              </span>
              <span className="flex items-center gap-1">
                <Store className="h-4 w-4" />
                by {loc.vendor?.businessName ?? 'AutoSahay partner'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost border border-slate-200 dark:border-slate-700"
            >
              <Navigation className="mr-2 h-4 w-4" /> Directions
            </a>
            <button className="btn-ghost border border-slate-200 p-2 dark:border-slate-700" aria-label="Save">
              <Heart className="h-4 w-4" />
            </button>
            <button className="btn-ghost border border-slate-200 p-2 dark:border-slate-700" aria-label="Share">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Gallery */}
        <section className="mt-6 grid gap-3 sm:grid-cols-[3fr,1fr]">
          <div className="card relative overflow-hidden">
            <div className="aspect-[16/9] w-full bg-slate-100 dark:bg-slate-800">
              {images[activeImg]?.url ? (
                <img
                  src={images[activeImg]!.url}
                  alt={loc.name}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Car className="h-10 w-10" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow ring-1 ring-slate-200 backdrop-blur hover:bg-white dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-700"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow ring-1 ring-slate-200 backdrop-blur hover:bg-white dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-700"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 right-3 rounded-full bg-slate-950/70 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
                  {activeImg + 1} / {images.length}
                </div>
              </>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-1">
            {images.slice(0, 4).map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={cn(
                  'card aspect-[4/3] overflow-hidden transition sm:aspect-[16/9]',
                  activeImg === i ? 'ring-2 ring-brand-500' : 'opacity-80 hover:opacity-100',
                )}
              >
                {img?.url ? (
                  <img
                    src={img.url}
                    alt={`${loc.name} ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800">
                    <Car className="h-5 w-5" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Highlights strip */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, label, tone }) => (
            <div
              key={label}
              className="card flex items-center gap-3 p-3"
            >
              <span
                className={cn('flex h-10 w-10 items-center justify-center rounded-xl ring-1', toneMap[tone])}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{label}</p>
                <p className="text-xs text-slate-500">Standard on all AutoSahay spaces</p>
              </div>
            </div>
          ))}
        </section>

        {/* =========================== */}
        {/* RESERVE SECTION — standout    */}
        {/* Hidden until online booking is live (see BOOKING_ENABLED at top of file) */}
        {/* =========================== */}
        {BOOKING_ENABLED && (
        <section
          id="reserve"
          className={cn(
            'relative mt-6 overflow-hidden rounded-3xl border border-brand-500/30 p-5 sm:p-8',
            'bg-gradient-to-br from-brand-50 via-white to-brand-100/60',
            'dark:border-brand-500/20 dark:from-brand-500/10 dark:via-slate-900 dark:to-brand-500/5',
            'shadow-[0_10px_40px_-15px_rgba(47,102,255,0.35)]',
          )}
        >
          {/* Decorative accents */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl dark:bg-brand-500/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-fuchsia-400/15 blur-3xl dark:bg-fuchsia-500/10"
          />

          <div className="relative">
            {/* Section header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                  <Sparkles className="h-3 w-3" /> Secure your spot
                </span>
                <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
                  Reserve this space
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Lock in your slot, pay once, park stress-free.
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{rating}</span>
                  <span className="text-xs text-slate-500">({reviewCount})</span>
                </div>
                <div className="hidden sm:block h-6 w-px bg-slate-300 dark:bg-slate-700" />
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Starting at</p>
                  <p className="font-display text-xl font-bold text-brand-600">
                    {inr(minHour)}<span className="text-xs text-slate-500">/hr</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 3-column grid: time | slots | pricing */}
            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr,1.2fr,1fr]">
              {/* Time selection */}
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <CalendarClock className="h-3.5 w-3.5" /> Choose your time
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">From</label>
                    <input
                      type="datetime-local"
                      className="input mt-1 text-sm"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">To</label>
                    <input
                      type="datetime-local"
                      className="input mt-1 text-sm"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    {hours} hour{hours === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Slot selection */}
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Car className="h-3.5 w-3.5" /> Select a slot
                </p>
                <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
                  {availability.isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                  ) : (
                    loc.slots.map((s) => {
                      const isAvailable = availMap.get(s.id) ?? true;
                      const isSelected = (selectedSlotId ?? loc.slots[0]?.id) === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => setSelectedSlotId(s.id)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-xl border p-3 text-sm transition',
                            isSelected && isAvailable
                              ? 'border-brand-500 bg-brand-500/5 ring-1 ring-brand-500/40 shadow-sm'
                              : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60',
                            !isAvailable && 'cursor-not-allowed opacity-60',
                          )}
                        >
                          <div className="text-left">
                            <div className="flex items-center gap-2 font-semibold">
                              <Car className="h-4 w-4" />
                              Slot {s.code}
                              {!isAvailable && (
                                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                                  Taken
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {inr(Number(s.hourlyPrice))}/hr
                              {s.monthlyPrice != null && Number(s.monthlyPrice) > 0 && (
                                <> · {inr(Number(s.monthlyPrice))}/mo</>
                              )}
                            </div>
                          </div>
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                              isSelected && isAvailable
                                ? 'border-brand-500 bg-brand-500 text-white'
                                : 'border-slate-300 dark:border-slate-600',
                            )}
                          >
                            {isSelected && isAvailable && <CheckCircle2 className="h-4 w-4" />}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pricing + Reserve */}
              <div className="flex flex-col rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-600 to-brand-700 p-4 text-white shadow-lg shadow-brand-600/20">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/80">
                  <CreditCard className="h-3.5 w-3.5" /> Price breakdown
                </p>
                {selectedSlot ? (
                  <div className="mt-3 flex-1 space-y-1.5 text-sm">
                    <PriceRow
                      label={`${hours}h × ${inr(Number(selectedSlot.hourlyPrice))}/hr`}
                      value={inr(base)}
                    />
                    <PriceRow label={`Platform fee (${PLATFORM_FEE_PCT}%)`} value={inr(platformFee)} />
                    <PriceRow label={`GST (${GST_PCT}%)`} value={inr(gst)} />
                    <div className="my-2 h-px bg-white/20" />
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs uppercase tracking-wide text-white/80">You pay</span>
                      <span className="font-display text-2xl font-bold">{inr(total)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-white/80">Pick a slot to see pricing.</p>
                )}

                <button
                  className={cn(
                    'mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-brand-700 shadow',
                    'transition hover:bg-slate-100 active:scale-[0.99]',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                  disabled={
                    !selectedSlot ||
                    book.isPending ||
                    hours <= 0 ||
                    (selectedSlot && availMap.get(selectedSlot.id) === false)
                  }
                  onClick={() => selectedSlot && onBook(selectedSlot.id)}
                >
                  {book.isPending ? (
                    'Reserving…'
                  ) : (
                    <>
                      Reserve for {inr(total)}
                      <Navigation className="h-4 w-4 rotate-45" />
                    </>
                  )}
                </button>

                <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/80">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure payment · Free cancel up to 2h
                </div>
              </div>
            </div>

            {/* Bottom trust strip inside reserve section */}
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-brand-500/20 pt-4 sm:grid-cols-4">
              {[
                { icon: ShieldCheck, label: 'Instant confirmation' },
                { icon: CreditCard, label: 'Secure payments' },
                { icon: Clock, label: 'Free cancel 2h prior' },
                { icon: MessageCircle, label: '24×7 chat support' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  <Icon className="h-4 w-4 text-brand-600" />
                  <span className="font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        {/* =========================== */}
        {/* BELOW: info sections         */}
        {/* =========================== */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="space-y-6">
            {/* About — description only, structured stats moved to the right-sidebar Pricing card */}
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Info className="h-5 w-5 text-brand-600" /> About this space
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {loc.description ||
                  `A verified, well-lit parking facility in the heart of ${loc.city}. Ideal for office commuters, mall visits, and event parking. Our attendants are on-site 24×7 and slot assignment happens digitally — no queues, no confusion.`}
              </p>
            </div>

            {/* Amenities */}
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Sparkles className="h-5 w-5 text-brand-600" /> Amenities
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {AMENITIES.map(({ icon: Icon, label, always }) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border p-3 text-sm',
                      always
                        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 font-medium">{label}</span>
                    {always ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Ask
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Operating hours */}
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <CalendarClock className="h-5 w-5 text-brand-600" /> Operating hours
              </h2>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {[
                  ['Mon – Fri', '24 × 7'],
                  ['Saturday', '24 × 7'],
                  ['Sunday', '24 × 7'],
                  ['Public holidays', 'Open (surge rates may apply)'],
                ].map(([d, t]) => (
                  <div key={d} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/40">
                    <span className="font-medium">{d}</span>
                    <span className="text-slate-500">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Policy */}
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Shield className="h-5 w-5 text-brand-600" /> Cancellation & safety
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <PolicyRow ok label="Free cancel up to 2 hrs before start" />
                <PolicyRow ok label="Instant refund to source" />
                <PolicyRow ok label="CCTV recording retained 30 days" />
                <PolicyRow ok label="₹10 lakh liability insurance on-site" />
                <PolicyRow label="No overnight vehicle storage" />
                <PolicyRow label="No commercial goods vehicles" />
              </div>
            </div>

            {/* Location / map — live Google Maps embed (no API key required for output=embed) */}
            <div className="card overflow-hidden">
              <div className="relative h-72 w-full bg-slate-100 dark:bg-slate-800">
                <iframe
                  src={mapEmbedUrl}
                  title={`${loc.name} location on Google Maps`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-brand-600 shadow ring-1 ring-slate-200 backdrop-blur hover:bg-white dark:bg-slate-900/95 dark:ring-slate-700"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Open in Maps
                </a>
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold">{loc.addressLine}</p>
                <p className="text-xs text-slate-500">{loc.city}, {loc.state} {loc.pincode}</p>
              </div>
            </div>

            {/* "Hosted by" card removed — vendor info + Call button now live in the right-sidebar Contact card */}

            {/* FAQs */}
            <div className="card p-5">
              <h2 className="font-display text-lg font-bold">Good to know</h2>
              <div className="mt-4 space-y-2">
                {FAQS.map((f, i) => (
                  <div
                    key={f.q}
                    className={cn(
                      'overflow-hidden rounded-xl border transition',
                      openFaq === i
                        ? 'border-brand-500/40 bg-brand-50/30 dark:bg-brand-500/5'
                        : 'border-slate-200 dark:border-slate-700',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-semibold">{f.q}</span>
                      <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', openFaq === i && 'rotate-180')} />
                    </button>
                    <div className={cn('grid overflow-hidden transition-all', openFaq === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                      <div className="min-h-0">
                        <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-400">{f.a}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT: pricing + contact (the two emphasized cards) */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* Sticky mini-booking reminder — hidden until online booking is live (see BOOKING_ENABLED) */}
            {BOOKING_ENABLED && (
              <div className="card p-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your selection</p>
                    <p className="mt-0.5 font-display text-lg font-bold text-brand-600">{inr(total)}</p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {hours}h · Slot {selectedSlot?.code ?? '—'}
                  </span>
                </div>
                <button
                  className="btn-primary mt-3 w-full"
                  disabled={
                    !selectedSlot ||
                    book.isPending ||
                    hours <= 0 ||
                    (selectedSlot && availMap.get(selectedSlot.id) === false)
                  }
                  onClick={() => selectedSlot && onBook(selectedSlot.id)}
                >
                  {book.isPending ? 'Reserving…' : 'Reserve now'}
                </button>
                <a
                  href="#reserve"
                  className="mt-2 block text-center text-[11px] font-semibold text-slate-500 hover:text-brand-600"
                >
                  Edit time or slot ↑
                </a>
              </div>
            )}

            {/* ── 1. Pricing card (brand-tinted, high hierarchy) ── */}
            <div
              className={cn(
                'relative overflow-hidden rounded-2xl border border-brand-500/30 p-5 shadow-[0_10px_40px_-20px_rgba(47,102,255,0.45)]',
                'bg-gradient-to-br from-brand-50 via-white to-brand-100/50',
                'dark:border-brand-500/20 dark:from-brand-500/10 dark:via-slate-900 dark:to-brand-500/5',
              )}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-brand-600" />
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">Pricing</p>
              </div>

              {/* Hero price — biggest thing on the page after the gallery */}
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-xs font-semibold text-slate-500">From</span>
                <span className="font-display text-4xl font-bold text-brand-700 dark:text-brand-300">{inr(minHour)}</span>
                <span className="text-sm font-semibold text-slate-500">/hr</span>
              </div>
              {minMonth != null && (
                <div className="mt-1 flex items-baseline gap-1 text-sm">
                  <span className="text-xs text-slate-500">Monthly pass from</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{inr(minMonth)}</span>
                  <span className="text-xs text-slate-500">/mo</span>
                </div>
              )}

              <div className="mt-4 h-px bg-brand-500/15" />

              {/* Quick facts: slots + vehicle types */}
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-slate-500">
                    <Car className="h-3.5 w-3.5" /> Slots available
                  </dt>
                  <dd className="font-bold text-slate-900 dark:text-slate-100">{loc.slots.length}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-slate-500">
                    <Sparkles className="h-3.5 w-3.5" /> Vehicle types
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5">
                    {vehicleTypes.length === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      vehicleTypes.map(({ label, Icon }) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </span>
                      ))
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* ── 2. Call host card (also emphasized, brand-tinted) ── */}
            <div
              className={cn(
                'relative overflow-hidden rounded-2xl border border-emerald-500/30 p-5 shadow-[0_10px_40px_-20px_rgba(16,185,129,0.4)]',
                'bg-gradient-to-br from-emerald-50 via-white to-emerald-100/50',
                'dark:border-emerald-500/20 dark:from-emerald-500/10 dark:via-slate-900 dark:to-emerald-500/5',
              )}
            >
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Talk to the host</p>
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {loc.vendor?.businessName ?? 'AutoSahay partner'}
              </p>
              <p className="text-xs text-slate-500">Verified partner</p>

              {loc.vendor?.contactPhone ? (
                <>
                  <p className="mt-4 font-mono text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
                    {loc.vendor.contactPhone}
                  </p>
                  <a
                    href={`tel:${loc.vendor.contactPhone.replace(/\s+/g, '')}`}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-[0.99]"
                  >
                    <Phone className="h-4 w-4" />
                    Call now
                  </a>
                </>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Contact number not available for this space yet.
                </p>
              )}

              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
                <Clock className="h-3 w-3" />
                Best response within ~5 min
              </p>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  );
};

const PriceRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-white/80">{label}</span>
    <span className="font-semibold">{value}</span>
  </div>
);

const PolicyRow = ({ label, ok }: { label: string; ok?: boolean }) => (
  <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
    {ok ? (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
    ) : (
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
    )}
    <span>{label}</span>
  </div>
);
