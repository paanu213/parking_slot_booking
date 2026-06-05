/**
 * Saved-spaces state — kept in Zustand so the heart button on any card can
 * instantly reflect the current state without waiting for an API round-trip.
 *
 * On mount (when the user is signed in) the `HydrateSavedSpaces` component
 * fetches the full saved-location-ID list from the API and populates this
 * store. Toggle calls POST /api/customer/me/saved-spaces/:id and updates the
 * store optimistically.
 */

import { create } from 'zustand';

interface SavedState {
  ids: Set<string>;
  ready: boolean;
  setIds: (ids: string[]) => void;
  toggle: (id: string) => void;
}

export const useSaved = create<SavedState>((set) => ({
  ids: new Set(),
  ready: false,
  setIds: (ids) => set({ ids: new Set(ids), ready: true }),
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ids: next };
    }),
}));
