import React, { useEffect, useState } from "react";
import { Loader2, X, ZoomIn } from "lucide-react";
import { useSupervisorOverlayBack } from "../../lib/supervisor-back-handler";

export default function SupervisorPhotoLightbox({
  thumbSrc,
  src,
  alt,
  caption,
  onClose,
}: {
  thumbSrc?: string;
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
}) {
  const [displaySrc, setDisplaySrc] = useState(thumbSrc || src);
  const [loadingFull, setLoadingFull] = useState(Boolean(thumbSrc && thumbSrc !== src));
  const closeOverlay = useSupervisorOverlayBack(true, onClose);

  useEffect(() => {
    setDisplaySrc(thumbSrc || src);
    setLoadingFull(Boolean(thumbSrc && thumbSrc !== src));
  }, [src, thumbSrc]);

  useEffect(() => {
    if (!src || src === thumbSrc) {
      setLoadingFull(false);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setDisplaySrc(src);
        setLoadingFull(false);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setDisplaySrc(thumbSrc || src);
        setLoadingFull(false);
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, thumbSrc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [closeOverlay]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={closeOverlay}
    >
      <div className="flex items-center justify-between px-4 pt-4 safe-area-top">
        <p className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
          <ZoomIn size={14} />
          Tap outside to close
        </p>
        <button
          type="button"
          onClick={closeOverlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white cursor-pointer hover:bg-white/20"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {loadingFull && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-white/70" />
          </div>
        )}
        <img
          src={displaySrc}
          alt={alt}
          className={`max-h-full max-w-full rounded-2xl object-contain shadow-2xl transition-opacity duration-200 ${
            loadingFull ? "opacity-60" : "opacity-100"
          }`}
        />
      </div>
      {caption && (
        <p className="shrink-0 px-4 pb-6 text-center text-xs text-slate-200 safe-area-bottom">
          {caption}
        </p>
      )}
    </div>
  );
}
