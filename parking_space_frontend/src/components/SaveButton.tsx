import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useSaved } from '@/store/savedSpaces';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/cn';

/**
 * Heart toggle that saves/unsaves a parking space for the signed-in user.
 *
 * - Optimistically flips the local Zustand store so the icon responds instantly.
 * - Persists via POST /api/customer/me/saved-spaces/:id (server toggles).
 * - If signed out, sends the user to /login with returnTo set to the page they
 *   were on, so they can save after authenticating.
 */
export const SaveButton = ({
  locationId,
  className,
  showLabel = false,
}: {
  locationId: string;
  className?: string;
  showLabel?: boolean;
}) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const ids = useSaved((s) => s.ids);
  const toggleLocal = useSaved((s) => s.toggle);
  const isSaved = ids.has(locationId);

  const mutate = useMutation({
    mutationFn: () => api.post(`/customer/me/saved-spaces/${locationId}`),
    onSuccess: (res) => {
      // Reconcile with the server's authoritative result
      const saved = res.data?.saved as boolean;
      if (saved !== isSaved) toggleLocal(locationId);
      qc.invalidateQueries({ queryKey: ['saved-spaces'] });
    },
    onError: () => {
      // Roll back the optimistic flip
      toggleLocal(locationId);
      toast.error('Could not update', 'Please try again.');
    },
  });

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      nav(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    // Optimistic flip, then persist
    toggleLocal(locationId);
    mutate.mutate();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSaved}
      aria-label={isSaved ? 'Remove from saved' : 'Save this space'}
      title={isSaved ? 'Remove from saved' : 'Save this space'}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4 transition', isSaved && 'fill-rose-500 text-rose-500')} />
      {showLabel && <span className="text-sm font-medium">{isSaved ? 'Saved' : 'Save'}</span>}
    </button>
  );
};
