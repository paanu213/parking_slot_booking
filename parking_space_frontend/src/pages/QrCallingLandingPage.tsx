import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { startGoogleLogin } from '@/lib/googleLogin';
import { useQrPrice } from '@/hooks/useQrPrice';
import { friendlyPaymentError, useQrPaymentCheckout } from '@/hooks/useQrPaymentCheckout';


interface OrderForm {
  vehicleType: VehicleKind;
  plateNumber: string;
  contactPhone: string;
  ownerName: string;
  pincode: string;
  city: string;
  state: string;
  district: string;
  area: string;
  addressLine: string; // house/flat no. + street only — city/state/area are separate
  note: string;
}

const googleLogin = startGoogleLogin;

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

/**
 * QR sticker order page (/qr-calling/order) — reached from "Buy now" on the
 * product page (QrProductPage, /qr-calling). Order wizard:
 *   sign in (Google) → details → preview & edit → pay (Razorpay — see
 * useQrPaymentCheckout) → confirmation. A failed/cancelled payment never
 * loses the form: it stays on this step with everything filled in and a
 * "Try again" retry.
 */
export const QrCallingLandingPage = () => {
  const { user, hydrated } = useAuth();
  // Current admin-set price for the pack of 2 (one-time, valid 10 years). The
  // backend snapshots the price onto the order, which is what gets charged.
  const price = useQrPrice();
  const [step, setStep] = useState<'details' | 'preview' | 'done'>('details');
  // Car/Bike picked on the product page arrives as ?vehicle=CAR|BIKE.
  const [searchParams] = useSearchParams();
  const initialVehicle: VehicleKind = searchParams.get('vehicle') === 'BIKE' ? 'BIKE' : 'CAR';

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrderForm>({ defaultValues: { vehicleType: initialVehicle } });
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
          // One contact per order: the name and contact number above are used for delivery.
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
      await startCheckout(orderId, { name: v2.ownerName.trim(), contact: v2.contactPhone.trim(), email: user?.email });
    } catch (e) {
      setPaymentError(friendlyPaymentError(e));
    } finally {
      setStarting(false);
    }
  };

  const v = getValues();
  const fullAddress = [v.addressLine, v.area, v.city, v.state].filter(Boolean).join(', ') + (v.pincode ? `, ${v.pincode}` : '');

  return (
    <>
      <main>
        {/* Product summary — this page is the order form; the product page is /qr-calling */}
        <section className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto flex max-w-5xl items-center gap-4">
            <Link to="/qr-calling" className="hidden shrink-0 text-xs font-semibold text-slate-500 hover:text-brand-600 sm:block">
              ← Back to product
            </Link>
            <img src="/images/qr-hero-scan.jpg" alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover object-[70%_center] ring-1 ring-slate-200 dark:ring-slate-700" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold sm:text-base">AutoSahay Smart QR Sticker, Pack of 2</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">2 identical stickers, front and back · Valid for 10 years</p>
            </div>
            <p className="shrink-0 font-display text-lg font-extrabold">₹{price}</p>
          </div>
          <Link to="/qr-calling" className="mx-auto mt-2 block max-w-5xl text-xs font-semibold text-slate-500 hover:text-brand-600 sm:hidden">
            ← Back to product
          </Link>
        </section>

                {/* ORDER WIZARD */}
        <section id="order" className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white px-4 py-16 dark:from-brand-500/[0.06] dark:via-slate-950 dark:to-slate-950">
          <div className="mx-auto max-w-5xl">
            <div className="mb-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Get started</p>
              <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Order your QR sticker</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                Two minutes: sign in, add your vehicle, review and pay. You'll get 2 identical stickers, front and back.
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
                <Line label="Your name" value={v.ownerName} />
                <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                <Line label="Deliver to" value={`${v.ownerName} · ${v.contactPhone}`} />
                <Line label="Address" value={fullAddress} />
                {v.note?.trim() && <Line label="Note" value={v.note} />}
              </dl>

              <div className="rounded-xl border-2 border-brand-100 bg-brand-50/40 p-4 text-sm dark:border-brand-500/20 dark:bg-brand-500/5">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">QR stickers, pack of 2 (valid 10 years)</span><span>₹{price}</span></div>
                <div className="mt-2 flex justify-between border-t border-brand-200 pt-2 font-semibold dark:border-brand-500/20">
                  <span>Pay now</span><span>₹{price}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">One payment, no renewals, your QR sticker works for life.</p>
              </div>

              {paymentError && (
                <div className="flex items-start gap-3 rounded-xl border-2 border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                  <div>
                    <p className="text-sm font-bold text-rose-700 dark:text-rose-300">Payment didn't go through</p>
                    <p className="mt-0.5 text-sm text-rose-600 dark:text-rose-300/90">{paymentError.message}</p>
                    <p className="mt-1 text-xs text-rose-500 dark:text-rose-400">Nothing was lost, your details are right here. Try again whenever you're ready.</p>
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
                {starting ? 'Starting payment…' : paymentError ? `Try again, Pay ₹${price}` : `Pay ₹${price}`}
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
                    onClick={() => googleLogin('/qr-calling/order')}
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
                  <label className="text-sm font-medium">Your name</label>
                  <input
                    className={cn('input mt-1 w-full', errors.ownerName && 'border-rose-500')}
                    {...register('ownerName', { required: 'Enter your name', validate: (v) => v.trim().length >= 2 || 'Enter your name' })}
                  />
                  {errors.ownerName ? <p className="mt-1 text-xs text-rose-600">{errors.ownerName.message}</p>
                    : <p className="mt-1 text-xs text-slate-400">Your name and contact number are also used for delivery.</p>}
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Truck className="h-4 w-4" /> Shipping address
                </h3>

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
                      Pincode not found, fill in the fields below manually.
                    </p>
                  ) : pincodeState === 'idle' ? (
                    <p className="mt-1 text-xs text-slate-400">Enter your pincode first, we'll fill in the rest.</p>
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
                  onClick={() => googleLogin('/qr-calling/order')}
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
