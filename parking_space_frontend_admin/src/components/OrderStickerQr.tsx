import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import QRCodeLib from 'qrcode';
import { Download, FileText, QrCode } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { errMsg } from '@/lib/qrCallingFormat';
import { ModalShell } from '@/components/VehicleActionsMenu';

export interface OrderFulfilment { delivered: number; returned: number; replacements: number }

const fileSafe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '');

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Print-ready PDF of the exact QR linked to this order — same branded design as batch printing. */
export const downloadOrderStickerPdf = async (orderId: string, label: string) => {
  const res = await api.get(`/admin/qr/orders/${orderId}/sticker-pdf`, { responseType: 'blob' });
  saveBlob(res.data as Blob, `qr-sticker-${fileSafe(label)}.pdf`);
};

/**
 * The QR already linked to this customer's car — preview plus downloads, so a
 * lost or damaged sticker can be reprinted as the very same QR (calls keep
 * working, the customer sets nothing up again).
 */
export const StickerQrPanel = ({
  orderId, token, url, plate, batch,
}: { orderId: string; token: string | null; url: string | null; plate: string | null; batch?: { id: string; label: string } | null }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setDataUrl(null);
    if (url) QRCodeLib.toDataURL(url, { width: 600, margin: 2 }).then((d) => { if (alive) setDataUrl(d); });
    return () => { alive = false; };
  }, [url]);

  if (!token || !url) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <QrCode className="h-3.5 w-3.5" /> No QR sticker linked to this order yet, record the dispatched sticker first.
      </p>
    );
  }

  const label = plate ?? token;

  const downloadPdf = async () => {
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadOrderStickerPdf(orderId, label);
    } catch (e) {
      setPdfError(errMsg(e, 'Could not generate the sticker PDF'));
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadPng = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${fileSafe(label)}.png`;
    a.click();
  };

  return (
    <div className="flex flex-wrap items-start gap-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-700">
        {dataUrl ? <img src={dataUrl} alt={`QR code ${token}`} className="h-full w-full" /> : <span className="text-xs text-slate-400">Loading…</span>}
      </div>
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Linked QR sticker</p>
        <p className="font-mono text-sm font-semibold">{token}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Batch: {batch ? <Link to="/qr-batches" className="font-semibold text-brand-600 hover:underline">{batch.label}</Link> : <span className="text-slate-400">unknown</span>}
        </p>
        <p className="break-all text-xs text-slate-400">{url}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={downloadPdf} disabled={pdfBusy} className="btn-primary gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> {pdfBusy ? 'Preparing…' : 'Download sticker (print PDF)'}
          </button>
          <button type="button" onClick={downloadPng} disabled={!dataUrl} className="btn-ghost gap-1.5 border border-slate-200 text-xs dark:border-slate-700">
            <Download className="h-3.5 w-3.5" /> QR image (PNG)
          </button>
        </div>
        {pdfError && <p className="text-xs text-rose-600">{pdfError}</p>}
      </div>
    </div>
  );
};

/** "Delivered ×2 · Replaced ×1 · Returned ×1" — only the counts that happened. */
export const FulfilmentSummary = ({ f }: { f: OrderFulfilment | undefined }) => {
  if (!f) return null;
  const parts = [
    f.delivered > 0 && { label: `Delivered ×${f.delivered}`, cls: 'text-emerald-700 dark:text-emerald-400' },
    f.replacements > 0 && { label: `Replaced ×${f.replacements}`, cls: 'text-violet-700 dark:text-violet-400' },
    f.returned > 0 && { label: `Returned ×${f.returned}`, cls: 'text-orange-700 dark:text-orange-400' },
  ].filter(Boolean) as { label: string; cls: string }[];
  if (parts.length === 0) return null;
  return (
    <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] font-semibold">
      {parts.map((p) => <span key={p.label} className={p.cls}>{p.label}</span>)}
    </p>
  );
};

const REASONS = ['Sticker damaged', 'Sticker faded', 'Sticker lost', 'Sticker stolen', 'QR misused', 'Vehicle repainted / panel replaced'];
// Reasons where the old QR could still be out there: default to a new code.
const NEW_CODE_REASONS = ['Sticker lost', 'Sticker stolen', 'QR misused'];

type ReplaceMode = 'REPRINT' | 'NEW_CODE';
const MODES: { value: ReplaceMode; title: string; body: string }[] = [
  { value: 'REPRINT', title: 'Reprint the same QR', body: 'For a damaged or faded sticker. Nothing changes for the car or the customer.' },
  { value: 'NEW_CODE', title: 'Issue a new QR code', body: 'For a lost, stolen or misused sticker. The new code works right away and the old one stops working.' },
];

/**
 * Replacement after delivery. Either reprints the same QR, or issues a new
 * code that's linked to the car immediately while the old code is switched
 * off in the same step (never two live QRs for one car). Both put the order
 * back to "yet to dispatch" as a new delivery; the reason shows on the
 * customer's timeline.
 */
export const ReplacementModal = ({
  orderId, plate, onClose, onDone,
}: { orderId: string; plate: string | null; onClose: () => void; onDone: () => void }) => {
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState('');
  const [mode, setMode] = useState<ReplaceMode>('REPRINT');
  const [token, setToken] = useState('');
  const [done, setDone] = useState<{ newToken: string; disabledTokens: string[] } | null>(null);

  const pickReason = (r: string) => {
    setReason(r);
    setMode(NEW_CODE_REASONS.includes(r) ? 'NEW_CODE' : 'REPRINT');
  };

  const save = useMutation({
    mutationFn: async () => (await api.post(`/admin/qr/orders/${orderId}/replacement`, {
      reason: detail.trim() ? `${reason}: ${detail.trim()}` : reason,
      mode,
      token: mode === 'NEW_CODE' && token.trim() ? token.trim() : undefined,
    })).data as { newToken?: string; disabledTokens?: string[] },
    onSuccess: (res) => {
      onDone();
      if (mode === 'NEW_CODE' && res.newToken) setDone({ newToken: res.newToken, disabledTokens: res.disabledTokens ?? [] });
      else onClose();
    },
  });

  if (done) {
    return (
      <ModalShell title="New QR code issued" subtitle={plate ? `Linked to ${plate}.` : "Linked to the vehicle on this order."} onClose={onClose}>
        <div className="mt-3 space-y-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
          <p>New code <b className="font-mono">{done.newToken}</b> is live for this car. The customer doesn't need to set anything up.</p>
          {done.disabledTokens.length > 0 && (
            <p>Switched off: <span className="font-mono">{done.disabledTokens.join(', ')}</span>. Scanning it now shows "inactive".</p>
          )}
          <p>The order is back to "yet to dispatch". Print the new sticker and ship it.</p>
        </div>
        <button
          type="button"
          onClick={() => { void downloadOrderStickerPdf(orderId, plate ?? done.newToken); }}
          className="btn-primary mt-4 w-full justify-center"
        >
          <FileText className="h-4 w-4" /> Download new sticker
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Replace sticker" subtitle={`${plate ? `For ${plate}. ` : ""}The order goes back to "yet to dispatch" as a new delivery.`} onClose={onClose}>
      <p className="mt-3 text-xs font-medium text-slate-500">Reason</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => pickReason(r)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition',
              reason === r
                ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300',
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2">
        {MODES.map((m) => (
          <label
            key={m.value}
            className={cn(
              'flex cursor-pointer gap-2.5 rounded-lg border p-2.5 text-sm transition',
              mode === m.value ? 'border-brand-600 bg-brand-50/60 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700',
            )}
          >
            <input type="radio" name="replace-mode" checked={mode === m.value} onChange={() => setMode(m.value)} className="mt-0.5" />
            <span>
              <span className="block font-semibold">{m.title}</span>
              <span className="block text-xs text-slate-500">{m.body}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === 'NEW_CODE' && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">Sticker from stock (optional)</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Unused sticker code or scanned link"
            className="input w-full font-mono"
          />
          <p className="mt-1 text-[11px] text-slate-400">Leave blank to create a new code you can print right away.</p>
        </div>
      )}

      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Details (optional), e.g. customer called on 12 Oct"
        rows={2}
        className="input mt-3 w-full resize-none"
      />
      {save.isError && <p className="mt-1 text-xs text-rose-600">{errMsg(save.error, 'Could not start the replacement')}</p>}
      <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary mt-4 w-full justify-center">
        {save.isPending ? 'Saving…' : mode === 'NEW_CODE' ? 'Issue new code and send' : 'Send reprint'}
      </button>
    </ModalShell>
  );
};

export const ORDER_TYPES = [
  { value: 'WEBSITE', label: 'Website' },
  { value: 'INFLUENCER', label: 'Influencer' },
  { value: 'CAMPAIGN', label: 'Campaign' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'OFFLINE_SALE', label: 'Offline sale' },
  { value: 'OTHER', label: 'Other' },
] as const;
const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(ORDER_TYPES.map((t) => [t.value, t.label]));

/** Order type tag, shown for every order: "Website", or "Admin · Influencer" for admin-created ones. */
export const OrderSourceBadge = ({ source, channel }: { source?: string; channel?: string | null }) =>
  source === 'ADMIN' ? (
    <span className="mt-1 inline-flex rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30">
      Admin{channel ? ` · ${CHANNEL_LABEL[channel] ?? channel}` : ''}
    </span>
  ) : (
    <span className="mt-1 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      Website
    </span>
  );

/** Order type filter for the order lists. */
export const OrderTypeSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="input h-9 w-44 py-0" aria-label="Order type">
    <option value="">All order types</option>
    {ORDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
  </select>
);

/** Payment cell label: complimentary and offline payments read differently from online ones. */
export const paymentLabel = (paymentStatus: string, paymentMode?: string) => {
  if (paymentStatus === 'PAID' && paymentMode === 'COMPLIMENTARY') return 'COMPLIMENTARY';
  if (paymentStatus === 'PAID' && paymentMode === 'OFFLINE') return 'PAID OFFLINE';
  return paymentStatus;
};

/**
 * Phone numbers on a sticker order: the customer's account mobile, and the
 * contact number, which rings on scan (masked calls) and is used for delivery.
 * A separate delivery phone is shown only if the order really has a different one.
 */
export const OrderPhones = ({ accountPhone, scanPhone, deliveryPhone, deliveryName }: {
  accountPhone: string | null; scanPhone: string | null; deliveryPhone: string; deliveryName: string;
}) => {
  const contact = scanPhone ?? deliveryPhone;
  const differentDelivery = !!scanPhone && deliveryPhone !== scanPhone;
  const rows = [
    { label: 'Account mobile', value: accountPhone, hint: 'Customer account, for contacting the customer' },
    { label: 'Contact number', value: contact, hint: differentDelivery ? 'Rings on scan (masked calls)' : 'Rings on scan (masked calls) and used for delivery', strong: true },
    ...(differentDelivery ? [{ label: 'Delivery phone', value: deliveryPhone, hint: `Different number given for delivery to ${deliveryName}` }] : []),
  ];
  return (
    <div className={cn('grid gap-2', differentDelivery ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
      {rows.map((r) => (
        <div key={r.label} className={cn('rounded-lg border px-3 py-2', r.strong ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700')}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{r.label}</p>
          {r.value
            ? <a href={`tel:${r.value}`} onClick={(e) => e.stopPropagation()} className="font-mono text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">{r.value}</a>
            : <p className="text-sm text-slate-400">Not set</p>}
          <p className="text-[11px] text-slate-500">{r.hint}</p>
        </div>
      ))}
    </div>
  );
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Offline hand-over: the team gives the stickers to the customer directly.
 * Skips pick-up and courier delivery and marks the order delivered.
 */
export const HandoverModal = ({
  orderId, defaultReceiver, onClose, onDone,
}: { orderId: string; defaultReceiver: string; onClose: () => void; onDone: () => void }) => {
  const [on, setOn] = useState(todayISO());
  const [receivedBy, setReceivedBy] = useState(defaultReceiver);
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () => api.post(`/admin/qr/orders/${orderId}/handover`, {
      handedOverOn: on, receivedBy: receivedBy.trim() || undefined, note: note.trim() || undefined,
    }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <ModalShell
      title="Hand over to customer (offline)"
      subtitle="Use this when the team gives the stickers to the customer directly. No courier pick-up or delivery is needed, and the order is marked delivered."
      onClose={onClose}
    >
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Handed over on</label>
          <input type="date" max={todayISO()} value={on} onChange={(e) => setOn(e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Received by</label>
          <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Customer name" className="input w-full" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Given at the Ameerpet stall" className="input w-full" />
        </div>
      </div>
      {save.isError && <p className="mt-2 text-xs text-rose-600">{errMsg(save.error, 'Could not record the hand-over')}</p>}
      <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !on} className="btn-primary mt-4 w-full justify-center">
        {save.isPending ? 'Saving…' : 'Mark as handed over'}
      </button>
    </ModalShell>
  );
};
