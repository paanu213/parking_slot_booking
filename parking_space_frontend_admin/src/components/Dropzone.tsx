import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud } from 'lucide-react';

interface Props {
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  hint?: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const Dropzone = ({
  accept = 'image/jpeg,image/png,image/webp',
  multiple = true,
  maxSizeMB = 5,
  disabled = false,
  onFiles,
  hint = 'JPEG, PNG or WebP · up to 5MB each',
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (list: FileList | File[]): File[] => {
    const files = Array.from(list);
    const bad = files.find(
      (f) => !ALLOWED_TYPES.includes(f.type) || f.size > maxSizeMB * 1024 * 1024,
    );
    if (bad) {
      setError(
        !ALLOWED_TYPES.includes(bad.type)
          ? `"${bad.name}" is not a supported image type`
          : `"${bad.name}" exceeds ${maxSizeMB}MB`,
      );
      return [];
    }
    setError(null);
    return multiple ? files : files.slice(0, 1);
  };

  const handle = (list: FileList | File[] | null) => {
    if (!list) return;
    const ok = validate(list);
    if (ok.length) onFiles(ok);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    handle(e.dataTransfer.files);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handle(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click(); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragOver
            ? 'border-brand-600 bg-brand-500/5'
            : 'border-slate-300 hover:border-brand-500 dark:border-slate-700'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <UploadCloud className="mb-2 h-6 w-6 text-slate-400" />
        <p className="text-sm font-medium">Drag & drop images here, or click to browse</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={onChange}
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
};
