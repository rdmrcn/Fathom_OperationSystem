import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Last-resort catch so a render bug does not blank the whole interview demo. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Fathom render error", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-svh place-items-center bg-bg px-6 text-center text-fg">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Fathom</p>
          <h1 className="mt-2 text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 max-w-md text-sm text-muted">{this.state.error.message}</p>
          <button type="button" className="mt-5 text-sm font-medium text-accent hover:underline" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
