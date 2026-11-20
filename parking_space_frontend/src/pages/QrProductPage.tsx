import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Bike, Car, Check, ChevronLeft, ChevronRight, Minus, Plus, RefreshCcw, ShieldCheck, Truck,
} from 'lucide-react';
import { Footer } from '@/components/Footer';
import { cn } from '@/lib/cn';
import { QR_VALIDITY_YEARS } from '@/lib/config';
import { useQrPrice } from '@/hooks/useQrPrice';
import {
  CallVisual, FrontBackVisual, OrderVisual, PackOfTwoVisual, ProductPhotoVisual, ScanVisual, StickVisual, StickerCard,
} from '@/components/QrStepVisuals';

type VehicleKind = 'CAR' | 'BIKE';

const GALLERY = [
  { visual: ProductPhotoVisual, label: 'Scanning the sticker on a car' },
  { visual: PackOfTwoVisual, label: 'Two identical stickers in the pack' },
  { visual: FrontBackVisual, label: 'Where the two stickers go' },
  { visual: StickVisual, label: 'Close up of the sticker' },
  { visual: ScanVisual, label: 'Any phone camera can scan it' },
  { visual: CallVisual, label: 'The owner gets a masked call' },
];

const PROMISES = [
  { icon: ShieldCheck, title: `${QR_VALIDITY_YEARS}-year validity`, sub: 'No renewals' },
  { icon: RefreshCcw, title: '7-day replacement', sub: 'If it arrives damaged' },
  { icon: Truck, title: '3 to 7 days', sub: 'Delivered to your door' },
];

const HIGHLIGHTS = [
  'Two identical stickers, one for the front and one for the back',
  'Calls are masked, so your number is never shown to the caller',
  'Works with any phone camera, no app to install',
  'Optional emergency card with blood group and family contacts',
  'Silent hours, daily call limits and one tap blocking',
  `Valid for ${QR_VALIDITY_YEARS} years from registration`,
];

const IN_THE_BOX = [
  ['2 QR stickers', 'Same QR code on both, 2.25 × 4 in each'],
  ['Setup guide', 'Scan once to link the stickers to your vehicle'],
];

const FEATURES = [
  {
    visual: FrontBackVisual,
    title: 'Two stickers. Reachable from either side.',
    body: 'Every pack has two stickers with the same QR code. Put one on the windshield and one on the rear window or bumper, so whoever is standing near your vehicle can reach you.',
  },
  {
    visual: CallVisual,
    title: 'They call you. Neither of you sees a number.',
    body: 'The call is connected through AutoSahay. The caller never sees your number and you never see theirs. Turn on silent hours when you do not want to be disturbed.',
  },
  {
    visual: ScanVisual,
    title: 'No app. Any phone camera works.',
    body: 'Anyone can point their camera at the sticker, confirm the last four digits of your plate and place the call. It takes a few seconds.',
  },
];

const stepsFor = (price: number) => [
  { visual: OrderVisual, title: 'Order the pack', body: `Pay ₹${price} once. We ship two stickers to your address.` },
  { visual: StickVisual, title: 'Stick them on', body: 'One on the front, one on the back of your car or bike.' },
  { visual: ScanVisual, title: 'Someone scans', body: 'They confirm your plate and tap to call. No app needed.' },
  { visual: CallVisual, title: 'You pick up', body: 'A masked call reaches you. Your number stays private.' },
];

const SPECS: [string, string][] = [
  ['In the box', '2 identical QR stickers'],
  ['Size', '2.25 × 4 inches each'],
  ['Suitable for', 'Cars and bikes'],
  ['Scanning', 'Any smartphone camera'],
  ['Validity', `${QR_VALIDITY_YEARS} years from registration`],
  ['Replacement', 'Within 7 days of delivery if damaged'],
  ['Dispatch', '1 to 2 business days'],
  ['Delivery', '3 to 7 business days'],
];

const FAQS = [
  { q: 'What is the AutoSahay QR Sticker?', a: 'It is a QR sticker placed on your vehicle that allows others to contact you when there is an issue with your vehicle.' },
  { q: 'Why are there two stickers?', a: 'Both stickers carry the same QR code. Stick one on the front and one on the back of your vehicle so people can reach you from either side.' },
  { q: 'How long is the sticker valid?', a: `${QR_VALIDITY_YEARS} years from the day you register it. There are no monthly charges or renewals in that time.` },
  { q: 'What if my stickers arrive damaged?', a: 'Tell us within 7 days of delivery and we will send a replacement.' },
  { q: 'When can someone scan the QR code?', a: 'For situations such as your vehicle blocking another vehicle, lights being left on, windows being open, or other vehicle related concerns.' },
  { q: 'Will my mobile number be visible to others?', a: 'No. Your mobile number stays private while others contact you through AutoSahay.' },
  { q: 'Can I edit or add an emergency contact number?', a: 'Yes. You can add or update your emergency contact details any time from your AutoSahay account.' },
];

/* ── Gallery ─────────────────────────────────────────────────────────────── */

