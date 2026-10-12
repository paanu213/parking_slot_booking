import { Lock, Phone, PhoneOff, ShieldCheck } from 'lucide-react';
import { QR_STICKER_PRICE } from '@/lib/config';

/*
 * Picture-style visuals for the four "how it works" steps on the QR Calling
 * page. Steps 2 and 3 are close-up crops of the real product photo; steps 1
 * and 4 are small phone-screen mock-ups — so each step reads as an image,
 * not an icon + text.
 */

// A decorative QR-like pattern (fixed, not scannable) — 21×21 with the three finder squares.
const QR_SIZE = 21;
const qrCells = (() => {
  const cells: [number, number][] = [];
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= QR_SIZE - 7 && y < 7) || (x < 7 && y >= QR_SIZE - 7);
  let seed = 7;
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      if (inFinder(x, y)) continue;
      seed = (seed * 9301 + 49297) % 233280;
      if (seed / 233280 < 0.48) cells.push([x, y]);
    }
  }
  return cells;
})();

const Finder = ({ x, y }: { x: number; y: number }) => (
  <>
    <rect x={x} y={y} width={7} height={7} fill="currentColor" />
    <rect x={x + 1} y={y + 1} width={5} height={5} fill="white" />
    <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
  </>
);

export const FakeQr = ({ className }: { className?: string }) => (
  <svg viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} className={className} shapeRendering="crispEdges" aria-hidden>
    <rect width={QR_SIZE} height={QR_SIZE} fill="white" />
    {qrCells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />)}
    <Finder x={0} y={0} />
    <Finder x={QR_SIZE - 7} y={0} />
    <Finder x={0} y={QR_SIZE - 7} />
  </svg>
);

/** A phone frame for the mock-up screens. */
const PhoneFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-[88%] w-[56%] rounded-[1.6rem] border-[5px] border-slate-900 bg-slate-900 shadow-2xl shadow-slate-900/40">
    <span aria-hidden className="absolute left-1/2 top-1 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-slate-800" />
    <div className="h-full w-full overflow-hidden rounded-[1.25rem]">{children}</div>
  </div>
);

/** Step 1 — ordering the sticker on the phone. */
export const OrderVisual = () => (
  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-100 via-emerald-50 to-white">
    <PhoneFrame>
      <div className="flex h-full flex-col bg-white px-2.5 pb-3 pt-5 text-slate-900">
        <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Order</p>
        <p className="text-[11px] font-extrabold leading-tight">Your QR sticker</p>
        <div className="mt-2 flex flex-1 flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/60 p-2">
          <div className="w-[70%] rounded-lg bg-white p-1.5 text-slate-900 shadow ring-1 ring-slate-200">
            <p className="text-center text-[7px] font-extrabold text-emerald-700">AutoSahay</p>
            <FakeQr className="mx-auto mt-0.5 w-full text-slate-900" />
            <p className="mt-0.5 text-center text-[7px] font-bold">Scan to call</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[9px]">
          <span className="text-slate-500">One-time · Lifetime</span>
          <span className="font-extrabold">₹{QR_STICKER_PRICE}</span>
        </div>
        <div className="mt-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 py-1.5 text-center text-[10px] font-bold text-white shadow">
          Pay ₹{QR_STICKER_PRICE}
        </div>
      </div>
    </PhoneFrame>
  </div>
);

/** Step 2 — the sticker on the car (close crop of the product photo). */
export const StickVisual = () => (
  <img
    src="/images/qr-hero-scan@2x.jpg"
    alt="AutoSahay QR sticker stuck on the back of a car"
    loading="lazy"
    className="h-full w-full scale-[1.9] object-cover object-[94%_55%] [transform-origin:88%_55%]"
  />
);

/** Step 3 — someone scanning the sticker (close crop on the phone). */
export const ScanVisual = () => (
  <img
    src="/images/qr-hero-scan@2x.jpg"
    alt="Someone scanning the QR sticker with their phone"
    loading="lazy"
    className="h-full w-full scale-[1.45] object-cover object-[62%_60%] [transform-origin:60%_62%]"
  />
);

/** Step 4 — the owner's phone ringing with a masked call. */
export const CallVisual = () => (
  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950">
    <span aria-hidden className="absolute h-40 w-40 animate-ping rounded-full bg-emerald-500/10 [animation-duration:2.4s]" />
    <PhoneFrame>
      <div className="flex h-full flex-col items-center bg-gradient-to-b from-slate-800 to-slate-950 px-2 pb-4 pt-6 text-white">
        <p className="text-[8px] uppercase tracking-widest text-slate-400">Incoming call</p>
        <span className="mt-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/60">
          <ShieldCheck className="h-5 w-5 text-emerald-300" />
        </span>
        <p className="mt-2 text-[11px] font-bold">AutoSahay</p>
        <p className="text-[8px] text-slate-300">Someone near your car</p>
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[7px] font-semibold text-emerald-200">
          <Lock className="h-2 w-2" /> Numbers hidden both ways
        </span>
        <div className="mt-auto flex w-full items-center justify-around">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500">
            <PhoneOff className="h-3.5 w-3.5" />
          </span>
          <span className="flex h-8 w-8 animate-bounce items-center justify-center rounded-full bg-emerald-500 [animation-duration:1.6s]">
            <Phone className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </PhoneFrame>
  </div>
);
