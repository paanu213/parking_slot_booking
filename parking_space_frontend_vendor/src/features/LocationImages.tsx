import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Dropzone } from '@/components/Dropzone';

interface Image {
  id: string;
  url: string;
  sortOrder: number;
}

interface Props {
  locationId: string;
  images: Image[];
}

export const LocationImages = ({ locationId, images }: Props) => {
  const qc = useQueryClient();

  // Local previews for files chosen but not yet confirmed from the server
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const pendingRef = useRef<string[]>([]);
  pendingRef.current = pendingPreviews;

  // Revoke object URLs when component unmounts
  useEffect(
    () => () => {
      pendingRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      const res = await api.post(`/vendor/locations/${locationId}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      // Revoke pending object URLs now that real images will load
      pendingPreviews.forEach((u) => URL.revokeObjectURL(u));
      setPendingPreviews([]);
      qc.invalidateQueries({ queryKey: ['vendor-spaces'] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    },
    onError: () => {
      // Keep previews visible so vendor can retry; clear on their next attempt
    },
  });

  const handleFiles = (files: File[]) => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPendingPreviews(urls);
    upload.mutate(files);
  };

  const remove = useMutation({
    mutationFn: (imageId: string) =>
      api.delete(`/vendor/locations/${locationId}/images/${imageId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-spaces'] }),
  });

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Photos</h4>
        {showSuccess && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded successfully
          </span>
        )}
      </div>

      {/* Confirmed images + pending previews */}
      {(sorted.length > 0 || pendingPreviews.length > 0) && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Already saved images */}
          {sorted.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <img
                src={img.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this photo?')) remove.mutate(img.id);
                }}
                disabled={remove.isPending}
                aria-label="Delete photo"
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Pending previews — shown while upload is in progress */}
          {upload.isPending &&
            pendingPreviews.map((url, i) => (
              <div
                key={`pending-${i}`}
                className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-brand-400 bg-slate-50 dark:bg-slate-800"
              >
                <img src={url} alt="" className="h-full w-full object-cover opacity-50" />
                {/* Spinner overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/60 dark:bg-slate-900/60">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                  <span className="text-[10px] font-medium text-brand-600">Uploading…</span>
                </div>
              </div>
            ))}
        </div>
      )}

      <Dropzone
        onFiles={handleFiles}
        disabled={upload.isPending}
        hint={
          upload.isPending
            ? `Uploading ${pendingPreviews.length} image${pendingPreviews.length !== 1 ? 's' : ''}…`
            : `JPEG, PNG or WebP · up to 5 MB each${sorted.length > 0 ? ` · ${sorted.length} uploaded` : ''}`
        }
      />

      {upload.isError && (
        <p className="text-xs text-rose-600">
          Upload failed — {(upload.error as any)?.response?.data?.message ?? 'please try again.'}
        </p>
      )}
    </div>
  );
};