const Thumb = ({ i, active, onClick }: { i: number; active: boolean; onClick: () => void }) => {
  const { visual: Visual, label } = GALLERY[i];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show image ${i + 1}: ${label}`}
      aria-current={active}
      className={cn(
        'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white transition dark:bg-slate-900',
        active ? 'border-slate-900 dark:border-white' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700',
      )}
    >
      <div className="pointer-events-none absolute left-0 top-0 h-[320px] w-[320px] origin-top-left scale-[0.2]">
        <Visual />
      </div>
    </button>
  );
};

const Gallery = () => {
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  const count = GALLERY.length;
  const go = (n: number) => setIdx((n + count) % count);
  const Current = GALLERY[idx].visual;

  return (
    <div className="flex gap-4">
      {/* Vertical thumbnail rail (desktop) */}
      <div className="hidden flex-col gap-2 lg:flex">
        {GALLERY.map((g, i) => <Thumb key={g.label} i={i} active={i === idx} onClick={() => setIdx(i)} />)}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
            touchX.current = null;
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(idx + 1);
            if (e.key === 'ArrowLeft') go(idx - 1);
          }}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={`Product images, ${idx + 1} of ${count}: ${GALLERY[idx].label}`}
        >
          <div key={idx} className="h-full w-full animate-[fadeIn_.25s_ease-out]">
            <Current />
          </div>

          {[{ dir: -1, Icon: ChevronLeft, side: 'left-3', label: 'Previous image' }, { dir: 1, Icon: ChevronRight, side: 'right-3', label: 'Next image' }].map(
            ({ dir, Icon, side, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => go(idx + dir)}
                aria-label={label}
                className={cn(
                  'absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-900 shadow-md transition hover:scale-105 lg:opacity-0 lg:group-hover:opacity-100',
                  side,
                )}
              >
                <Icon className="h-5 w-5" />
              </button>
            ),
          )}

          <p className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
            {GALLERY[idx].label}
          </p>
          <p className="absolute bottom-3 right-3 text-[11px] font-semibold tabular-nums text-slate-500 [text-shadow:0_0_6px_white]">
            {idx + 1}/{count}
          </p>
        </div>

        {/* Thumbnails (mobile + tablet) */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
          {GALLERY.map((g, i) => <Thumb key={g.label} i={i} active={i === idx} onClick={() => setIdx(i)} />)}
        </div>
      </div>
    </div>
  );
};

/* ── Small pieces ────────────────────────────────────────────────────────── */

const Disclosure = ({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) => (
  <details open={defaultOpen} className="group border-b border-slate-200 dark:border-slate-800 [&_summary::-webkit-details-marker]:hidden">
    <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
      {title}
      <Plus className="h-4 w-4 text-slate-400 group-open:hidden" />
      <Minus className="hidden h-4 w-4 text-slate-400 group-open:block" />
    </summary>
    <div className="pb-5 text-sm text-slate-600 dark:text-slate-300">{children}</div>
  </details>
);

const SectionTitle = ({ kicker, title }: { kicker: string; title: string }) => (
  <div className="mb-8 max-w-xl">
    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{kicker}</p>
    <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-[2rem] sm:leading-tight">{title}</h2>
  </div>
);

/* ── Page ────────────────────────────────────────────────────────────────── */

/**
 * QR Calling product page (/qr-calling): gallery + buy box, then features,
 * how it works, specifications and FAQs. "Buy now" opens the order form at
 * /qr-calling/order, carrying the chosen vehicle type.
 */
export const QrProductPage = () => {
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<VehicleKind>('CAR');
  const price = useQrPrice();
  const steps = stepsFor(price);
  const buyNow = () => navigate(`/qr-calling/order?vehicle=${vehicle}`);

  return (
    <>
      <main className="pb-24 lg:pb-0">
        {/* ── Product ───────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 pt-5 sm:pt-8">
          <nav className="mb-5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span>QR Calling</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-800 dark:text-slate-200">QR Sticker, Pack of 2</span>
          </nav>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr,1fr] lg:gap-14">
            <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
              <Gallery />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">AutoSahay</p>
              <h1 className="mt-1 font-display text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">
                Smart QR Sticker for your vehicle
              </h1>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                People can call you about your car or bike with one scan, and they never see your phone number.
              </p>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-[2.5rem] font-bold leading-none tracking-tight">₹{price}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">for 2 stickers</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">One time payment. Inclusive of all taxes and delivery.</p>

              {/* Pack option */}
              <div className="mt-7">
                <p className="text-sm font-semibold">Pack</p>
                <div className="mt-2 flex items-center gap-4 rounded-xl border-2 border-slate-900 p-3 dark:border-white">
                  <div className="flex shrink-0 -space-x-5">
                    <StickerCard className="w-12 -rotate-6 !p-1 [&_p]:hidden [&>div:first-child]:hidden" />
                    <StickerCard className="w-12 rotate-6 !p-1 [&_p]:hidden [&>div:first-child]:hidden" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Pack of 2, same QR</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">One for the front, one for the back</p>
                  </div>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>

              {/* Vehicle */}
              <div className="mt-5">
                <p className="text-sm font-semibold">Vehicle</p>
                <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Vehicle type">
                  {([['CAR', 'Car', Car], ['BIKE', 'Bike', Bike]] as const).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={vehicle === value}
                      onClick={() => setVehicle(value)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition',
                        vehicle === value
                          ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400',
                      )}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" onClick={buyNow} className="btn btn-qr mt-7 w-full gap-2 py-3.5 text-base">
                Buy now <ArrowRight className="h-4 w-4" />
              </button>

              {/* Service promises */}
              <div className="mt-6 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {PROMISES.map(({ icon: Icon, title, sub }) => (
                  <div key={title} className="flex flex-col items-center px-2 py-3.5 text-center">
                    <Icon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                    <p className="mt-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="mt-6 border-t border-slate-200 dark:border-slate-800">
                <Disclosure title="Highlights" defaultOpen>
                  <ul className="space-y-2">
                    {HIGHLIGHTS.map((h) => (
                      <li key={h} className="flex gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" /> {h}
                      </li>
                    ))}
                  </ul>
                </Disclosure>
                <Disclosure title="What's in the box">
                  <dl className="space-y-2">
                    {IN_THE_BOX.map(([k, v]) => (
                      <div key={k}>
                        <dt className="font-medium text-slate-900 dark:text-slate-100">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Disclosure>
                <Disclosure title="Delivery and replacement">
                  <p>Dispatched within 1 to 2 business days and delivered in 3 to 7 business days.</p>
                  <p className="mt-2">If your stickers arrive damaged, tell us within 7 days of delivery and we will send a replacement.</p>
                  <Link to="/shipping-policy" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-slate-900 underline underline-offset-2 dark:text-white">
                    Read the shipping policy
                  </Link>
                </Disclosure>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features: alternating image / text ────────────────────── */}
        <section className="mx-auto mt-20 max-w-6xl px-4 sm:mt-28">
          <div className="space-y-16 sm:space-y-24">
            {FEATURES.map(({ visual: Visual, title, body }, i) => (
              <div key={title} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
                <div className={cn('relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800', i % 2 === 1 && 'md:order-2')}>
                  <Visual />
                </div>
                <div className="max-w-md">
                  <p className="text-sm font-semibold tabular-nums text-slate-400">0{i + 1}</p>
                  <h3 className="mt-2 font-display text-2xl font-bold leading-snug tracking-tight sm:text-3xl">{title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────── */}
        <section id="how-it-works" className="mt-20 border-y border-slate-200 bg-slate-50 py-16 sm:mt-28 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mx-auto max-w-6xl px-4">
            <SectionTitle kicker="How it works" title="Set it up once. It keeps working for 10 years." />
            <ol className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
              {steps.map(({ visual: Visual, title, body }, i) => (
                <li key={title} className="w-[75%] shrink-0 snap-start sm:w-auto">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-white dark:bg-slate-800">
                    <Visual />
                  </div>
                  <div className="mt-4 flex items-baseline gap-3 border-t border-slate-300 pt-3 dark:border-slate-700">
                    <span className="text-sm font-semibold tabular-nums text-slate-400">{i + 1}</span>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Specifications + FAQ ──────────────────────────────────── */}
        <section className="mx-auto mt-20 grid max-w-6xl gap-14 px-4 sm:mt-24 lg:grid-cols-2">
          <div>
            <SectionTitle kicker="Specifications" title="The details" />
            <dl className="border-t border-slate-200 dark:border-slate-800">
              {SPECS.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9rem,1fr] gap-4 border-b border-slate-200 py-3 text-sm dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div id="faq">
            <SectionTitle kicker="FAQ" title="Questions people ask" />
            <div className="border-t border-slate-200 dark:border-slate-800">
              {FAQS.map(({ q, a }, i) => (
                <Disclosure key={q} title={q} defaultOpen={i === 0}>{a}</Disclosure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing ───────────────────────────────────────────────── */}
        <section className="mx-auto my-20 max-w-6xl px-4 sm:my-24">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-slate-900 px-6 py-8 text-white sm:flex-row sm:items-center sm:px-10">
            <div>
              <p className="font-display text-xl font-bold sm:text-2xl">Two stickers. Ten years. ₹{price}.</p>
              <p className="mt-1 text-sm text-slate-400">Delivered in 3 to 7 days, with a 7-day replacement if anything arrives damaged.</p>
            </div>
            <button type="button" onClick={buyNow} className="btn btn-qr shrink-0 gap-2 px-7 py-3 text-base">
              Buy now <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      {/* Sticky buy bar (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] lg:hidden dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div>
            <p className="font-display text-lg font-bold leading-none">₹{price}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Pack of 2 · {QR_VALIDITY_YEARS} years</p>
          </div>
          <button type="button" onClick={buyNow} className="btn btn-qr ml-auto flex-1 gap-2 py-3">
            Buy now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Footer variant="qr" />
    </>
  );
};
