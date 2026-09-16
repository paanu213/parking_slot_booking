import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Copy, Download, FileText, Layers, Plus, Printer, QrCode, Search, Unlink, X } from 'lucide-react';
import QRCodeLib from 'qrcode';
import JSZip from 'jszip';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { statusCls, fmtDateTime, errMsg } from '@/lib/qrCallingFormat';

interface BatchRow {
  id: string; label: string; quantity: number; note: string | null;
  printedAt: string | null; createdAt: string;
  unclaimed: number; claimed: number; disabled: number;
}

interface StickerRow {
  id: string; token: string; url: string;
  status: 'UNCLAIMED' | 'CLAIMED' | 'DISABLED';
  batchLabel: string; plate: string | null; ownerEmail: string | null;
  claimedAt: string | null; createdAt: string;
}

const STICKER_STATUS = ['UNCLAIMED', 'CLAIMED', 'DISABLED'] as const;

/**
 * Print-run generation + individual sticker lookup/lifecycle (disable,
 * unbind). Separate from Sticker Orders (fulfilment) and Registrations
 * (order funnel) — this page is about the physical inventory itself.
 */
export default function QrBatchesPage() {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [quantity, setQuantity] = useState(100);
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [qrBatch, setQrBatch] = useState<{ id: string; label: string } | null>(null);

  const batches = useQuery<{ items: BatchRow[] }>({
    queryKey: ['admin-qr-batches'],
    queryFn: async () => (await api.get('/admin/qr/batches')).data,
  });

  const stickers = useQuery<{ items: StickerRow[] }>({
    queryKey: ['admin-qr-stickers', q, status],
    queryFn: async () => (await api.get('/admin/qr/stickers', { params: { q: q || undefined, status: status || undefined } })).data,
    enabled: q.trim().length > 0 || status !== '',
  });

  const generate = useMutation({
    mutationFn: () => api.post('/admin/qr/batches', { label: label.trim(), quantity, note: note.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-qr-batches'] });
      setLabel(''); setNote(''); setQuantity(100);
    },
  });

  const markPrinted = useMutation({
    mutationFn: ({ id, printed }: { id: string; printed: boolean }) =>
      api.patch(`/admin/qr/batches/${id}`, { markPrinted: printed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-qr-batches'] }),
  });

  const unbind = useMutation({
    mutationFn: (id: string) => api.post(`/admin/qr/stickers/${id}/unbind`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-qr-stickers'] }),
  });

  const toggleDisabled = useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      api.patch(`/admin/qr/stickers/${id}/disable`, { disabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-qr-stickers'] }),
  });

  const exportCsv = async (id: string, batchLabel: string) => {
    const res = await api.get(`/admin/qr/batches/${id}/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-batch-${batchLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const downloadStickerPdf = async (id: string, batchLabel: string) => {
    setPdfBusyId(id);
    try {
      const res = await api.get(`/admin/qr/batches/${id}/sticker-pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-stickers-${batchLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfBusyId(null);
    }
  };

  return (
    <section className="space-y-5 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <Layers className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">QR Batches</h1>
          <p className="mt-1 text-sm text-slate-500">Print runs and individual sticker lookup/lifecycle.</p>
        </div>
      </div>

      {/* Generate a batch */}
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Generate a print run</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Pilot Sept 2026" className="input w-56" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Quantity</label>
            <input
              type="number" min={1} max={2000}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(2000, Number(e.target.value) || 0)))}
              className="input w-28"
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" />
          </div>
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={!label.trim() || generate.isPending}
            className="btn-primary gap-1.5"
          >
            <Plus className="h-4 w-4" /> {generate.isPending ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {generate.isError && <p className="mt-2 text-xs text-rose-600">{errMsg(generate.error, 'Could not generate the batch.')}</p>}
      </div>

      {/* Batches */}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Label</th><th>Qty</th><th>Unclaimed</th><th>Claimed</th><th>Disabled</th><th>Created</th><th>Printed</th><th /></tr>
          </thead>
          <tbody>
            {batches.isLoading ? (
              <tr><td colSpan={8} className="py-6 text-center text-slate-400">Loading…</td></tr>
            ) : (batches.data?.items ?? []).length === 0 ? (
              <tr><td colSpan={8} className="py-6 text-center text-slate-400">No batches yet.</td></tr>
            ) : (
              batches.data!.items.map((b) => (
                <tr key={b.id}>
                  <td className="font-medium">{b.label}{b.note && <span className="block text-xs text-slate-400">{b.note}</span>}</td>
                  <td>{b.quantity}</td>
                  <td>{b.unclaimed}</td>
                  <td>{b.claimed}</td>
                  <td>{b.disabled}</td>
                  <td className="text-xs text-slate-400">{fmtDateTime(b.createdAt)}</td>
                  <td className="text-xs">
                    {b.printedAt
                      ? <span className="text-emerald-600">{fmtDateTime(b.printedAt)}</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setQrBatch({ id: b.id, label: b.label })}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                      >
                        <QrCode className="h-3 w-3" /> QR codes
                      </button>
                      <button
                        type="button"
                        onClick={() => exportCsv(b.id, b.label)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:underline"
                      >
                        <Download className="h-3 w-3" /> CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadStickerPdf(b.id, b.label)}
                        disabled={pdfBusyId === b.id}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:underline disabled:opacity-50"
                      >
                        <FileText className="h-3 w-3" /> {pdfBusyId === b.id ? 'Generating…' : 'Sticker PDF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => markPrinted.mutate({ id: b.id, printed: !b.printedAt })}
                        disabled={markPrinted.isPending}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:underline disabled:opacity-50"
                      >
                        <Printer className="h-3 w-3" /> {b.printedAt ? 'Unmark' : 'Mark printed'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sticker lookup */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Find a sticker</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Token or plate number" className="input w-72 pl-9" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-40">
            <option value="">Any status</option>
            {STICKER_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {(q.trim() || status) && (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Token</th><th>Batch</th><th>Status</th><th>Bound to</th><th>Claimed</th><th /></tr>
              </thead>
              <tbody>
                {stickers.isLoading ? (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">Loading…</td></tr>
                ) : (stickers.data?.items ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">No stickers match.</td></tr>
                ) : (
                  stickers.data!.items.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs">{s.token}</td>
                      <td className="text-xs text-slate-500">{s.batchLabel}</td>
                      <td><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusCls(s.status))}>{s.status}</span></td>
                      <td>
                        {s.plate
                          ? <><span className="font-mono">{s.plate}</span><span className="block text-xs text-slate-400">{s.ownerEmail}</span></>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="text-xs text-slate-400">{s.claimedAt ? fmtDateTime(s.claimedAt) : '—'}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-3">
                          {s.status === 'CLAIMED' && (
                            <button
                              type="button"
                              onClick={() => { if (confirm(`Unbind sticker ${s.token} from ${s.plate}? The physical sticker is untouched; it returns to unclaimed.`)) unbind.mutate(s.id); }}
                              disabled={unbind.isPending}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline disabled:opacity-50"
                            >
                              <Unlink className="h-3 w-3" /> Unbind
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleDisabled.mutate({ id: s.id, disabled: s.status !== 'DISABLED' })}
                            disabled={toggleDisabled.isPending}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                          >
                            <Ban className="h-3 w-3" /> {s.status === 'DISABLED' ? 'Enable' : 'Disable'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {qrBatch && <BatchQrModal batch={qrBatch} onClose={() => setQrBatch(null)} />}
    </section>
  );
}

// ── QR code viewer / downloader for a batch ─────────────────────────────────
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '');
const PREVIEW_LIMIT = 120;

const BatchQrModal = ({ batch, onClose }: { batch: { id: string; label: string }; onClose: () => void }) => {
  const { data, isLoading } = useQuery<{ items: { token: string; url: string }[] }>({
    queryKey: ['admin-qr-batch-tokens', batch.id],
    queryFn: async () => (await api.get(`/admin/qr/batches/${batch.id}/tokens`)).data,
  });
  const items = data?.items ?? [];

  const [pngByToken, setPngByToken] = useState<Map<string, string>>(new Map());
  const [rendered, setRendered] = useState(0);
  const [busy, setBusy] = useState<null | string>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 1500);
    });
  };

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    (async () => {
      const map = new Map<string, string>();
      for (let i = 0; i < items.length; i++) {
        if (cancelled) return;
        map.set(items[i].token, await QRCodeLib.toDataURL(items[i].url, { width: 260, margin: 1 }));
        if (i % 25 === 0) { setRendered(i); await new Promise((r) => setTimeout(r, 0)); }
      }
      if (!cancelled) { setPngByToken(map); setRendered(items.length); }
    })();
    return () => { cancelled = true; };
  }, [items]);

  const allReady = pngByToken.size === items.length && items.length > 0;

  const downloadZip = async () => {
    setBusy('zip');
    const zip = new JSZip();
    for (const [token, dataUrl] of pngByToken) zip.file(`${token}.png`, dataUrl.split(',')[1], { base64: true });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `qr-${slug(batch.label) || batch.id}.zip`; a.click();
    URL.revokeObjectURL(url);
    setBusy(null);
  };

  const printSheet = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const cells = items
      .map((it) => `<figure><img src="${pngByToken.get(it.token) ?? ''}" /><figcaption>${it.token}</figcaption></figure>`)
      .join('');
    w.document.write(`<!doctype html><title>QR — ${batch.label}</title><style>
      body{font-family:system-ui,sans-serif;margin:16px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
      figure{margin:0;text-align:center;break-inside:avoid}
      img{width:100%;max-width:180px}
      figcaption{font:11px/1.3 ui-monospace,monospace;word-break:break-all;margin-top:4px}
      @media print{@page{margin:10mm}}
    </style><h3>${batch.label} — ${items.length} codes</h3><div class="grid">${cells}</div>
    <script>window.onload=()=>{window.focus();window.print()}</script>`);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold">QR codes — {batch.label}</h2>
            <p className="text-xs text-slate-400">
              {isLoading ? 'Loading…' : `${items.length} codes`}
              {!isLoading && !allReady && items.length > 0 && ` · rendering ${rendered}/${items.length}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadZip}
              disabled={!allReady || busy === 'zip'}
              className="btn-primary gap-1.5 text-xs disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> {busy === 'zip' ? 'Zipping…' : 'Download all (PNG ZIP)'}
            </button>
            <button
              type="button"
              onClick={printSheet}
              disabled={!allReady}
              className="btn-ghost gap-1.5 text-xs disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" /> Print sheet
            </button>
            <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {items.slice(0, PREVIEW_LIMIT).map((it) => {
              const png = pngByToken.get(it.token);
              return (
                <div key={it.token} className="rounded-xl border border-slate-200 p-2 text-center dark:border-slate-700">
                  {png
                    ? <img src={png} alt={it.token} className="mx-auto aspect-square w-full max-w-[150px]" />
                    : <div className="mx-auto aspect-square w-full max-w-[150px] animate-pulse rounded bg-slate-100 dark:bg-slate-800" />}
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <p className="break-all font-mono text-[10px] text-slate-400">{it.token}</p>
                    <button
                      type="button"
                      onClick={() => copyToken(it.token)}
                      title="Copy QR code ID"
                      className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    >
                      {copiedToken === it.token ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  {png && (
                    <a
                      href={png}
                      download={`${it.token}.png`}
                      className="mt-0.5 inline-block text-[11px] font-semibold text-brand-600 hover:underline"
                    >
                      PNG
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          {items.length > PREVIEW_LIMIT && (
            <p className="mt-4 text-center text-xs text-slate-400">
              Showing the first {PREVIEW_LIMIT} of {items.length}. Use “Download all” or “Print sheet” for the complete set.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
