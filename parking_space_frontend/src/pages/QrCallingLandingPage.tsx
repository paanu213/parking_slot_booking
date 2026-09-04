import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  Car, CheckCircle2, Fingerprint, Gift, Loader2,
  PhoneCall, QrCode, ScanLine, ShieldPlus, Truck, UserPlus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/store/auth';
import { Footer } from '@/components/Footer';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/cn';
import { QR_MONTHLY_PRICE, QR_STICKER_PRICE } from '@/lib/config';

const STEPS = [
  { icon: QrCode, title: 'Get your sticker', desc: `Request it here for ₹${QR_STICKER_PRICE}, one sticker, works forever.` },
  { icon: Car, title: 'Stick it on your car', desc: 'Windshield or window, wherever it\'s easy to spot.' },
  { icon: ScanLine, title: 'Anyone can scan it', desc: 'They type your full number plate to reach you, no app needed.' },
  { icon: PhoneCall, title: 'You get a masked call', desc: 'Your real number stays private. In an emergency, an opt-in ICE card can be shown too.' },
];

const FEATURES = [
  'Your phone number is never shown, every call is masked',
  'Optional emergency (ICE) card: blood group, notes, family contacts',
  'Silent hours + a daily call cap, fully in your control',
  'Block a nuisance caller with one tap',
];

interface OrderForm {
  // Account (only asked/required when the visitor isn't signed in)
  accountName: string;
  accountEmail: string;
  accountPassword: string;
  // Vehicle
  plateNumber: string;
  contactPhone: string;
  ownerName: string;
  // Shipping
  shippingName: string;
  shippingPhone: string;
  pincode: string;
  city: string;
  state: string;
  area: string;
  addressLine: string; // house/flat no. + street only — city/state/area are separate
  note: string;
}

/**
 * Public "Get your QR sticker" landing page — how it works, pricing, and the
 * request form. The form is visible to everyone, signed in or not: a
 * first-time visitor fills in an account name/email/password alongside the
 * order, we call the existing /auth/register endpoint to create + sign them
 * in (no separate signup step, no OTP — same call already made for
 * contactPhone verification: ship now, add real verification later if
 * abused), then submit the order on that fresh session. No online payment
 * here either: it's paused sitewide (see CheckoutPage.tsx), so submitting
 * creates a request our team follows up on to confirm payment and shipping.
 * See qrOrders.service.ts on the backend.
 */
