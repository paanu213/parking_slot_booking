import { useEffect, useState } from 'react';
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
  orderId, token, url, plate,
}: { orderId: string; token: string | null; url: string | null; plate: string | null }) => {
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
        <QrCode className="h-3.5 w-3.5" /> No QR sticker linked to this order yet — record the dispatched sticker first.
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

const REASONS = ['Sticker lost', 'Sticker damaged', 'Sticker stolen', 'Vehicle repainted / panel replaced'];

/**
 * Re-send the same QR as a replacement: order goes back to "Order confirmed —
 * yet to dispatch" as a new delivery attempt, the reason lands on the
 * timeline (the customer sees it too), and pickup -> delivery runs again.
 */
export const ReplacementModal = ({
  orderId, plate, onClose, onDone,
}: { orderId: string; plate: string | null; onClose: () => void; onDone: () => void }) => {
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState('');

  const save = useMutation({
    mutationFn: () => api.post(`/admin/qr/orders/${orderId}/replacement`, {
      reason: detail.trim() ? `${reason}: ${detail.trim()}` : reason,
    }),
    onSuccess: () => { onDone(); onClose(); },
  });

  return (
    <ModalShell
      title="Send replacement sticker"
      subtitle={`Reprints the same QR${plate ? ` for ${plate}` : ''} — calls keep working and the customer doesn't set anything up again. The order goes back to "yet to dispatch" as a new delivery.`}
      onClose={onClose}
    >
      <div className="mt-3 flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
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
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Details (optional) — e.g. customer called on 12 Oct"
        rows={2}
        className="input mt-3 w-full resize-none"
      />
      {save.isError && <p className="mt-1 text-xs text-rose-600">{errMsg(save.error, 'Could not start the replacement')}</p>}
      <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary mt-4 w-full justify-center">
        {save.isPending ? 'Saving…' : 'Send replacement'}
      </button>
    </ModalShell>
  );
};
