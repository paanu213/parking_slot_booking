import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Bike, Car, CheckCircle2, Gift, IndianRupee, Loader2, Pencil, Truck, UserCheck, UserPlus, UserRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { errMsg } from '@/lib/qrCallingFormat';
import { digits10, isPhone10, phoneInputProps } from '@/lib/phone';
import { useAdminQrPrice } from '@/pages/QrSettingsPage';


/** Same three steps as the website order form (sign in is replaced by the customer's account details). */
const STEPS = [
  { key: 'details', label: 'Details' },
  { key: 'review', label: 'Review' },
  { key: 'payment', label: 'Payment' },
] as const;
type Step = (typeof STEPS)[number]['key'];

const PAID_SOURCES = [
  { value: 'OFFLINE_SALE', label: 'Offline sale' },
  { value: 'SUPPORT', label: 'Customer support' },
  { value: 'CAMPAIGN', label: 'Promotion / campaign' },
  { value: 'INFLUENCER', label: 'Influencer' },
  { value: 'OTHER', label: 'Other' },
] as const;

const FREE_REASONS = [
  { value: 'CAMPAIGN', label: 'Promotion / campaign' },
  { value: 'INFLUENCER', label: 'Influencer' },
  { value: 'SUPPORT', label: 'Customer support' },
  { value: 'OTHER', label: 'Other' },
] as const;

type Channel = 'INFLUENCER' | 'CAMPAIGN' | 'SUPPORT' | 'OFFLINE_SALE' | 'OTHER';
type Method = 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'OTHER';

const METHOD_LABEL: Record<Method, string> = { UPI: 'UPI', CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', OTHER: 'Other' };

interface LookupResult {
  customer: { id: string; fullName: string; email: string; phone: string | null; orderCount: number } | null;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/* ── Small UI pieces (labels match the website form) ───────────────────────── */

const Label = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <label className="text-sm font-medium">
    {children}
    {hint && <span className="ml-1 text-xs font-normal text-slate-400">{hint}</span>}
  </label>
);
const Err = ({ msg }: { msg?: string }) => (msg ? <p className="mt-1 text-xs text-rose-600">{msg}</p> : null);

const Stepper = ({ current }: { current: Step }) => {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="mx-auto mb-8 flex max-w-md items-center">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2',
                i < idx ? 'bg-emerald-500 text-white ring-emerald-500'
                  : i === idx ? 'bg-brand-600 text-white ring-brand-600'
                  : 'bg-white text-slate-400 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700',
              )}
            >
              {i < idx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn('whitespace-nowrap text-[11px] font-semibold', i === idx ? 'text-brand-700 dark:text-brand-300' : i < idx ? 'text-emerald-600' : 'text-slate-400')}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && <span className={cn('mx-2 mb-4 h-0.5 flex-1 rounded', i < idx ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700')} />}
        </div>
      ))}
    </div>
  );
};

const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);

const Option = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'rounded-xl border-2 p-4 text-left transition',
      active ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
    )}
  >
    {children}
  </button>
);

/* ── Page ──────────────────────────────────────────────────────────────────── */

/**
 * Admin creates a QR sticker order with the exact fields of the website order
 * form (vehicle + shipping, pincode lookup, locality), plus the customer's
 * account. Then records payment: paid (counts in revenue like a website
 * payment) or not paid (promotion, influencer, support). The order appears in
 * the customer's account the same way a website order does.
 */
