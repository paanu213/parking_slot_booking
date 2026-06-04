import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render-time exceptions so a single broken
 * page doesn't blank out the whole app. Async/network errors still surface via
 * React Query / toasts as usual.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in dev tools without spamming production logs.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('UI error:', error, info);
    }
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold">Something broke on this page</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          We've logged the error and will look into it. Reload the page to continue.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-4 max-w-full overflow-auto rounded-xl bg-slate-100 p-3 text-left text-xs text-rose-600 dark:bg-slate-800 dark:text-rose-300">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => {
              this.reset();
              window.location.reload();
            }}
            className="btn-primary"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Reload
          </button>
          <button
            type="button"
            onClick={() => {
              this.reset();
              window.location.href = '/';
            }}
            className="btn-ghost border border-slate-200 dark:border-slate-700"
          >
            Go home
          </button>
        </div>
      </main>
    );
  }
}
