/**
 * SearchableSelect — combobox with type-to-search filtering.
 *
 * Renders the dropdown via React Portal so it's never clipped by any
 * ancestor's overflow (same approach as KebabMenu).
 *
 * Usage:
 *   <SearchableSelect
 *     value={state}
 *     onChange={setState}
 *     options={['Andhra Pradesh', 'Karnataka', ...]}
 *     placeholder="All states"
 *     icon={<MapPin className="h-3.5 w-3.5" />}
 *   />
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  options: string[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  width?: string;        // tailwind width class — e.g. 'w-48'
}

export const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  emptyLabel  = 'No matches',
  disabled    = false,
  icon,
  width       = 'w-48',
}: Props) => {
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // Position panel under the trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top:   rect.bottom + window.scrollY + 4,
      left:  rect.left   + window.scrollX,
      width: rect.width,
    });
  }, [open]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${width} group inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600`}
      >
        {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
        <span className={`flex-1 truncate ${value ? '' : 'text-slate-400'}`}>
          {value ?? placeholder}
        </span>
        {value ? (
          <span
            role="button"
            onClick={handleClear}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
      </button>

      {open && coords && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'absolute', top: coords.top, left: coords.left, width: Math.max(coords.width, 220) }}
          className="z-50 max-h-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="w-full bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">{emptyLabel}</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`flex w-full items-center px-3 py-1.5 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    opt === value ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : ''
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