export default function NewStickerOrderPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('details');
  const [tried, setTried] = useState(false);

  // Customer account (the website gets this from Google sign-in)
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Your vehicle (same as website)
  const [vehicleType, setVehicleType] = useState<'CAR' | 'BIKE'>('CAR');
  const [plateNumber, setPlateNumber] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');

  // Shipping address (same as website)
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [area, setArea] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [note, setNote] = useState('');

  // Payment
  const [paid, setPaid] = useState<boolean | null>(null);
  const [paidSource, setPaidSource] = useState<Channel>('OFFLINE_SALE');
  // Amount defaults to the current sticker price set on the QR Config page.
  const { data: currentPrice } = useAdminQrPrice();
  const [amount, setAmount] = useState('');
  useEffect(() => { if (currentPrice !== undefined) setAmount((a) => a || String(currentPrice)); }, [currentPrice]);
  const [method, setMethod] = useState<Method>('UPI');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(todayISO());
  const [freeReason, setFreeReason] = useState<Channel>('CAMPAIGN');
  const [freeNote, setFreeNote] = useState('');

  /* Existing customer lookup */
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const lookup = useQuery<LookupResult>({
    queryKey: ['admin-qr-customer-lookup', email.trim().toLowerCase()],
    queryFn: async () => (await api.get('/admin/qr/customers/lookup', { params: { email: email.trim() } })).data,
    enabled: emailOk,
    staleTime: 30_000,
  });
  const existing = emailOk ? lookup.data?.customer ?? null : null;
  useEffect(() => {
    if (!existing) return;
    setFullName((v) => v || existing.fullName);
    setCustomerPhone((v) => v || digits10(existing.phone ?? ''));
  }, [existing]);

  /* Pincode -> state / district / city / localities (same lookup as the website) */
  const lastPin = useRef('');
  const [pinState, setPinState] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  useEffect(() => {
    const p = pincode.replace(/\D/g, '');
    if (p.length !== 6 || p === lastPin.current) return;
    lastPin.current = p;
    setPinState('loading');
    setAreaOptions([]);
    setArea('');
    api.get(`/util/pincode/${p}`)
      .then(({ data }) => {
        if (!data?.state) throw new Error('not found');
        setCity(data.city ?? '');
        setState(data.state ?? '');
        setDistrict(data.district ?? '');
        const places = Array.isArray(data.places) ? data.places : [];
        const names: string[] = places.length ? places.map((pl: { name: string }) => pl.name) : [data.area].filter(Boolean);
        setAreaOptions(names);
        if (names.length === 1) setArea(names[0]);
        setPinState('found');
      })
      .catch(() => { setDistrict(''); setPinState('error'); });
  }, [pincode]);

  /* Validation (same rules as the website form) */
  const detailErrors = {
    email: !emailOk ? 'Enter a valid email' : undefined,
    fullName: fullName.trim().length < 2 ? 'Enter the customer name' : undefined,
    customerPhone: customerPhone && !isPhone10(customerPhone) ? 'Enter a 10-digit mobile number' : undefined,
    plateNumber: plateNumber.trim().length < 4 ? 'Enter the vehicle number' : undefined,
    contactPhone: !isPhone10(contactPhone) ? 'Enter the number to ring' : undefined,
    ownerName: ownerName.trim().length < 2 ? 'Enter the name' : undefined,
    pincode: !/^\d{6}$/.test(pincode) ? 'Enter a valid 6-digit pincode' : undefined,
    state: state.trim().length < 2 ? 'Required' : undefined,
    city: city.trim().length < 2 ? 'Required' : undefined,
    area: areaOptions.length > 0 && !area ? 'Select the locality' : undefined,
    addressLine: addressLine.trim().length < 3 ? 'Required' : undefined,
  };
  const detailsValid = Object.values(detailErrors).every((e) => !e);
  const e = (k: keyof typeof detailErrors) => (tried ? detailErrors[k] : undefined);

  const paymentValid = paid === false || (paid === true && Number(amount) > 0 && !!paidOn);

  const fullAddress = [addressLine, area, city, state].filter((x) => x.trim()).join(', ') + (pincode ? `, ${pincode}` : '');

  const create = useMutation({
    mutationFn: async () =>
      (await api.post<{ orderId: string; status: string }>('/admin/qr/orders', {
        channel: paid ? paidSource : freeReason,
        customer: { email: email.trim(), fullName: fullName.trim(), phone: customerPhone || undefined },
        vehicle: { vehicleType, plateNumber: plateNumber.trim(), contactPhone, ownerName: ownerName.trim() },
        // Street + locality collapse into one line, same as the website order.
        addressLine: [addressLine.trim(), area.trim()].filter(Boolean).join(', '),
        city: city.trim(),
        state: state.trim(),
        pincode,
        note: note.trim() || undefined,
        payment: paid
          ? { mode: 'OFFLINE', amount: Number(amount), method, reference: reference.trim() || undefined, paidOn }
          : { mode: 'COMPLIMENTARY', reason: freeNote.trim() || undefined },
      })).data,
    onSuccess: (data) => navigate('/sticker-orders', { state: { createdOrderId: data.orderId } }),
  });

  const goReview = () => {
    setTried(true);
    if (detailsValid) { setStep('review'); window.scrollTo({ top: 0 }); }
  };

  return (
    <section className="p-6">
      <Link to="/sticker-orders" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        <ArrowLeft className="h-3 w-3" /> Back to Sticker Orders
      </Link>

      <div className="mx-auto mt-4 max-w-3xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">New sticker order</h1>
          <p className="mt-1 text-sm text-slate-500">Same details as the website order form. The customer gets 2 identical stickers.</p>
        </div>

        <Stepper current={step} />

        {/* ── Step 1: Details ───────────────────────────────────────── */}
        {step === 'details' && (
          <div className="card space-y-6 p-6">
            {/* Customer account */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <UserRound className="h-4 w-4" /> Customer account
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <Label>Email</Label>
                  <input className={cn('input mt-1 w-full', e('email') && 'border-rose-500')} type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="name@example.com" />
                  <Err msg={e('email')} />
                </div>
                <div>
                  <Label>Full name</Label>
                  <input className={cn('input mt-1 w-full', e('fullName') && 'border-rose-500')} value={fullName} onChange={(ev) => setFullName(ev.target.value)} />
                  <Err msg={e('fullName')} />
                </div>
                <div>
                  <Label hint="(optional)">Mobile</Label>
                  <input {...phoneInputProps} className={cn('input mt-1 w-full', e('customerPhone') && 'border-rose-500')} value={customerPhone} onChange={(ev) => setCustomerPhone(digits10(ev.target.value))} placeholder="10-digit mobile" />
                  <Err msg={e('customerPhone')} />
                </div>
              </div>
              {emailOk && (
                <p className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-xs', existing ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
                  {lookup.isFetching ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking for an existing account…</>
                    : existing ? <><UserCheck className="h-3.5 w-3.5" /> Existing customer: <b>{existing.fullName}</b>, {existing.orderCount} previous order{existing.orderCount === 1 ? '' : 's'}. The order is added to their account.</>
                    : <><UserPlus className="h-3.5 w-3.5" /> New customer. An account is created, and they can sign in with Google on this email to see the order.</>}
                </p>
              )}
            </div>

            {/* Your vehicle */}
            <div className="space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Car className="h-4 w-4" /> Your vehicle
              </h3>
              <div>
                <Label>This sticker is for a</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {([['CAR', 'Car', Car], ['BIKE', 'Bike', Bike]] as const).map(([v, label, Icon]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVehicleType(v)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition',
                        vehicleType === v ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
                      )}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Number plate</Label>
                <input
                  className={cn('input mt-1 w-full font-mono uppercase tracking-wide', e('plateNumber') && 'border-rose-500')}
                  placeholder="AP16HJ7956"
                  value={plateNumber}
                  onChange={(ev) => setPlateNumber(ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                />
                <Err msg={e('plateNumber')} />
              </div>
              <div>
                <Label>Contact number</Label>
                <input {...phoneInputProps} className={cn('input mt-1 w-full', e('contactPhone') && 'border-rose-500')} placeholder="10-digit number that rings when someone scans the QR" value={contactPhone} onChange={(ev) => setContactPhone(digits10(ev.target.value))} />
                <Err msg={e('contactPhone')} />
              </div>
              <div>
                <Label>Name</Label>
                <input className={cn('input mt-1 w-full', e('ownerName') && 'border-rose-500')} value={ownerName} onChange={(ev) => setOwnerName(ev.target.value)} />
                {e('ownerName') ? <Err msg={e('ownerName')} /> : <p className="mt-1 text-xs text-slate-400">The name and contact number are also used for delivery.</p>}
              </div>
            </div>

            {/* Shipping address */}
            <div className="space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Truck className="h-4 w-4" /> Shipping address
              </h3>
              <div>
                <Label>Pincode</Label>
                <div className="relative mt-1 w-36">
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit pincode"
                    className={cn('input w-full pr-8', e('pincode') && 'border-rose-500')}
                    value={pincode}
                    onChange={(ev) => setPincode(ev.target.value.replace(/\D/g, ''))}
                  />
                  {pinState === 'loading' && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
                  {pinState === 'found' && <CheckCircle2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
                </div>
                {e('pincode') ? <Err msg={e('pincode')} />
                  : pinState === 'error' ? <p className="mt-1 text-xs text-amber-600">Pincode not found, fill in the fields below manually.</p>
                  : pinState === 'idle' ? <p className="mt-1 text-xs text-slate-400">Enter the pincode first, the rest fills in.</p> : null}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Country</Label>
                  <input className="input mt-1 w-full bg-slate-50 text-slate-500 dark:bg-slate-800/60" value="India" disabled />
                </div>
                <div>
                  <Label hint="(auto)">State</Label>
                  <input className={cn('input mt-1 w-full', e('state') && 'border-rose-500', pinState === 'found' && 'bg-slate-50 dark:bg-slate-800/60')} value={state} onChange={(ev) => setState(ev.target.value)} />
                </div>
                <div>
                  <Label hint="(auto)">District</Label>
                  <input className={cn('input mt-1 w-full', pinState === 'found' && 'bg-slate-50 dark:bg-slate-800/60')} value={district} onChange={(ev) => setDistrict(ev.target.value)} />
                </div>
              </div>
              <div>
                <Label hint="(auto)">City / Town</Label>
                <input className={cn('input mt-1 w-full', e('city') && 'border-rose-500', pinState === 'found' && 'bg-slate-50 dark:bg-slate-800/60')} value={city} onChange={(ev) => setCity(ev.target.value)} />
              </div>
              {areaOptions.length > 0 && (
                <div>
                  <Label hint={`(${areaOptions.length} found for this pincode)`}>Locality</Label>
                  <select className={cn('input mt-1 w-full', e('area') && 'border-rose-500')} value={area} onChange={(ev) => setArea(ev.target.value)}>
                    <option value="">Select the locality…</option>
                    {areaOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <Err msg={e('area')} />
                </div>
              )}
              <div>
                <Label>House / Flat no., Street</Label>
                <input placeholder="e.g. Flat 302, Sai Residency, 4th Cross" className={cn('input mt-1 w-full', e('addressLine') && 'border-rose-500')} value={addressLine} onChange={(ev) => setAddressLine(ev.target.value)} />
                <Err msg={e('addressLine')} />
              </div>
              <div>
                <Label hint="(optional)">Note</Label>
                <input className="input mt-1 w-full" placeholder="Landmark, delivery instructions, etc." value={note} onChange={(ev) => setNote(ev.target.value)} />
              </div>
            </div>

            {tried && !detailsValid && <p className="text-sm text-rose-600">Fix the highlighted fields to continue.</p>}
            <button type="button" onClick={goReview} className="btn-primary w-full justify-center">Review order</button>
          </div>
        )}

        {/* ── Step 2: Review ────────────────────────────────────────── */}
        {step === 'review' && (
          <div className="card space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Review the order</h3>
              <button type="button" onClick={() => setStep('details')} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <Line label="Customer" value={`${fullName} · ${email.trim()}`} />
              <Line label="Vehicle" value={vehicleType === 'BIKE' ? 'Bike' : 'Car'} />
              <Line label="Number plate" value={plateNumber} />
              <Line label="Contact number" value={contactPhone} />
              <Line label="Name" value={ownerName} />
              <Line label="Deliver to" value={`${ownerName} · ${contactPhone}`} />
              <Line label="Address" value={fullAddress} />
              {note.trim() && <Line label="Note" value={note} />}
              <Line label="In the pack" value="2 identical QR stickers" />
            </div>
            <button type="button" onClick={() => setStep('payment')} className="btn-primary w-full justify-center">Continue to payment</button>
          </div>
        )}

        {/* ── Step 3: Payment ───────────────────────────────────────── */}
        {step === 'payment' && (
          <div className="card space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Payment</h3>
              <button type="button" onClick={() => setStep('review')} className="text-sm font-semibold text-brand-600 hover:underline">Back to review</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Option active={paid === true} onClick={() => setPaid(true)}>
                <IndianRupee className="h-5 w-5 text-emerald-600" />
                <p className="mt-2 font-semibold">Mark as paid</p>
                <p className="mt-0.5 text-xs text-slate-500">Money received offline. Counts in revenue like a website payment.</p>
              </Option>
              <Option active={paid === false} onClick={() => setPaid(false)}>
                <Gift className="h-5 w-5 text-violet-600" />
                <p className="mt-2 font-semibold">Not paid</p>
                <p className="mt-0.5 text-xs text-slate-500">Given free, for a promotion, influencer or support case. Counts as ₹0.</p>
              </Option>
            </div>

            {paid === true && (
              <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 dark:bg-slate-800/50">
                <div>
                  <Label>Amount received (₹)</Label>
                  <input className={cn('input mt-1 w-full', !(Number(amount) > 0) && 'border-rose-500')} type="number" min="1" value={amount} onChange={(ev) => setAmount(ev.target.value)} />
                </div>
                <div>
                  <Label>Paid on</Label>
                  <input className="input mt-1 w-full" type="date" max={todayISO()} value={paidOn} onChange={(ev) => setPaidOn(ev.target.value)} />
                </div>
                <div>
                  <Label>Payment method</Label>
                  <select className="input mt-1 w-full" value={method} onChange={(ev) => setMethod(ev.target.value as Method)}>
                    {(Object.keys(METHOD_LABEL) as Method[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                  </select>
                </div>
                <div>
                  <Label hint="(optional)">Reference</Label>
                  <input className="input mt-1 w-full" placeholder="UPI transaction ID or receipt no." value={reference} onChange={(ev) => setReference(ev.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Order source</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {PAID_SOURCES.map((s) => (
                      <button key={s.value} type="button" onClick={() => setPaidSource(s.value)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', paidSource === s.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300')}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {paid === false && (
              <div className="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                <div>
                  <Label>Reason</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {FREE_REASONS.map((r) => (
                      <button key={r.value} type="button" onClick={() => setFreeReason(r.value)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', freeReason === r.value ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300')}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label hint="(optional)">Details</Label>
                  <input className="input mt-1 w-full" placeholder="e.g. Diwali campaign, creator name, ticket number" value={freeNote} onChange={(ev) => setFreeNote(ev.target.value)} />
                </div>
              </div>
            )}

            {create.isError && <p className="text-sm text-rose-600">{errMsg(create.error, 'Could not create the order')}</p>}
            <button type="button" onClick={() => create.mutate()} disabled={!paymentValid || create.isPending} className="btn-primary w-full justify-center gap-2">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {create.isPending ? 'Creating order…' : paid === true ? `Create order · ₹${Number(amount) || 0} paid` : paid === false ? 'Create order · not paid' : 'Choose paid or not paid'}
            </button>
            <p className="text-center text-xs text-slate-400">The order is confirmed and appears in Sticker Orders and in the customer's account.</p>
          </div>
        )}
      </div>
    </section>
  );
}
