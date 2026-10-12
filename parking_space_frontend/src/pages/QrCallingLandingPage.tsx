import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  AlertTriangle, ArrowRight, Car, CheckCircle2, ChevronDown, Fingerprint, Lock, Gift, Home, IndianRupee, Loader2, LogIn,
  Package, Pencil, PhoneCall, QrCode, RefreshCw, ScanLine, ShieldPlus, Sparkles, Truck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/store/auth';
import { Footer } from '@/components/Footer';
import { cn } from '@/lib/cn';
import { phoneInputProps, phoneRules } from '@/lib/phone';
import { VehicleTypePicker, vehicleKindLabel, type VehicleKind } from '@/components/VehicleTypePicker';
import { OrderVisual, StickVisual, ScanVisual, CallVisual } from '@/components/QrStepVisuals';
import { API_URL, QR_STICKER_PRICE } from '@/lib/config';
import { friendlyPaymentError, useQrPaymentCheckout } from '@/hooks/useQrPaymentCheckout';

const FIRST_PAYMENT = QR_STICKER_PRICE; // one-time, lifetime — no recurring charge

// Each step is shown as a picture (see components/QrStepVisuals) rather than an icon.
const STEPS = [
  { visual: OrderVisual, title: 'Get your sticker', desc: `Order it here for ₹${QR_STICKER_PRICE}, one time — one unique sticker per vehicle, yours for life.` },
  { visual: StickVisual, title: 'Stick it on your vehicle', desc: 'Windshield, window or bumper — wherever it\'s easy to spot.' },
  { visual: ScanVisual, title: 'Anyone can scan it', desc: 'They scan and enter the last 4 digits from your number plate, no app needed.' },
  { visual: CallVisual, title: 'You get a masked call', desc: 'Your real number stays private. In an emergency, an opt-in ICE card can be shown too.' },
];

const FAQS = [
  {
    q: 'What is the AutoSahay QR Sticker?',
    a: 'It is a QR sticker placed on your vehicle that allows others to contact you when there is an issue with your vehicle.',
  },
  {
    q: 'When can someone scan the QR code?',
    a: 'For situations such as your vehicle blocking another vehicle, lights being left on, windows being open, or other vehicle-related concerns.',
  },
  {
    q: 'Will my mobile number be visible to others?',
    a: 'No. Your mobile number can remain private while allowing others to contact you through AutoSahay.',
  },
  {
    q: 'Can I edit or add an emergency contact number?',
    a: 'Yes. You can add or update your emergency contact details whenever required through your AutoSahay account.',
  },
];

const FEATURES = [
  'Your phone number is never shown, every call is masked',
  'Optional emergency (ICE) card: blood group, notes, family contacts',
  'Silent hours + a daily call cap, fully in your control',
  'Block a nuisance caller with one tap',
];

interface OrderForm {
  vehicleType: VehicleKind;
  plateNumber: string;
  contactPhone: string;
  ownerName: string;
  shippingName: string;
  shippingPhone: string;
  pincode: string;
  city: string;
  state: string;
  district: string;
  area: string;
  addressLine: string; // house/flat no. + street only — city/state/area are separate
  note: string;
}

const googleLogin = (returnPath: string) => {
  const returnTo = encodeURIComponent(returnPath);
  const origin = encodeURIComponent(window.location.origin);
  window.location.href = `${API_URL}/auth/google?portal=customer&returnTo=${returnTo}&origin=${origin}`;
};

const ORDER_STEPS = [
  { key: 'signin', label: 'Sign in' },
  { key: 'details', label: 'Your details' },
  { key: 'preview', label: 'Review & pay' },
] as const;

