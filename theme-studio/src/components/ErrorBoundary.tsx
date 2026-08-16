import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Class component because React has no hook equivalent for catching
// render-time errors — without this, any uncaught throw (Monaco failing to
// init, a bad grammar response, etc.) unmounts the whole tree to a blank
// white page with zero feedback.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in VS Code Theme Studio:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-crash">
          <div className="app-crash-title">Something went wrong</div>
          <div className="app-crash-body">
            {this.state.error.message || 'An unexpected error occurred.'}
          </div>
          <button className="app-crash-btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
