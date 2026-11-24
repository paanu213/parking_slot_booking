import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  IndianRupee,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { Footer } from '@/components/Footer';
import { Select } from '@/components/Select';
import { BRAND_NAME, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@/lib/config';
// import { CITIES } from '@/pages/ExplorePage';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import { startGoogleLogin } from '@/lib/googleLogin';

interface LeadForm {
  businessName: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  slotsApprox?: string;
  notes?: string;
}

const BENEFITS = [
  {
    icon: TrendingUp,
    title: 'Steady, predictable revenue',
    desc: 'Hourly, daily, and monthly bookings keep your bays earning around the clock.',
  },
  {
    icon: Sparkles,
    title: 'Zero setup cost',
    desc: 'Listing is free. You set the price and accept the bookings you want.',
  },
  {
    icon: Shield,
    title: 'Verified drivers only',
    desc: 'KYC-checked customers, vehicle records, and entry/exit photos for every booking.',
  },
  {
    icon: IndianRupee,
    title: 'Fast payouts',
    desc: 'Settled directly to your bank or UPI, weekly cycle, no minimum threshold.',
  },
];

const STEPS = [
  { n: '1', title: 'Tell us about your space', desc: 'Fill the short form below, 30 seconds.' },
  { n: '2', title: 'Quick verification call',  desc: "Our team rings to confirm details and walk through pricing." },
  { n: '3', title: 'Go live',                   desc: "Your spot shows up on AutoSahay search the same day approval clears." },
];

export const CITIES = ['Hyderabad', 'Vizag', 'Vijayawada', 'Rajahmundry', 'Bengaluru', 'Chennai'];

export const ListYourSpacePage = () => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadForm>({ defaultValues: { city: '' } });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Sign-in is required to send a request (same as the QR sticker order form):
  // the request is linked to the account, and contact details come prefilled.
  const { user, hydrated } = useAuth();

  useEffect(() => {
    if (!user) return;
    setValue('fullName', user.fullName ?? '');
    setValue('email', user.email ?? '');
    if (user.phone) setValue('phone', user.phone.replace(/\D/g, '').slice(-10));
  }, [user, submitted, setValue]);

  const cityValue = watch('city');

  const submit = useMutation({
    mutationFn: (data: LeadForm) =>
      api.post('/util/vendor-leads', {
        businessName: data.businessName.trim(),
        fullName:     data.fullName.trim(),
        email:        data.email.trim(),
        phone:        data.phone.trim(),
        city:         data.city,
        slotsApprox:  data.slotsApprox ? Number(data.slotsApprox) : undefined,
        notes:        data.notes?.trim() || undefined,
      }),
    onSuccess: () => {
      setSubmitted(true);
      reset({ city: '' });
    },
    onError: (e) => setSubmitError(errorMessage(e)),
  });

  const onSubmit = (data: LeadForm) => {
    setSubmitError(null);
    submit.mutate(data);
  };

  return (
    <>
      <div className="theme-amber">
      {/* HERO: text left, full (uncropped) photo right */}
      <section className="relative overflow-hidden border-b border-slate-200/60 bg-gradient-to-br from-accent-50 via-white to-brand-50/70 dark:border-slate-800/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgb(var(--accent-800)/0.14)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_right,transparent,black_55%)] dark:opacity-30"
        />
        {/* soft green panel the photo sits on (desktop) */}
        <div aria-hidden className="pointer-events-none absolute bottom-12 right-0 top-12 hidden w-[34%] rounded-l-[3rem] bg-gradient-to-b from-accent-100/70 to-accent-200/40 lg:block dark:from-accent-500/10 dark:to-accent-500/5" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:py-16 lg:grid-cols-[1.15fr,1fr] lg:gap-14 lg:py-20">
          <div>
            <h1 className="font-display text-[2.1rem] font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.12] lg:text-[2.6rem] xl:text-[2.85rem] dark:text-white">
              Turn Your Empty Space
              <br />
              into a{' '}
              <span className="text-highlight mt-1">
                Parking Space
              </span>
            </h1>

            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600 sm:text-xl dark:text-slate-300">
              List your vacant land or space, rent it out, and earn a steady income.
            </p>

            <ul className="mt-9 grid max-w-md grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700">
              {[
                { icon: IndianRupee, l1: 'Earn', l2: 'Extra Income' },
                { icon: CalendarDays, l1: 'Manage', l2: 'Bookings' },
                { icon: ShieldCheck, l1: 'Verified', l2: '& Secure' },
              ].map(({ icon: Icon, l1, l2 }) => (
                <li key={l1} className="flex flex-col items-center px-2 text-center">
                  <span className="icon-tile h-14 w-14 bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="mt-3 text-sm font-semibold leading-snug text-slate-800 sm:text-[15px] dark:text-slate-100">
                    {l1}
                    <br />
                    {l2}
                  </span>
                </li>
              ))}
            </ul>

            <a
              href="#lead-form"
              className="btn-accent mt-10"
            >
              List Your Space Today <ArrowRight className="h-5 w-5" />
            </a>
          </div>

          <figure className="relative mx-auto w-full max-w-lg lg:max-w-none">
            {/* white mat around the photo: the whole image shows, nothing cropped */}
            <div className="rounded-[1.75rem] bg-white p-2.5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700">
              <picture>
                <source srcSet="/images/list-space-hero.webp" type="image/webp" />
                <img
                  src="/images/list-space-hero.jpg"
                  alt="Covered parking lot with cars parked in marked bays and an AutoSahay parking sign"
                  width={1254}
                  height={1254}
                  className="block h-auto w-full rounded-[1.25rem]"
                  loading="eager"
                  {...{ fetchpriority: "high" }} // lowercase: React 18 only knows the DOM spelling
                />
              </picture>
            </div>

            {/* floating notes */}
            <div className="absolute -left-5 top-8 hidden items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/80 sm:flex dark:bg-slate-900 dark:ring-slate-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <Sparkles className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Free to list</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">No setup cost</span>
              </span>
            </div>
            <div className="absolute -right-5 bottom-10 hidden items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl shadow-slate-900/10 ring-1 ring-slate-200/80 sm:flex dark:bg-slate-900 dark:ring-slate-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
                <IndianRupee className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Weekly payouts</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">To your bank or UPI</span>
              </span>
            </div>
          </figure>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <SectionHeader
          eyebrow="Why partner with us"
          title="The easiest way to put your bays to work"
          desc="No setup fee, no long contracts. You stay in control of pricing and bookings, we bring the drivers."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="card group p-6 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-brand-500/5 text-brand-600 ring-1 ring-brand-500/20 transition group-hover:scale-105">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-6 text-base font-semibold leading-snug">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-slate-200/60 bg-slate-50 py-16 sm:py-24 dark:border-slate-800/60 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeader
            eyebrow="Three steps"
            title="How it works"
            desc="From first message to your first booking, usually within a day."
          />
          <ol className="relative mt-12 grid gap-5 sm:grid-cols-3">
            {/* connecting line behind the step numbers (desktop) */}
            <span aria-hidden className="absolute left-[16%] right-[16%] top-11 hidden h-px bg-gradient-to-r from-brand-200 via-brand-300 to-brand-200 sm:block dark:from-brand-500/20 dark:via-brand-500/40 dark:to-brand-500/20" />
            {STEPS.map((s) => (
              <li key={s.n} className="card relative p-6">
                <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400 font-display text-lg font-bold text-slate-900 shadow-md shadow-brand-500/30">
                  {s.n}
                </span>
                <h3 className="mt-6 text-base font-semibold leading-snug">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* LEAD CAPTURE FORM */}
      <section id="lead-form" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 sm:py-24">
        {submitted ? (
          <SuccessCard onReset={() => setSubmitted(false)} />
        ) : (
          // No overflow-hidden on this card — it would clip the City dropdown
          // (CLAUDE.md §1). The header tint is clipped via rounded-t-2xl instead.
          <div className="card">
            <div className="rounded-t-2xl border-b border-slate-100 bg-brand-50/40 px-6 py-7 sm:px-8 dark:border-slate-800 dark:bg-brand-500/5">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Get started</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Tell us about your space</h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Fill these details and a team member will reach out within 24 hours to walk you
                through the next steps.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6 sm:p-8">
              {!hydrated ? null : user ? (
                <p className="flex w-fit items-center gap-2 rounded-full bg-accent-50 px-3 py-1.5 text-xs font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Signed in as {user.fullName} · {user.email}
                </p>
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 px-5 py-5 text-center sm:flex-row sm:justify-between sm:text-left dark:border-brand-500/40 dark:bg-brand-500/10">
                  <div className="flex items-center gap-3">
                    <span className="icon-tile h-11 w-11 bg-white text-brand-600 shadow ring-1 ring-brand-100 dark:bg-slate-900 dark:ring-slate-700">
                      <LogIn className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Sign in to unlock this form</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Your request is linked to your account so our team can reach you.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => startGoogleLogin('/list-your-space#lead-form')} className="btn-primary shrink-0 gap-2">
                    <LogIn className="h-4 w-4" /> Continue with Google
                  </button>
                </div>
              )}

              <fieldset
                disabled={!user}
                aria-disabled={!user}
                className={cn('space-y-5', !user && 'pointer-events-none select-none opacity-40 grayscale')}
              >
              <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                <Field label="Business / property name" error={errors.businessName?.message}>
                  <input
                    type="text"
                    className={cn('input mt-1', errors.businessName && 'border-rose-500')}
                    placeholder="e.g. Cyber Towers Parking"
                    {...register('businessName', {
                      required: 'Required',
                      minLength: { value: 2, message: 'Too short' },
                    })}
                  />
                </Field>

                <Field label="Your full name" error={errors.fullName?.message}>
                  <input
                    type="text"
                    className={cn('input mt-1', errors.fullName && 'border-rose-500')}
                    placeholder="Owner / point of contact"
                    {...register('fullName', {
                      required: 'Required',
                      minLength: { value: 2, message: 'Too short' },
                    })}
                  />
                </Field>

                <Field label="Phone" error={errors.phone?.message}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className={cn('input mt-1', errors.phone && 'border-rose-500')}
                    placeholder="10-digit mobile"
                    {...register('phone', {
                      required: 'Required',
                      minLength: { value: 10, message: 'Enter a 10-digit number' },
                      onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); },
                    })}
                  />
                </Field>

                <Field label="Email" error={errors.email?.message}>
                  <input
                    type="email"
                    className={cn('input mt-1', errors.email && 'border-rose-500')}
                    placeholder="you@example.com"
                    {...register('email', {
                      required: 'Required',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                    })}
                  />
                </Field>

                <Field label="City" error={errors.city?.message}>
                  <input type="hidden" {...register('city', { required: 'Pick a city' })} />
                  <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
                    <Select
                      value={cityValue ?? ''}
                      onChange={(v) => setValue('city', v, { shouldValidate: true })}
                      options={CITIES.map((c) => ({ value: c, label: c }))}
                      placeholder="Pick a city"
                      ariaLabel="City"
                      leadingIcon={<MapPin className="h-4 w-4 text-slate-500" />}
                      triggerClassName="w-full py-3 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </Field>

                <Field label="Approx. number of slots" hint="Optional">
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    className="input mt-1"
                    placeholder="e.g. 25"
                    {...register('slotsApprox')}
                  />
                </Field>
              </div>

              <Field label="Anything else we should know?" hint="Optional">
                <textarea
                  rows={3}
                  className="input mt-1"
                  placeholder="Type of space (open / covered / basement), operating hours, etc."
                  {...register('notes')}
                />
              </Field>

              {submitError && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary !mt-7 w-full justify-center gap-2 py-3"
                disabled={isSubmitting || submit.isPending}
              >
                {submit.isPending ? 'Submitting…' : (
                  <>
                    Submit details <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              </fieldset>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Prefer to talk?{' '}
                <a href={`tel:+91${SUPPORT_PHONE}`} className="font-semibold text-brand-600 hover:underline">
                  Call +91 {SUPPORT_PHONE_DISPLAY}
                </a>{' '}
                or{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-brand-600 hover:underline">
                  email {SUPPORT_EMAIL}
                </a>.
              </p>
            </form>
          </div>
        )}
      </section>

      <Footer />
      </div>
    </>
  );
};

// ── Section header: eyebrow, title, supporting line, with consistent rhythm ──
const SectionHeader = ({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) => (
  <div className="max-w-2xl">
    <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
    <h2 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight sm:text-[2rem]">{title}</h2>
    {desc && <p className="mt-4 text-base leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>}
  </div>
);

// ── Local form helpers ──────────────────────────────────────────────────────
const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="mb-1 flex items-baseline justify-between">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </div>
    {children}
    {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
  </div>
);

const SuccessCard = ({ onReset }: { onReset: () => void }) => (
  <div className="card p-8 text-center">
    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300">
      <CheckCircle2 className="h-7 w-7" />
    </span>
    <h2 className="mt-4 font-display text-2xl font-bold">Thanks, we'll be in touch</h2>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
      Your details are with our partnerships team. Expect a call from us within 24 hours.
    </p>

    <div className="mx-auto mt-6 grid max-w-md gap-2 sm:grid-cols-2">
      <a
        href={`tel:+91${SUPPORT_PHONE}`}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent-500/30 bg-accent-50 px-4 py-2.5 text-sm font-semibold text-accent-700 transition hover:bg-accent-100 dark:border-accent-500/20 dark:bg-accent-500/10 dark:text-accent-300"
      >
        <Phone className="h-4 w-4" />
        Call us anytime
      </a>
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
      >
        <Mail className="h-4 w-4" />
        Email us
      </a>
    </div>

    <div className="mt-6 flex items-center justify-center gap-3 text-xs">
      <button type="button" onClick={onReset} className="text-brand-600 hover:underline">
        Submit another property
      </button>
      <span className="text-slate-300">·</span>
      <Link to="/" className="text-slate-500 hover:text-brand-600">
        Back to home
      </Link>
    </div>
  </div>
);
