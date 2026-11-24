import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let parsedMessage = error.message;
    try {
      const obj = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (obj && obj.error) {
        parsedMessage = `${obj.error}${obj.path ? ` (${obj.operationType ?? 'op'} on ${obj.path})` : ''}`;
      }
    } catch {
      // Keep raw error message
    }
    return { hasError: true, message: parsedMessage || 'Unexpected rendering error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#121927] border border-red-500/30 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="font-display text-lg font-semibold">Studio Runtime Error</h2>
            </div>
            <p className="text-sm text-slate-300 font-mono break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Recover Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