export const QrCallingLandingPage = () => {
  const { user, setSession } = useAuth();
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const needsAccount = !user;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OrderForm>();

  // Pincode → city/state/area auto-fill, same backend proxy + UX pattern
  // already used on the vendor "Add space" form (util.service.ts avoids the
  // upstream India Post API's flaky SSL cert by proxying server-side).
  const pincode = watch('pincode');
  const [pincodeState, setPincodeState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [district, setDistrict] = useState('');
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
        setDistrict(data.district ?? '');
        const places = Array.isArray(data.places) ? data.places : [];
        const names: string[] = places.length ? places.map((pl: { name: string }) => pl.name) : [data.area].filter(Boolean);
        setAreaOptions(names);
        if (names.length === 1) setValue('area', names[0], { shouldDirty: true });
        setPincodeState('found');
      })
      .catch(() => {
        setDistrict('');
        setPincodeState('error');
      });
  }, [pincode, setValue]);

  const submit = useMutation({
    mutationFn: async (v: OrderForm) => {
      if (needsAccount) {
        const reg = await api.post('/auth/register', {
          fullName: v.accountName.trim(),
          email:    v.accountEmail.trim(),
          phone:    v.shippingPhone.trim() || undefined,
          password: v.accountPassword,
        });
        setSession(reg.data.user, reg.data.accessToken);
      }

      const payload = {
        vehicle: {
          plateNumber:  v.plateNumber.trim(),
          contactPhone: v.contactPhone.trim(),
          ownerName:    v.ownerName.trim() || undefined,
        },
        shippingName:  v.shippingName.trim(),
        shippingPhone: v.shippingPhone.trim(),
        // Combine "house/street" with the chosen locality into one line —
        // the backend still just stores a single addressLine string.
        addressLine:   [v.addressLine.trim(), v.area?.trim()].filter(Boolean).join(', '),
        city:          v.city.trim(),
        state:         v.state.trim(),
        pincode:       v.pincode.trim(),
        note:          v.note.trim() || undefined,
      };
      const res = await api.post<{ order: { id: string } }>('/customer/me/qr-orders', payload);
      return res.data;
    },
    onSuccess: (data) => setPlacedOrderId(data.order.id),
    onError: (e: unknown) => {
      const msg = errorMessage(e);
      const emailTaken = /email already registered/i.test(msg);
      toast.error(
        emailTaken ? 'Account already exists' : 'Could not submit request',
        emailTaken ? 'Sign in with that email below, then submit your request again.' : msg,
      );
    },
  });

  return (
    <>
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 px-4 py-16 text-white sm:py-20">
          <div aria-hidden className="absolute inset-0 opacity-25 [background:radial-gradient(700px_350px_at_10%_0%,rgba(255,255,255,0.4),transparent_60%)]" />
          <div className="relative mx-auto max-w-3xl text-center">
            {/* <Link to="/" className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white">
              <ArrowLeft className="h-3 w-3" /> Back to home
            </Link> */}
            <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ring-white/20 backdrop-blur">
              <QrCode className="h-3.5 w-3.5" /> QR Calling
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
              A QR sticker that lets people reach you without ever seeing your number
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/80 sm:text-base">
              Stick it on your car. Anyone who needs you for a wrongly parked car, an accident,
              or an emergency, scans it, types your plate, and gets a masked call straight to you.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a href="#order" className="btn gap-2 bg-white text-brand-700 hover:bg-slate-100">
                <QrCode className="h-4 w-4" /> Get your QR sticker — ₹{QR_STICKER_PRICE}
              </a>
              <a href="#how-it-works" className="btn gap-2 border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20">
                How it works
              </a>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="mx-auto max-w-5xl px-4 py-14">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">How it works</p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Four steps, done once</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                  <Icon className="h-6 w-6 text-brand-600" />
                </span>
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
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
                notes, and family contacts, every field opt-in, shown only after they enter your
                exact plate. Family numbers are direct <span className="font-mono text-xs">tel:</span> links,
                so an ambulance or bystander can call instantly.
              </p>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="mx-auto max-w-4xl px-4 py-14">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Pricing</p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Simple, transparent pricing</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                <Gift className="h-3.5 w-3.5" /> One-time
              </span>
              <p className="mt-3 font-display text-3xl font-bold">₹{QR_STICKER_PRICE}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">QR sticker, shipped to your address</p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Works forever, no reprinting</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Two stickers per car</li>
              </ul>
            </div>
            <div className="card p-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Monthly
              </span>
              <p className="mt-3 font-display text-3xl font-bold">₹{QR_MONTHLY_PRICE}<span className="text-base font-medium text-slate-400">/mo</span></p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Call-forwarding &amp; masking service</p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Unlimited masked calls received</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Cancel any time</li>
              </ul>
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-center text-xs text-slate-400">
            Online payment is being finalised — for now, submit your request below and our team
            will reach out to confirm payment before shipping.
          </p>
        </section>

        {/* ORDER FORM */}
        <section id="order" className="mx-auto max-w-xl px-4 pb-16">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Get started</p>
            <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Request your QR sticker</h2>
          </div>

          {placedOrderId ? (
            <div className="card p-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">Request received!</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                We'll contact you shortly to confirm payment (₹{QR_STICKER_PRICE} + ₹{QR_MONTHLY_PRICE}/mo) and delivery.
                Your car is already registered — you can add an emergency card any time from "My Vehicles".
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link to="/vehicles" className="btn-primary gap-1.5">
                  <Car className="h-4 w-4" /> Go to My Vehicles
                </Link>
                <Link to="/" className="btn-ghost">Back to home</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit((v) => submit.mutate(v))} className="card space-y-6 p-6">
              {needsAccount && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <UserPlus className="h-4 w-4" /> Your account
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    We'll create your account so you can track this order and manage your car anytime.
                  </p>
                  <div>
                    <label className="text-sm font-medium">Full name</label>
                    <input
                      className={cn('input mt-1 w-full', errors.accountName && 'border-rose-500')}
                      autoComplete="name"
                      {...register('accountName', { required: 'Enter your name', minLength: { value: 2, message: 'Too short' } })}
                    />
                    {errors.accountName && <p className="mt-1 text-xs text-rose-600">{errors.accountName.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <input
                      type="email"
                      className={cn('input mt-1 w-full', errors.accountEmail && 'border-rose-500')}
                      autoComplete="email"
                      {...register('accountEmail', {
                        required: 'Enter your email',
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                      })}
                    />
                    {errors.accountEmail && <p className="mt-1 text-xs text-rose-600">{errors.accountEmail.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Password</label>
                    <input
                      type="password"
                      className={cn('input mt-1 w-full', errors.accountPassword && 'border-rose-500')}
                      autoComplete="new-password"
                      {...register('accountPassword', {
                        required: 'Create a password',
                        minLength: { value: 8, message: 'At least 8 characters' },
                        validate: {
                          hasUpper: (v) => /[A-Z]/.test(v) || 'Include an uppercase letter',
                          hasLower: (v) => /[a-z]/.test(v) || 'Include a lowercase letter',
                          hasDigit: (v) => /[0-9]/.test(v) || 'Include a digit',
                        },
                      })}
                    />
                    {errors.accountPassword ? (
                      <p className="mt-1 text-xs text-rose-600">{errors.accountPassword.message}</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">8+ chars with an uppercase, a lowercase, and a digit.</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Already have an account?{' '}
                    <Link to={`/login?returnTo=${encodeURIComponent('/qr-calling#order')}`} className="font-semibold text-brand-600 hover:underline">
                      Sign in
                    </Link>{' '}
                    instead.
                  </p>
                </div>
              )}

              <div className={cn('space-y-3', needsAccount && 'border-t border-slate-100 pt-5 dark:border-slate-800')}>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Your car</h3>
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
                    type="tel"
                    className={cn('input mt-1 w-full', errors.contactPhone && 'border-rose-500')}
                    placeholder="Number that rings when someone scans your QR"
                    {...register('contactPhone', { required: 'Enter the number to ring', minLength: { value: 8, message: 'Too short' } })}
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
                <div>
                  <label className="text-sm font-medium">Recipient name</label>
                  <input
                    className={cn('input mt-1 w-full', errors.shippingName && 'border-rose-500')}
                    {...register('shippingName', { required: 'Required' })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone for delivery</label>
                  <input
                    type="tel"
                    className={cn('input mt-1 w-full', errors.shippingPhone && 'border-rose-500')}
                    {...register('shippingPhone', { required: 'Required', minLength: { value: 8, message: 'Too short' } })}
                  />
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
                      Pincode not found — enter city &amp; state manually below.
                    </p>
                  ) : pincodeState === 'found' && district ? (
                    <p className="mt-1 text-xs text-slate-400">District: {district}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">
                      City <span className="text-xs font-normal text-slate-400">(auto)</span>
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
                </div>

                {areaOptions.length > 0 && (
                  <div>
                    <label className="text-sm font-medium">
                      Area / Locality
                      <span className="ml-1.5 text-xs font-normal text-slate-400">
                        ({areaOptions.length} found for this pincode)
                      </span>
                    </label>
                    <select
                      className={cn('input mt-1 w-full', errors.area && 'border-rose-500')}
                      {...register('area', { required: 'Select your area' })}
                    >
                      <option value="">Select your area…</option>
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

              <button type="submit" disabled={isSubmitting || submit.isPending} className="btn-primary w-full justify-center gap-2">
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                {submit.isPending ? 'Submitting…' : `Request my QR sticker`}
              </button>
              <p className="text-center text-xs text-slate-400">
                No payment is collected now — we'll reach out to confirm ₹{QR_STICKER_PRICE} + ₹{QR_MONTHLY_PRICE}/mo before shipping.
              </p>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
};