const OrderStepper = ({ current }: { current: typeof ORDER_STEPS[number]['key'] }) => {
  const idx = ORDER_STEPS.findIndex((s) => s.key === current);
  return (
    <div className="mx-auto mb-8 flex max-w-md items-center">
      {ORDER_STEPS.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 transition-colors',
                i < idx
                  ? 'bg-emerald-500 text-white ring-emerald-500'
                  : i === idx
                  ? 'bg-brand-600 text-white ring-brand-600'
                  : 'bg-white text-slate-400 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700',
              )}
            >
              {i < idx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={cn(
                'whitespace-nowrap text-[11px] font-semibold',
                i === idx ? 'text-brand-700 dark:text-brand-300' : i < idx ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400',
              )}
            >
              {s.label}
            </span>
          </div>
          {i < ORDER_STEPS.length - 1 && (
            <span className={cn('mx-2 mb-4 h-0.5 flex-1 rounded', i < idx ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700')} />
          )}
        </div>
      ))}
    </div>
  );
};

const HERO_STEPS = [
  { icon: QrCode, label: 'Order your sticker' },
  { icon: Car, label: 'Stick it on your vehicle' },
  { icon: ScanLine, label: 'Someone scans it' },
  { icon: PhoneCall, label: 'You get a masked call' },
];

/** Hero copy + call to action — shared by the mobile and desktop hero layouts. */
const HeroIntro = () => (
  <div>
    <span aria-hidden className="block h-1 w-14 rounded-full bg-emerald-400" />
    <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300 ring-1 ring-white/15">
      <QrCode className="h-3.5 w-3.5" /> QR Calling
    </span>
    <h1 className="mt-4 font-display text-[2rem] font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
      Let people reach you, <span className="text-emerald-400">without seeing your number.</span>
    </h1>
    <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-300 sm:text-base">
      Stick it on your car or bike. Anyone who needs you — a wrongly parked car, an accident, or
      an emergency — scans it, enters the last 4 of your plate, and gets a masked call straight to you.
    </p>
    <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
      <a href="#order" className="btn btn-qr gap-2 px-6 py-3 text-[15px]">
        Get your QR sticker — ₹{QR_STICKER_PRICE} <ArrowRight className="h-4 w-4" />
      </a>
      <span className="text-xs text-slate-400">One-time · Lifetime validity</span>
    </div>
  </div>
);

/** The four steps as a numbered icon strip — the visual "how it works" inside the hero. */
const HeroSteps = ({ compact }: { compact?: boolean }) => (
  <ol className="grid grid-cols-4 gap-2">
    {HERO_STEPS.map(({ icon: Icon, label }, i) => (
      <li key={label} className="relative flex flex-col items-center text-center">
        {i < HERO_STEPS.length - 1 && (
          <span aria-hidden className="absolute left-[calc(50%+1.75rem)] right-[calc(-50%+1.75rem)] top-6 border-t-2 border-dashed border-emerald-400/50" />
        )}
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-700 shadow-lg ring-2 ring-emerald-300/40">
          <Icon className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-emerald-700">
            {i + 1}
          </span>
        </span>
        <p className={cn('mt-2 font-semibold leading-tight text-white', compact ? 'text-[11px]' : 'text-xs')}>{label}</p>
      </li>
    ))}
  </ol>
);

/**
 * "Get your QR sticker" landing page + order wizard:
 *   sign in (Google) → details → preview & edit → pay (Razorpay — see
 * useQrPaymentCheckout) → confirmation. A failed/cancelled payment never
 * loses the form: it stays on this step with everything filled in and a
 * "Try again" retry.
 */
