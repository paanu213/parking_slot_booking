import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * A caller/scanner phone number, shown masked (last 4 digits only) by
 * default — the full number is never included in the list response it came
 * from. Admin can reveal it on demand (GET /admin/qr/calls/:id/reveal,
 * audit-logged server-side per call) and copy it. Revealing once caches the
 * value locally so toggling the eye back on doesn't re-hit the API or log
 * a second reveal.
 */
export const MaskedPhone = ({ masked, callId }: { masked: string; callId: string | null }) => {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const reveal = useMutation({
    mutationFn: async () => (await api.get<{ callerNumber: string }>(`/admin/qr/calls/${callId}/reveal`)).data,
    onSuccess: (data) => { setRevealed(data.callerNumber); setVisible(true); },
  });

  const toggleVisible = () => {
    if (!callId) return;
    if (revealed) { setVisible((v) => !v); return; }
    reveal.mutate();
  };

  const copyNumber = async () => {
    if (!callId) return;
    let value = revealed;
    if (!value) {
      try {
        value = (await reveal.mutateAsync()).callerNumber;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — ignore */ }
  };

  const displayValue = visible && revealed ? revealed : masked;

  return (
    <span className="inline-flex items-center gap-1.5 font-mono">
      {displayValue}
      {callId && (
        <>
          <button
            type="button"
            onClick={toggleVisible}
            disabled={reveal.isPending}
            title={visible ? 'Hide number' : 'Show full number'}
            className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            {reveal.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : visible ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={copyNumber}
            disabled={reveal.isPending}
            title="Copy number"
            className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </>
      )}
    </span>
  );
};
