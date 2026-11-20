import { Lock, Phone, PhoneOff, ShieldCheck } from 'lucide-react';
import { useQrPrice } from '@/hooks/useQrPrice';

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
export const OrderVisual = () => {
  const price = useQrPrice();
  return (
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
          <span className="text-slate-500">Pack of 2 · 10 years</span>
          <span className="font-extrabold">₹{price}</span>
        </div>
        <div className="mt-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 py-1.5 text-center text-[10px] font-bold text-white shadow">
          Pay ₹{price}
        </div>
      </div>
    </PhoneFrame>
  </div>
);
};

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

/** One printed sticker, as it ships — used by the product gallery. */
export const StickerCard = ({ label, className }: { label?: string; className?: string }) => (
  <div className={`relative rounded-xl bg-white p-2.5 text-slate-900 shadow-xl ring-1 ring-slate-200 ${className ?? ''}`}>
    <div className="flex items-center justify-center gap-1">
      <span className="h-2 w-2 rounded-full bg-amber-400" />
      <p className="text-[10px] font-extrabold italic tracking-wide">
        <span className="text-amber-500">AUTO</span> <span className="text-emerald-600">SAHAY</span>
      </p>
    </div>
    <FakeQr className="mx-auto mt-1.5 w-full text-slate-900" />
    <p className="mt-1.5 text-center text-[10px] font-bold">Scan to call owner</p>
    <p className="text-center text-[8px] text-slate-500">Your number stays private</p>
    {label && (
      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
        {label}
      </span>
    )}
  </div>
);

/** Gallery slide — what's in the pack: 2 identical stickers. */
export const PackOfTwoVisual = () => (
  <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-6">
    <div className="flex items-end gap-4">
      <StickerCard label="Front" className="w-[38%] min-w-[110px] -rotate-6" />
      <StickerCard label="Back" className="w-[38%] min-w-[110px] rotate-6" />
    </div>
    <p className="mt-6 text-center text-sm font-bold text-slate-800">2 identical QR stickers in every order</p>
    <p className="text-center text-xs text-slate-500">Same QR on both, stick one on the front, one on the back</p>
  </div>
);

/** Gallery slide — where the two stickers go on a car (side-view illustration). */
export const FrontBackVisual = () => (
  <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
    <svg viewBox="0 0 400 170" className="w-full max-w-md" aria-hidden>
      {/* road */}
      <rect x="0" y="150" width="400" height="6" rx="3" fill="#cbd5e1" />
      {/* body */}
      <path d="M30 120 Q30 95 55 92 L110 88 L150 52 Q160 44 175 44 L265 44 Q282 44 292 54 L325 88 L360 94 Q378 98 378 118 L378 128 Q378 134 372 134 L36 134 Q30 134 30 128 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="3" />
      {/* windows */}
      <path d="M122 88 L156 58 Q162 52 172 52 L212 52 L212 88 Z" fill="#bae6fd" stroke="#0f172a" strokeWidth="2" />
      <path d="M220 52 L262 52 Q274 52 282 60 L310 88 L220 88 Z" fill="#bae6fd" stroke="#0f172a" strokeWidth="2" />
      {/* lights */}
      <rect x="32" y="104" width="14" height="8" rx="3" fill="#fde68a" />
      <rect x="362" y="104" width="14" height="8" rx="3" fill="#f87171" />
      {/* wheels */}
      <circle cx="105" cy="136" r="20" fill="#0f172a" /><circle cx="105" cy="136" r="8" fill="#94a3b8" />
      <circle cx="300" cy="136" r="20" fill="#0f172a" /><circle cx="300" cy="136" r="8" fill="#94a3b8" />
      {/* sticker spots: front windshield + rear window */}
      <rect x="134" y="66" width="18" height="18" rx="3" fill="#10b981" stroke="#fff" strokeWidth="2" />
      <rect x="282" y="66" width="18" height="18" rx="3" fill="#10b981" stroke="#fff" strokeWidth="2" />
    </svg>
    <div className="mt-4 grid w-full max-w-md grid-cols-2 gap-3 text-center">
      <div className="rounded-xl bg-white p-3 shadow ring-1 ring-slate-200">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Front</p>
        <p className="text-xs text-slate-600">Windshield corner, seen when someone faces your car</p>
      </div>
      <div className="rounded-xl bg-white p-3 shadow ring-1 ring-slate-200">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Back</p>
        <p className="text-xs text-slate-600">Rear window or bumper, seen from behind</p>
      </div>
    </div>
    <p className="mt-3 text-[11px] text-slate-400">On a bike: one on the front visor, one at the back.</p>
  </div>
);

/** Gallery slide — the real product photo, full frame. */
export const ProductPhotoVisual = () => (
  <img
    src="/images/qr-hero-scan@2x.jpg"
    alt="Someone scanning an AutoSahay QR sticker on a car to call the owner"
    className="h-full w-full object-cover object-[70%_center]"
    loading="eager"
    fetchPriority="high"
  />
);