export const QrCallingLandingPage = () => {
  const { user, hydrated } = useAuth();
  const [step, setStep] = useState<'details' | 'preview' | 'done'>('details');

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrderForm>({ defaultValues: { vehicleType: 'CAR' } });
  const vehicleType = watch('vehicleType');

  // Pincode → city/state/area auto-fill (same backend proxy the vendor
  // "Add space" form uses — util.service.ts works around the India Post
  // API's flaky SSL cert by proxying server-side).
  const pincode = watch('pincode');
  const [pincodeState, setPincodeState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const lastLookedUp = useRef('');

  useEffect(() => {
    const p = (pincode ?? '').replace(/\D/g, '');
    if (p.length !== 6 || p === lastLookedUp.current) return;
    lastLookedUp.current = p;
    setPincodeState('loading');
    setAreaOptions([]);
    setValue('area', '', { shouldValidate: false });

    api.get(`/util/pincode/${p}`)
      .then(({ data }) => {
        if (!data?.state) throw new Error('not found');
        setValue('city', data.city ?? '', { shouldDirty: true });
        setValue('state', data.state ?? '', { shouldDirty: true });
        setValue('district', data.district ?? '', { shouldDirty: true });
        const places = Array.isArray(data.places) ? data.places : [];
        const names: string[] = places.length ? places.map((pl: { name: string }) => pl.name) : [data.area].filter(Boolean);
        setAreaOptions(names);
        if (names.length === 1) setValue('area', names[0], { shouldDirty: true });
        setPincodeState('found');
      })
      .catch(() => {
        setValue('district', '', { shouldDirty: true });
        setPincodeState('error');
      });
  }, [pincode, setValue]);

  // "Same as above" — mirrors the car-owner name/number into the shipping
  // fields instead of making the user type them twice. Phone always has a
  // value up here (required); name is optional, so only lock the shipping
  // name field once there's actually something to mirror into it.
  const [sameAsAbove, setSameAsAbove] = useState(false);
  const ownerNameForShipping = watch('ownerName');
  const contactPhoneForShipping = watch('contactPhone');

  useEffect(() => {
    if (!sameAsAbove) return;
    setValue('shippingPhone', contactPhoneForShipping ?? '', { shouldValidate: true, shouldDirty: true });
    if ((ownerNameForShipping ?? '').trim()) {
      setValue('shippingName', ownerNameForShipping ?? '', { shouldValidate: true, shouldDirty: true });
    }
  }, [sameAsAbove, ownerNameForShipping, contactPhoneForShipping, setValue]);

  // Payment — checkout is re-entrant: qrOrderId (once the order exists) and
  // paymentError persist across a failed/cancelled attempt so "Try again"
  // just reopens checkout, with every typed field still intact. Only the
  // Edit button (going back to change something) clears qrOrderId, since a
  // changed plate/address needs a fresh order rather than reusing the old one.
  const [qrOrderId, setQrOrderId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const { paymentError, setPaymentError, startCheckout } = useQrPaymentCheckout(() => setStep('done'));

  const startPayment = async () => {
    setPaymentError(null);
    setStarting(true);
    try {
      let orderId = qrOrderId;
      if (!orderId) {
        const v2 = getValues();
        const created = await api.post<{ order: { id: string } }>('/customer/me/qr-orders', {
          vehicle: {
            vehicleType:  v2.vehicleType,
            plateNumber:  v2.plateNumber.trim(),
            contactPhone: v2.contactPhone.trim(),
            ownerName:    v2.ownerName.trim() || undefined,
          },
          shippingName:  v2.shippingName.trim(),
          shippingPhone: v2.shippingPhone.trim(),
          // Street + locality collapse into one line — the backend stores a single addressLine.
          addressLine:   [v2.addressLine.trim(), v2.area?.trim()].filter(Boolean).join(', '),
          city:          v2.city.trim(),
          state:         v2.state.trim(),
          pincode:       v2.pincode.trim(),
          note:          v2.note.trim() || undefined,
        });
        orderId = created.data.order.id;
        setQrOrderId(orderId);
      }

      const v2 = getValues();
      await startCheckout(orderId, { name: v2.shippingName, contact: v2.shippingPhone, email: user?.email });
    } catch (e) {
      setPaymentError(friendlyPaymentError(e));
    } finally {
      setStarting(false);
    }
  };

  const v = getValues();
  const fullAddress = [v.addressLine, v.area, v.city, v.state].filter(Boolean).join(', ') + (v.pincode ? ` — ${v.pincode}` : '');

  return (
    <>
      <main>
        {/* HERO — dark poster with the product photo; the 4 steps are part of the visual.
            Mobile and desktop are separate layouts (only one is displayed). */}
        <section className="relative isolate overflow-hidden bg-slate-950 text-white">
          {/* ── Mobile ─────────────────────────────────────────────── */}
          <div className="relative md:hidden">
            <div aria-hidden className="absolute inset-0 -z-10">
              <img
                src="/images/qr-hero-scan.jpg"
                alt=""
                className="absolute inset-0 h-full w-full scale-110 object-cover object-[30%_center] blur-md brightness-[0.45]"
                loading="eager"
              />
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
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/45 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent via-45% to-slate-950" />
            </div>

            <div className="px-5 pb-7 pt-10">
              <HeroIntro />
              {/* Space for the photo — the phone scanning the sticker */}
              <div aria-hidden className="h-40" />
              <HeroSteps compact />
            </div>
          </div>

          {/* ── Desktop ────────────────────────────────────────────── */}
          <div className="mx-auto hidden max-w-6xl grid-cols-[1fr,1.1fr] items-center gap-12 px-4 py-16 md:grid lg:py-20">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(600px_400px_at_15%_10%,rgba(16,185,129,0.18),transparent_60%)]" />
            <HeroIntro />

            <div className="relative">
              <div className="overflow-hidden rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-white/10">
                <img
                  src="/images/qr-hero-scan.jpg"
                  srcSet="/images/qr-hero-scan.jpg 900w, /images/qr-hero-scan@2x.jpg 1400w"
                  sizes="(min-width: 1024px) 600px, 50vw"
                  alt="Someone scanning an AutoSahay QR sticker on a car to call the owner"
                  width={1400}
                  height={933}
                  className="aspect-[4/3] w-full object-cover object-[70%_center]"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
              {/* Privacy badge */}
              <div className="absolute -left-5 top-6 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-slate-900 shadow-xl">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Lock className="h-4 w-4" />
                </span>
                <p className="text-xs font-bold leading-tight">Your number<br />stays private</p>
              </div>
              {/* The steps, on frosted glass over the photo */}
              <div className="absolute inset-x-4 -bottom-8 rounded-2xl bg-slate-950/80 p-4 ring-1 ring-white/15 backdrop-blur-md">
                <HeroSteps />
              </div>
            </div>
          </div>
        </section>

                {/* ORDER WIZARD */}
        <section id="order" className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white px-4 py-16 dark:from-brand-500/[0.06] dark:via-slate-950 dark:to-slate-950">
          <div className="mx-auto max-w-5xl">
            <div className="mb-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Get started</p>
              <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Order your QR sticker</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                Two minutes: sign in, add your car, review, and pay.
              </p>
            </div>

            {hydrated && step !== 'done' && (
              <OrderStepper current={!user ? 'signin' : step} />
            )}

          {!hydrated ? (
            <div className="card p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
          ) : step === 'done' ? (
            <SuccessCard plate={v.plateNumber} />
          ) : step === 'preview' ? (
            <div className="card space-y-5 border border-brand-100 p-6 shadow-xl shadow-brand-900/5 dark:border-brand-500/20">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Review your order</h3>
                <button
                  type="button"
                  onClick={() => { setStep('details'); setQrOrderId(null); setPaymentError(null); }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              </div>

              <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/40">
                <Line label="Vehicle" value={vehicleKindLabel(v.vehicleType)} />
                <Line label="Number plate" value={v.plateNumber} />
                <Line label="Contact number" value={v.contactPhone} />
                {v.ownerName?.trim() && <Line label="Owner name" value={v.ownerName} />}
                <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                <Line label="Deliver to" value={v.shippingName} />
                <Line label="Delivery phone" value={v.shippingPhone} />
                <Line label="Address" value={fullAddress} />
                {v.note?.trim() && <Line label="Note" value={v.note} />}
              </dl>

              <div className="rounded-xl border-2 border-brand-100 bg-brand-50/40 p-4 text-sm dark:border-brand-500/20 dark:bg-brand-500/5">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">QR sticker — one-time, lifetime</span><span>₹{QR_STICKER_PRICE}</span></div>
                <div className="mt-2 flex justify-between border-t border-brand-200 pt-2 font-semibold dark:border-brand-500/20">
                  <span>Pay now</span><span>₹{FIRST_PAYMENT}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">One payment, no renewals — your QR sticker works for life.</p>
              </div>

              {paymentError && (
                <div className="flex items-start gap-3 rounded-xl border-2 border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                  <div>
                    <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Payment didn't go through</p>
                    <p className="mt-0.5 text-sm text-rose-600 dark:text-rose-300/90">{paymentError.message}</p>
                    <p className="mt-1 text-xs text-rose-500 dark:text-rose-400">Nothing was lost — your details are right here. Try again whenever you're ready.</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={startPayment}
                disabled={starting}
                className="btn-primary w-full justify-center gap-2"
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : paymentError ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <IndianRupee className="h-4 w-4" />
                )}
                {starting ? 'Starting payment…' : paymentError ? `Try again — Pay ₹${FIRST_PAYMENT}` : `Pay ₹${FIRST_PAYMENT}`}
              </button>
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Dispatched in 1–2 business days, delivered in 3–7.{' '}
                <Link to="/shipping-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                  Shipping policy
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(() => setStep('preview'))} className="card space-y-6 border border-brand-100 p-6 shadow-xl shadow-brand-900/5 dark:border-brand-500/20">
              {user ? (
                <div className="flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Signed in as {user.fullName} · {user.email}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-5 text-center dark:border-brand-500/40 dark:bg-brand-500/10 sm:flex-row sm:justify-between sm:text-left">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow ring-1 ring-brand-100 dark:bg-slate-900 dark:ring-slate-700">
                      <LogIn className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Sign in to unlock this form</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Your order is linked to your account so you can track it later.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => googleLogin('/qr-calling#order')}
                    className="btn-primary shrink-0 gap-2"
                  >
                    <LogIn className="h-4 w-4" /> Continue with Google
                  </button>
                </div>
              )}

              <fieldset disabled={!user} className={cn('space-y-6', !user && 'pointer-events-none select-none opacity-40 grayscale')}>
              <div className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Car className="h-4 w-4" /> Your vehicle
                </h3>
                <VehicleTypePicker value={vehicleType} onChange={(v) => setValue('vehicleType', v, { shouldDirty: true })} />
                <div>
                  <label className="text-sm font-medium">Number plate</label>
                  <input
                    className={cn('input mt-1 w-full font-mono uppercase tracking-wide', errors.plateNumber && 'border-rose-500')}
                    placeholder="AP16HJ7956"
                    {...register('plateNumber', {
                      required: 'Enter your car number',
                      onChange: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); },
                    })}
                  />
                  {errors.plateNumber && <p className="mt-1 text-xs text-rose-600">{errors.plateNumber.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Contact number</label>
                  <input
                    {...phoneInputProps}
                    className={cn('input mt-1 w-full', errors.contactPhone && 'border-rose-500')}
                    placeholder="10-digit number that rings when someone scans your QR"
                    {...register('contactPhone', phoneRules('Enter the number to ring'))}
                  />
                  {errors.contactPhone && <p className="mt-1 text-xs text-rose-600">{errors.contactPhone.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Your name <span className="text-xs text-slate-400">(optional)</span></label>
                  <input className="input mt-1 w-full" {...register('ownerName')} />
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Truck className="h-4 w-4" /> Shipping address
                </h3>

                <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">
                  <input
                    type="checkbox"
                    checked={sameAsAbove}
                    onChange={(e) => setSameAsAbove(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Same as above — use my name &amp; number for delivery
                </label>

                <div>
                  <label className="text-sm font-medium">Recipient name</label>
                  <input
                    className={cn(
                      'input mt-1 w-full',
                      errors.shippingName && 'border-rose-500',
                      sameAsAbove && !!ownerNameForShipping?.trim() && 'bg-slate-50 dark:bg-slate-800/60',
                    )}
                    disabled={sameAsAbove && !!ownerNameForShipping?.trim()}
                    {...register('shippingName', { required: 'Required' })}
                  />
                  {sameAsAbove && !ownerNameForShipping?.trim() && (
                    <p className="mt-1 text-xs text-slate-400">Add "Your name" above to auto-fill this, or type it here.</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Phone for delivery</label>
                  <input
                    {...phoneInputProps}
                    className={cn('input mt-1 w-full', errors.shippingPhone && 'border-rose-500', sameAsAbove && 'bg-slate-50 dark:bg-slate-800/60')}
                    disabled={sameAsAbove}
                    placeholder="10-digit mobile number"
                    {...register('shippingPhone', phoneRules('Required'))}
                  />
                  {errors.shippingPhone && <p className="mt-1 text-xs text-rose-600">{errors.shippingPhone.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Pincode</label>
                  <div className="relative mt-1">
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit pincode"
                      className={cn('input w-36 pr-8', errors.pincode && 'border-rose-500')}
                      {...register('pincode', {
                        required: 'Required',
                        pattern: { value: /^[0-9]{6}$/, message: 'Enter a valid 6-digit pincode' },
                      })}
                    />
                    {pincodeState === 'loading' && (
                      <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                    )}
                    {pincodeState === 'found' && (
                      <CheckCircle2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                    )}
                  </div>
                  {errors.pincode ? (
                    <p className="mt-1 text-xs text-rose-600">{errors.pincode.message}</p>
                  ) : pincodeState === 'error' ? (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Pincode not found — fill in the fields below manually.
                    </p>
                  ) : pincodeState === 'idle' ? (
                    <p className="mt-1 text-xs text-slate-400">Enter your pincode first — we'll fill in the rest.</p>
                  ) : null}
                </div>

                {/* Country / State / District — auto-filled from the pincode above */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">Country</label>
                    <input className="input mt-1 w-full bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400" value="India" disabled />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      State <span className="text-xs font-normal text-slate-400">(auto)</span>
                    </label>
                    <input
                      className={cn(
                        'input mt-1 w-full',
                        errors.state && 'border-rose-500',
                        pincodeState === 'found' && 'bg-slate-50 dark:bg-slate-800/60',
                      )}
                      {...register('state', { required: 'Required' })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      District <span className="text-xs font-normal text-slate-400">(auto)</span>
                    </label>
                    <input
                      className={cn('input mt-1 w-full', pincodeState === 'found' && 'bg-slate-50 dark:bg-slate-800/60')}
                      {...register('district')}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    City / Town <span className="text-xs font-normal text-slate-400">(auto)</span>
                  </label>
                  <input
                    className={cn(
                      'input mt-1 w-full',
                      errors.city && 'border-rose-500',
                      pincodeState === 'found' && 'bg-slate-50 dark:bg-slate-800/60',
                    )}
                    {...register('city', { required: 'Required' })}
                  />
                </div>

                {areaOptions.length > 0 && (
                  <div>
                    <label className="text-sm font-medium">
                      Locality
                      <span className="ml-1.5 text-xs font-normal text-slate-400">
                        ({areaOptions.length} found for this pincode)
                      </span>
                    </label>
                    <select
                      className={cn('input mt-1 w-full', errors.area && 'border-rose-500')}
                      {...register('area', { required: 'Select your locality' })}
                    >
                      <option value="">Select your locality…</option>
                      {areaOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    {errors.area && <p className="mt-1 text-xs text-rose-600">{errors.area.message}</p>}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">House / Flat no., Street</label>
                  <input
                    placeholder="e.g. Flat 302, Sai Residency, 4th Cross"
                    className={cn('input mt-1 w-full', errors.addressLine && 'border-rose-500')}
                    {...register('addressLine', { required: 'Required', minLength: { value: 3, message: 'Too short' } })}
                  />
                  {errors.addressLine && <p className="mt-1 text-xs text-rose-600">{errors.addressLine.message}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium">Note <span className="text-xs text-slate-400">(optional)</span></label>
                  <input className="input mt-1 w-full" placeholder="Landmark, delivery instructions, etc." {...register('note')} />
                </div>
              </div>
              </fieldset>

              {user ? (
                <button type="submit" className="btn-primary w-full justify-center gap-2">
                  Review order
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => googleLogin('/qr-calling#order')}
                  className="btn-primary w-full justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" /> Sign in with Google to continue
                </button>
              )}
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Dispatched in 1–2 business days, delivered in 3–7.{' '}
                <Link to="/shipping-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                  Shipping policy
                </Link>
              </p>
            </form>
          )}
          </div>
        </section>

        {/* HOW IT WORKS — one picture per step (photo crops + phone mock-ups) */}
        <section id="how-it-works" className="bg-gradient-to-b from-white via-emerald-50/60 to-white py-16 dark:from-slate-950 dark:via-emerald-500/[0.05] dark:to-slate-950">
          <div className="mx-auto mb-10 max-w-6xl px-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">How it works</p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Four steps, done once</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Set it up in minutes. After that, anyone can reach you, and nobody sees your number.
            </p>
          </div>

          {/* Mobile: swipeable row · tablet: 2×2 · desktop: 4 across */}
          <ol className="mx-auto flex max-w-6xl snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
            {STEPS.map(({ visual: Visual, title, desc }, i) => (
              <li key={title} className="group w-[78%] shrink-0 snap-center sm:w-auto">
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-slate-100 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl dark:bg-slate-800 dark:ring-white/10">
                  <Visual />
                  <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-sm font-extrabold text-white shadow-lg ring-2 ring-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-center text-xs text-slate-400 sm:hidden">Swipe to see all 4 steps →</p>
        </section>

        {/* FEATURES + ICE callout */}
        <section className="mx-auto max-w-5xl px-4 pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-6">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-brand-600" />
                <h3 className="font-display text-base font-semibold">Your number stays private</h3>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card border-rose-200 p-6 dark:border-rose-900/40">
              <div className="flex items-center gap-2">
                <ShieldPlus className="h-5 w-5 text-rose-500" />
                <h3 className="font-display text-base font-semibold">Optional emergency card</h3>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Off by default. If you switch it on, a scanner can see your blood group, medical
                notes, and family contacts, every field opt-in, shown only after they verify your
                plate. Family numbers are direct <span className="font-mono text-xs">tel:</span> links,
                so an ambulance or bystander can call instantly.
              </p>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="mx-auto max-w-2xl px-4 py-14">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Pricing</p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Pay Once. Lifetime validity.</h2>
          </div>
          <div className="card mx-auto max-w-sm p-6 text-center">
            <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              <Gift className="h-3.5 w-3.5" /> One-time, lifetime
            </span>
            <p className="mt-3 font-display text-4xl font-bold">₹{QR_STICKER_PRICE}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">No renewals, no monthly fee</p>
            <ul className="mt-4 space-y-1.5 text-left text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> QR sticker, shipped to your address</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> Configure & Use</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> Lifetime validity (no renewals)</li>
            </ul>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-center text-xs text-slate-400">
            You'll review every detail before payment. Pay ₹{QR_STICKER_PRICE} once — that's it.
          </p>
        </section>

        {/* FAQ — native <details> accordion: keyboard + screen-reader friendly, no state */}
        <section id="faq" className="mx-auto max-w-3xl px-4 pb-16">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">FAQ</p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map(({ q, a }, i) => (
              <details
                key={q}
                open={i === 0}
                className="card group p-0 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-4 text-sm text-slate-600 dark:text-slate-300">{a}</p>
              </details>
            ))}
          </div>
        </section>


      </main>
      <Footer variant="qr" />
    </>
  );
};

const CONFETTI_COLORS = ['#2f66ff', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];

const useConfetti = (count = 18) =>
  useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.round(Math.random() * 100),
      delay: Math.round(Math.random() * 500) / 1000,
      duration: 1.4 + Math.random() * 0.9,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 5 + Math.round(Math.random() * 4),
    })),
  )[0];

const FULFILMENT_STEPS = [
  { icon: CheckCircle2, label: 'Payment received' },
  { icon: Package, label: 'Preparing & shipping' },
  { icon: Home, label: 'Delivered' },
];

/** Post-payment celebration — confetti + a drawn-in checkmark, then the practical bits (order recap, what's next, CTAs). */
const SuccessCard = ({ plate }: { plate: string }) => {
  const confetti = useConfetti();

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-brand-50 p-8 text-center shadow-2xl shadow-emerald-900/10 dark:border-emerald-500/30 dark:from-emerald-500/10 dark:via-slate-900 dark:to-brand-500/10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(480px_260px_at_15%_-10%,rgba(16,185,129,0.35),transparent_60%),radial-gradient(480px_260px_at_100%_110%,rgba(47,102,255,0.28),transparent_60%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((p) => (
          <span
            key={p.id}
            className="absolute top-0 rounded-sm animate-confetti-fall"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="relative">
        <span className="mx-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700 shadow-sm ring-1 ring-emerald-200 backdrop-blur dark:bg-slate-900/60 dark:text-emerald-300 dark:ring-emerald-500/30">
          <Sparkles className="h-3.5 w-3.5" /> Payment successful
        </span>

        <div className="relative mx-auto mt-5 flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ring-pulse" />
          <span className="absolute inset-0 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40 animate-pop-in" />
          <svg viewBox="0 0 24 24" className="relative h-9 w-9 text-white">
            <path
              d="M5 13l4 4L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="48"
              strokeDashoffset="48"
              className="animate-draw-check"
            />
          </svg>
        </div>

        <h3 className="mt-5 font-display text-xl font-bold text-slate-900 dark:text-slate-50 animate-fade-up" style={{ animationDelay: '0.35s' }}>
          You're all set!
        </h3>
        <p
          className="mx-auto mt-1.5 max-w-sm text-sm text-slate-600 dark:text-slate-300 animate-fade-up"
          style={{ animationDelay: '0.45s' }}
        >
          Your QR sticker for <span className="rounded border-2 border-slate-800 bg-white px-1.5 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-900 dark:border-slate-300 dark:bg-slate-800 dark:text-slate-100">{plate}</span> is on its way. Add silent hours or an emergency card any time from My Vehicles.
        </p>

        <div className="mx-auto mt-7 flex max-w-xs items-start justify-between animate-fade-up" style={{ animationDelay: '0.55s' }}>
          {FULFILMENT_STEPS.map(({ icon: Icon, label }, i) => (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full ring-2',
                    i === 0
                      ? 'bg-emerald-500 text-white ring-emerald-500'
                      : 'bg-white text-slate-400 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="w-16 text-[10px] font-semibold leading-tight text-slate-500 dark:text-slate-400">{label}</span>
              </div>
              {i < FULFILMENT_STEPS.length - 1 && (
                <span className="mx-1.5 mb-4 h-0.5 flex-1 rounded bg-slate-200 dark:bg-slate-700" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-2 animate-fade-up" style={{ animationDelay: '0.65s' }}>
          <Link to="/qr-orders" className="btn-primary gap-1.5">View your orders</Link>
          <Link to="/vehicles" className="btn-ghost gap-1.5"><Car className="h-4 w-4" /> My Vehicles</Link>
        </div>
      </div>
    </div>
  );
};

const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="text-right font-medium text-slate-800 dark:text-slate-100">{value}</dd>
  </div>
);
