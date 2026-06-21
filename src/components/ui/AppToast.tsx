import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export const TOAST_DURATION_MS = 3500;

interface AppToastProps {
  errorMessage: string | null;
  successMessage: string | null;
  onDismissError: () => void;
  onDismissSuccess: () => void;
}

export default function AppToast({
  errorMessage,
  successMessage,
  onDismissError,
  onDismissSuccess,
}: AppToastProps) {
  useEffect(() => {
    if (!errorMessage) return;
    const timer = window.setTimeout(onDismissError, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [errorMessage, onDismissError]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(onDismissSuccess, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [successMessage, onDismissSuccess]);

  const activeToast = errorMessage
    ? { kind: "error" as const, title: "System Alert", message: errorMessage }
    : successMessage
      ? { kind: "success" as const, title: "Success Overview", message: successMessage }
      : null;

  if (!activeToast) return null;

  const isError = activeToast.kind === "error";

  return createPortal(
    <div
      className="fixed top-4 right-4 z-[90] w-[min(calc(100vw-2rem),20rem)] pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto p-3 rounded-lg text-xs flex items-start gap-2.5 shadow-lg border-l-4 animate-fade-in ${
          isError
            ? "bg-rose-50 border-rose-500 text-rose-900"
            : "bg-emerald-50 border-emerald-500 text-emerald-900"
        }`}
        id={isError ? "error-toast-banner" : "success-toast-banner"}
      >
        <div
          className={`p-1 rounded-full shrink-0 ${
            isError ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {isError ? "!" : "✓"}
        </div>
        <div className="min-w-0">
          <p className={`font-bold ${isError ? "text-rose-950" : "text-emerald-950"}`}>
            {activeToast.title}
          </p>
          <p className="mt-0.5 leading-snug">{activeToast.message}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
