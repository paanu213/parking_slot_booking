import { SlidersHorizontal } from 'lucide-react';
import { CallLimitsSetting } from '@/pages/QrCallingPage';

/** Call limits config — its own page under the QR Code menu for quick access. */
export default function QrSettingsPage() {
  return (
    <section className="space-y-5 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <SlidersHorizontal className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Call Limits</h1>
          <p className="mt-1 text-sm text-slate-500">Abuse and cost limits for scan-to-call. Changes apply to the next call.</p>
        </div>
      </div>
      <div className="max-w-3xl"><CallLimitsSetting /></div>
    </section>
  );
}
