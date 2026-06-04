import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Label for the empty / "All" sentinel. Renders as the first option with value="". */
  placeholder?: string;
  /** Rendered before the selected text in the trigger button. */
  leadingIcon?: React.ReactNode;
  /** Accessibility label (when the visible trigger doesn't have a text label). */
  ariaLabel?: string;
  disabled?: boolean;
  /** Tailwind classes applied to the trigger button. */
  triggerClassName?: string;
  /** Tailwind classes applied to the popover panel. */
  panelClassName?: string;
  /** If true, also renders the placeholder ("All …") as a selectable option. */
  showPlaceholderInList?: boolean;
}

/**
 * Themed select with a custom-rendered popover, so the open list uses the
 * project's brand/slate palette + dark mode instead of the browser/OS chrome
 * that a native `<select>` is forced to use.
 *
 * - Trigger button is styleable via `triggerClassName` (so it can blend into
 *   the existing input "pill" container on a page).
 * - Click-outside and Escape close the menu.
 */
export const Select = ({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  leadingIcon,
  ariaLabel,
  disabled,
  triggerClassName,
  panelClassName,
  showPlaceholderInList = true,
}: SelectProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;
  const isPlaceholder = !selected;

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
          triggerClassName,
        )}
      >
        {leadingIcon}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-left',
            isPlaceholder && 'text-slate-500 dark:text-slate-400',
          )}
        >
          {displayLabel}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className={cn(
            'absolute left-0 top-full z-40 mt-1.5 min-w-full max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5',
            'dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/5',
            panelClassName,
          )}
        >
          {showPlaceholderInList && (
            <Option
              label={placeholder}
              selected={isPlaceholder}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              muted
            />
          )}
          {options.map((opt) => (
            <Option
              key={opt.value}
              label={opt.label}
              selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Option = ({
  label,
  selected,
  muted,
  onClick,
}: {
  label: string;
  selected: boolean;
  muted?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    role="option"
    aria-selected={selected}
    onClick={onClick}
    className={cn(
      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition',
      selected
        ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
        : muted
          ? 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/80'
          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/80',
    )}
  >
    <span className="truncate">{label}</span>
    {selected && <Check className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />}
  </button>
);
