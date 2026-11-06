import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /loading chunk/i.test(error?.message || '') ||
      /failed to fetch dynamically imported module/i.test(error?.message || '') ||
      /error loading dynamically imported module/i.test(error?.message || '');

    if (isChunkError && typeof window !== 'undefined') {
      const alreadyReloaded = window.sessionStorage?.getItem('chunk_error_reloaded');
      if (!alreadyReloaded) {
        window.sessionStorage?.setItem('chunk_error_reloaded', 'true');
        window.location.reload();
        return { hasError: false, error: null };
      }
    }
    return { hasError: true, error };
  }

  componentDidMount() {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem('chunk_error_reloaded');
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-surface border rounded-xl p-6 text-center">
            <h1 className="text-xl font-semibold text-main">Something went wrong</h1>
            <p className="text-sm text-sub mt-2">An unexpected error occurred while rendering this page.</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover cursor-pointer"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.sessionStorage?.removeItem('chunk_error_reloaded');
                    window.location.reload();
                  }
                }}
              >
                Reload
              </button>
              <a
                href="/"
                className="px-4 py-2 border border-border-strong text-sub rounded-lg hover:bg-background cursor-pointer"
              >
                Go Home
              </a>
            </div>
            <div className="mt-4 text-xs text-muted-text">
              {this.state.error?.message}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
