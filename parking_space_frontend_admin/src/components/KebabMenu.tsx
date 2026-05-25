/**
 * KebabMenu — portal-based dropdown that is ALWAYS on top.
 *
 * WHY A PORTAL?
 * Dropdowns rendered inside a parent with overflow:hidden/auto/scroll get
 * clipped by the browser regardless of z-index. Rendering via
 * ReactDOM.createPortal() physically moves the dropdown to <body>, so no
 * ancestor's overflow can clip it. position:fixed + getBoundingClientRect()
 * pins it to the correct screen location.
 *
 * RULE FOR ALL FUTURE DROPDOWNS IN THIS PROJECT:
 *   ✅ Use <KebabMenu> + <MenuItem> from this file.
 *   ❌ Never use position:absolute inside a card/table/scrollable container.
 *   ❌ Never add overflow:hidden to a wrapper that contains a dropdown trigger.
 *
 * Usage:
 *   <KebabMenu>
 *     <MenuItem onClick={doSomething} icon={<Edit className="h-4 w-4" />}>
 *       Edit
 *     </MenuItem>
 *     <MenuDivider />
 *     <MenuItem onClick={doDelete} variant="danger" icon={<Trash2 className="h-4 w-4" />}>
 *       Delete
 *     </MenuItem>
 *   </KebabMenu>
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

// ── KebabMenu ─────────────────────────────────────────────────────────────────
export const KebabMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = (e: React.MouseEvent) => {
    // Stop both React synthetic bubbling AND the native DOM event so that
    // the document-level "click → close" listener we add below is not
    // triggered by the very click that opens the menu.
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();

    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const MENU_W = 208; // w-52 = 13rem = 208 px
      const left   = Math.max(8, r.right - MENU_W); // keep inside viewport
      setPos({ top: r.bottom + 4, left });
    }
    setOpen((o) => !o);
  };

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click',   close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click',   close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition"
        aria-label="More options"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && createPortal(
        // Clicking any item bubbles up to document → close handler fires → menu closes.
        // No stopPropagation needed here.
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
};

// ── MenuItem ──────────────────────────────────────────────────────────────────
export const MenuItem = ({
  onClick,
  icon,
  children,
  disabled = false,
  variant  = 'default',
}: {
  onClick?:  () => void;
  icon?:     React.ReactNode;
  children:  React.ReactNode;
  disabled?: boolean;
  variant?:  'default' | 'danger' | 'warning';
}) => {
  const color = {
    default: 'text-slate-700 dark:text-slate-200',
    danger:  'text-red-600   dark:text-red-400',
    warning: 'text-orange-600 dark:text-orange-400',
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition
        hover:bg-slate-50 dark:hover:bg-slate-800
        disabled:opacity-50 disabled:cursor-not-allowed
        ${color}`}
    >
      {icon && <span className="h-4 w-4 shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

// ── MenuDivider ───────────────────────────────────────────────────────────────
export const MenuDivider = () => (
  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
);
