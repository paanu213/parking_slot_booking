import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, IndianRupee, Loader2, SlidersHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/qrCallingFormat';
import { CallLimitsSetting } from '@/pages/QrCallingPage';

/** Shared admin hook: current QR sticker price in rupees (pack of 2). */
export const useAdminQrPrice = () =>
  useQuery<{ stickerPricePaise: number }, unknown, number>({
    queryKey: ['admin-qr-pricing'],
    queryFn: async () => (await api.get('/admin/qr/settings/pricing')).data,
    select: (d) => d.stickerPricePaise / 100,
  });

/**
 * Sticker price (pack of 2). A change applies to orders placed from then on:
 * every order stores the price it was bought at, so existing orders, payments
 * and revenue figures keep their original amounts.
 */
const StickerPriceSetting = () => {
  const qc = useQueryClient();
  const { data: current, isLoading } = useAdminQrPrice();
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (current !== undefined) setDraft(String(current)); }, [current]);

  const save = useMutation({
    mutationFn: async () => (await api.patch('/admin/qr/settings/pricing', { stickerPrice: Number(draft) })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-qr-pricing'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const value = Number(draft);
  const valid = Number.isInteger(value) && value >= 1 && value <= 100000;
  const changed = current !== undefined && value !== current;

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <IndianRupee className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Sticker price</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Price of one order (pack of 2 identical stickers). Shown on the website and charged at checkout.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Price (₹)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="input w-40 pl-7 text-lg font-semibold"
                />
              </div>
            </div>
            <button type="button" onClick={() => save.mutate()} disabled={!valid || !changed || save.isPending} className="btn-primary gap-1.5">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {save.isPending ? 'Saving…' : 'Save price'}
            </button>
            {saved && <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
          </div>
          {!valid && draft !== '' && <p className="mt-2 text-xs text-rose-600">Enter a whole rupee amount between ₹1 and ₹1,00,000.</p>}
          {save.isError && <p className="mt-2 text-xs text-rose-600">{errMsg(save.error, 'Could not save the price')}</p>}

          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Current price: <b>₹{current}</b>. A new price applies to orders placed after you save.
            Orders already placed keep the amount they were bought at, in admin and in the customer&apos;s account.
          </div>
        </>
      )}
    </div>
  );
};

/** QR Config: sticker price and call limits for the QR Calling product. */
export default function QrSettingsPage() {
  return (
    <section className="space-y-5 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <SlidersHorizontal className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">QR Config</h1>
          <p className="mt-1 text-sm text-slate-500">Sticker price and scan-to-call limits. Changes apply from the next order or call.</p>
        </div>
      </div>
      <div className="max-w-3xl space-y-5">
        <StickerPriceSetting />
        <CallLimitsSetting />
      </div>
    </section>
  );
}
