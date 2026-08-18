import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Log the full stack trace
    if (errorInfo.componentStack) {
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  public render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
          <div className="text-center text-white max-w-2xl">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Oops! Something went wrong</h1>
            <p className="text-gray-300 mb-4">The Cab Management System encountered an error.</p>
            {isDev && this.state.error && (
              <div className="text-left mb-4 p-4 bg-slate-900 rounded border border-red-500/30 overflow-auto max-h-64">
                <pre className="text-sm text-red-300 whitespace-pre-wrap break-all">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </div>
            )}
            <button 
              onClick={() => window.location.reload()} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;