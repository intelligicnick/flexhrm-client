import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
  showDetails: boolean;
}

export default class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error, showDetails: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("Flex HRM render error:", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null, showDetails: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-[#0C1E4A] via-[#152a5c] to-[#1a3568] p-6 font-sans safe-area-top safe-area-bottom">
          <div className="max-w-sm w-full">
            <div className="rounded-3xl border border-white/10 bg-white/95 backdrop-blur shadow-2xl shadow-black/20 overflow-hidden">
              <div className="bg-gradient-to-r from-[#ff791a] to-[#ff981a] px-6 py-5 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-white text-2xl font-black shadow-inner">
                  FH
                </div>
                <h1 className="text-lg font-black text-white">Something went wrong</h1>
                <p className="text-xs text-orange-100 mt-1 font-medium">
                  FlexHRM Field Team hit an unexpected error
                </p>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                  <p className="text-sm text-amber-900 font-medium leading-relaxed">
                    Your work may not be lost. Try continuing first — if the problem persists, reload the app.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={this.handleRetry}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-sm rounded-2xl transition cursor-pointer shadow-md shadow-orange-200/50"
                  >
                    <RefreshCw size={16} />
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={this.handleReload}
                    className="w-full px-4 py-3 text-slate-600 hover:text-slate-800 font-semibold text-sm rounded-2xl border border-slate-200 bg-white cursor-pointer"
                  >
                    Reload app
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                  className="w-full text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {this.state.showDetails ? "Hide technical details" : "Show technical details"}
                </button>

                {this.state.showDetails && (
                  <pre className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-words">
                    {this.state.error.message}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
