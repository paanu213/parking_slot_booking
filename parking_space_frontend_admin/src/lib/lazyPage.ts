import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'page-chunk-reload-at';

/**
 * React.lazy for route pages, so each page's code downloads only when it's
 * visited. If a deploy replaced the page files while this tab was open, the
 * old file name 404s: reload once to pick up the new version instead of
 * showing an error (guarded so it can never loop).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lazyPage = <T extends ComponentType<any>>(load: () => Promise<{ default: T }>) =>
  lazy(() =>
    load().catch((err: unknown) => {
      let last = 0;
      try { last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0); } catch { /* storage blocked */ }
      if (Date.now() - last > 10_000) {
        try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* storage blocked */ }
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // page is reloading
      }
      throw err;
    }),
  );
