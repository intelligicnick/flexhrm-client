import React, { useEffect } from "react";
import { X } from "lucide-react";

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
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white cursor-pointer safe-area-top"
        aria-label="Close"
      >
        <X size={24} />
      </button>
      <div className="flex-1 flex items-center justify-center p-4 min-h-0" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="max-w-full max-h-full object-contain rounded-lg" />
      </div>
      {caption && (
        <p className="shrink-0 px-4 pb-6 text-center text-xs text-slate-200 safe-area-bottom">{caption}</p>
      )}
    </div>
  );
}
