import React, { useEffect } from "react";

export default function SupervisorToast({
  message,
  onDone,
  durationMs = 2000,
}: {
  message: string;
  onDone?: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone?.(), durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onDone]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[200] flex justify-center px-4 pt-4 safe-area-top pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-sm rounded-2xl bg-slate-900/95 px-5 py-3.5 text-center text-sm font-semibold text-white shadow-2xl backdrop-blur-sm">
        {message}
      </div>
    </div>
  );
}
