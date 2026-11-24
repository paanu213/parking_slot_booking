import { useEffect, useState } from 'react';

/**
 * Shown while a page's code downloads. Stays invisible for the first 200 ms so
 * fast loads don't flash a spinner.
 */
export const PageLoader = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      {show && (
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 dark:border-slate-700 dark:border-t-brand-400" />
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
};
