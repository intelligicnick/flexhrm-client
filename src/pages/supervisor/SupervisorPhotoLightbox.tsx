import React, { useEffect } from "react";
import { X, ZoomIn } from "lucide-react";

export default function SupervisorPhotoLightbox({
  src,
  alt,
  caption,
  onClose,
}: {
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 pt-4 safe-area-top">
        <p className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
          <ZoomIn size={14} />
          Tap outside to close
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white cursor-pointer hover:bg-white/20"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
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
