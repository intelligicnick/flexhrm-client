import React, { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatClock } from "../../lib/monitor-time";

export interface MonitorScreenshot {
  id: string;
  imageUrl: string;
  timestamp: string;
  appName: string;
  employeeId: string;
}

interface MonitorScreenshotLightboxProps {
  screenshots: MonitorScreenshot[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export default function MonitorScreenshotLightbox({
  screenshots,
  index,
  onClose,
  onIndexChange,
}: MonitorScreenshotLightboxProps) {
  const shot = screenshots[index];
  const hasPrev = index > 0;
  const hasNext = index < screenshots.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(index - 1);
  }, [hasPrev, index, onIndexChange]);

  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(index + 1);
  }, [hasNext, index, onIndexChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, goPrev, goNext]);

  if (!shot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot viewer"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{shot.appName || "Screenshot"}</p>
          <p className="text-xs text-white/70">{formatClock(shot.timestamp)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {screenshots.length > 1 && (
            <span className="text-xs font-semibold text-white/80">
              {index + 1} / {screenshots.length}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div
        className="relative flex-1 flex items-center justify-center min-h-0 px-4 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        {hasPrev && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 sm:left-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
            aria-label="Previous screenshot"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {shot.imageUrl ? (
          <img
            src={shot.imageUrl}
            alt={shot.appName || "Screenshot"}
            className="max-h-[calc(100vh-120px)] max-w-full object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <div className="w-64 h-40 bg-slate-800 rounded-lg flex items-center justify-center text-white/50 text-sm">
            No image
          </div>
        )}

        {hasNext && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 sm:right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
            aria-label="Next screenshot"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
