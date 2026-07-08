import React, { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, MapPin, X, ZoomIn } from "lucide-react";
import { SchoolVisit, SchoolVisitPhoto } from "../types";
import { resolvePhotoSrc } from "../lib/media-url";
import { formatLatLngDecimal, isValidGpsCoord } from "../lib/gps-coords";

export function visitPhotoSrc(
  photo: Pick<SchoolVisitPhoto, "photoDataBase64" | "mimeType" | "imagekitUrl">,
) {
  return resolvePhotoSrc(photo);
}

interface VisitPhotoLightboxProps {
  photos: SchoolVisitPhoto[];
  index: number;
  visit?: Pick<SchoolVisit, "schoolName" | "visitDate" | "supervisorName" | "block">;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export default function VisitPhotoLightbox({
  photos,
  index,
  visit,
  onClose,
  onIndexChange,
}: VisitPhotoLightboxProps) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

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

  if (!photo) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Visit photo viewer"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white shrink-0">
        <div className="min-w-0">
          {visit && (
            <>
              <p className="font-bold text-sm truncate">{visit.schoolName}</p>
              <p className="text-xs text-white/70 truncate">
                {visit.visitDate} · {visit.block} — {visit.supervisorName}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {photos.length > 1 && (
            <span className="text-xs font-semibold text-white/80">
              {index + 1} / {photos.length}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-0 px-4 pb-2">
        {hasPrev && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 sm:left-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition cursor-pointer"
            aria-label="Previous photo"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        <img
          src={visitPhotoSrc(photo)}
          alt={photo.caption || "Visit photo"}
          className="max-h-[calc(100vh-180px)] max-w-full object-contain rounded-lg shadow-2xl"
        />

        {hasNext && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 sm:right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition cursor-pointer"
            aria-label="Next photo"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      <div className="shrink-0 px-4 py-3 bg-black/60 text-white text-xs space-y-1">
        {photo.takenAt && (
          <p>
            Taken:{" "}
            {new Date(photo.takenAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          </p>
        )}
        {photo.locationLabel && (
          <p className="flex items-start gap-1">
            <MapPin size={12} className="shrink-0 mt-0.5" />
            <span>{photo.locationLabel}</span>
          </p>
        )}
        {photo.lat != null && photo.lng != null && isValidGpsCoord(photo.lat, photo.lng) && (
          <p className="text-white/80 font-mono">
            Lat/Lng: {formatLatLngDecimal(photo.lat, photo.lng)}
          </p>
        )}
        {photo.caption && <p className="text-white/70">{photo.caption}</p>}
      </div>
    </div>,
    document.body,
  );
}

interface VisitPhotoThumbnailProps {
  photo: SchoolVisitPhoto;
  size?: "sm" | "md" | "lg";
  onView: () => void;
}

const sizeClasses = {
  sm: "w-28 h-28",
  md: "w-36 h-36",
  lg: "w-full aspect-[4/3]",
};

export function VisitPhotoThumbnail({ photo, size = "md", onView }: VisitPhotoThumbnailProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onView();
      }}
      className={`group relative ${sizeClasses[size]} rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff791a]`}
      aria-label="View full photo"
    >
      <img
        src={visitPhotoSrc(photo)}
        alt={photo.caption || "Visit photo"}
        className="w-full h-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition">
          <ZoomIn size={12} /> View
        </span>
      </span>
      {(photo.takenAt || photo.locationLabel || isValidGpsCoord(photo.lat, photo.lng)) &&
        size !== "lg" && (
        <span className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent text-[9px] text-white leading-tight text-left">
          {photo.takenAt && (
            <span className="block truncate">
              {new Date(photo.takenAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {isValidGpsCoord(photo.lat, photo.lng) && (
            <span className="block truncate font-mono">
              {formatLatLngDecimal(photo.lat, photo.lng)}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
