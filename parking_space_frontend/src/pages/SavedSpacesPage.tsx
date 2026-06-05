import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import { api } from '@/lib/api';
import { Footer } from '@/components/Footer';
import { CardSkeleton } from '@/components/Skeleton';
import { LocationCard, type Location } from '@/pages/ExplorePage';

export const SavedSpacesPage = () => {
  const { data, isLoading } = useQuery<{ items: Location[] }>({
    queryKey: ['saved-spaces'],
    queryFn: async () => (await api.get('/customer/me/saved-spaces')).data,
  });

  const items = data?.items ?? [];

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600">
          <ArrowLeft className="h-3 w-3" /> Back to home
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <Heart className="h-5 w-5 fill-current" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Saved spaces</h1>
            <p className="text-sm text-slate-500">Parking spaces you've bookmarked for later</p>
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : items.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-slate-500">
                {items.length} saved space{items.length === 1 ? '' : 's'}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((l) => <LocationCard key={l.id} loc={l} />)}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <Heart className="h-7 w-7" />
              </span>
              <h2 className="mt-4 font-display text-lg font-bold">No saved spaces yet</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Tap the heart icon on any parking space to save it here for quick access.
              </p>
              <Link
                to="/spaces"
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
              >
                Browse parking spaces →
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};
