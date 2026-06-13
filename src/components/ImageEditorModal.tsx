import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Crop, Loader2, RotateCcw, SlidersHorizontal, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  clampDisplayRect,
  cropImageDataUrl,
  displayRectToNatural,
  FULL_CROP_REGION,
  naturalToDisplayRect,
  type CropRegion,
  type DisplayRect,
} from "../lib/image-crop";
import {
  compressImageDataUrl,
  compressionPercent,
  formatFileSize,
  qualityFromPercent,
  savingsPercent,
} from "../lib/image-compress";

export interface ImageEditorResult {
  dataUrl: string;
  mimeType: string;
  compressedSizeBytes: number;
  quality: number;
}

interface ImageEditorModalProps {
  title: string;
  sourceDataUrl: string;
  originalSizeBytes: number;
  initialQualityPercent?: number;
  confirmLabel?: string;
  onClose: () => void;
  onSave: (result: ImageEditorResult) => void | Promise<void>;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | "draw" | null;

function getDisplayedImageSize(
  naturalW: number,
  naturalH: number,
  containerW: number,
  containerH: number,
): { width: number; height: number; offsetX: number; offsetY: number } {
  const scale = Math.min(containerW / naturalW, containerH / naturalH, 1);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    width,
    height,
    offsetX: (containerW - width) / 2,
    offsetY: (containerH - height) / 2,
  };
}

export default function ImageEditorModal({
  title,
  sourceDataUrl,
  originalSizeBytes,
  initialQualityPercent = 60,
  confirmLabel = "Apply",
  onClose,
  onSave,
}: ImageEditorModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [workingSource, setWorkingSource] = useState(sourceDataUrl);
  const [qualityPercent, setQualityPercent] = useState(initialQualityPercent);
  const [previewUrl, setPreviewUrl] = useState(sourceDataUrl);
  const [compressedSizeBytes, setCompressedSizeBytes] = useState(originalSizeBytes);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [cropRegion, setCropRegion] = useState<CropRegion>(FULL_CROP_REGION);
  const [displayRect, setDisplayRect] = useState<DisplayRect | null>(null);
  const [imageNatural, setImageNatural] = useState({ w: 0, h: 0 });
  const [displayLayout, setDisplayLayout] = useState({ w: 0, h: 0, offsetX: 0, offsetY: 0 });
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startRect: DisplayRect;
  } | null>(null);

  const recompress = useCallback(
    async (dataUrl: string, percent: number) => {
      setIsProcessing(true);
      try {
        const quality = qualityFromPercent(percent);
        const result = await compressImageDataUrl(dataUrl, quality, 1600, 1600, originalSizeBytes);
        setPreviewUrl(result.dataUrl);
        setCompressedSizeBytes(result.compressedSizeBytes);
      } finally {
        setIsProcessing(false);
      }
    },
    [originalSizeBytes],
  );

  useEffect(() => {
    void recompress(workingSource, qualityPercent);
  }, [workingSource, qualityPercent, recompress]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = workingSource;
  }, [workingSource]);

  useEffect(() => {
    const updateLayout = () => {
      const el = containerRef.current;
      if (!el || imageNatural.w === 0) return;
      const rect = el.getBoundingClientRect();
      const layout = getDisplayedImageSize(imageNatural.w, imageNatural.h, rect.width, rect.height);
      setDisplayLayout({
        w: layout.width,
        h: layout.height,
        offsetX: layout.offsetX,
        offsetY: layout.offsetY,
      });
      setDisplayRect(naturalToDisplayRect(cropRegion, layout.width, layout.height));
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [imageNatural, cropRegion, cropMode]);

  const handleQualityChange = (percent: number) => {
    setQualityPercent(percent);
  };

  const pointerToImageCoords = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: clientX - rect.left - displayLayout.offsetX,
      y: clientY - rect.top - displayLayout.offsetY,
    };
  };

  const onPointerDown = (e: React.PointerEvent, mode: DragMode) => {
    if (!cropMode || !displayRect) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...displayRect },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !displayRect) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const { w, h } = displayLayout;
    let next = { ...drag.startRect };

    if (drag.mode === "move") {
      next.x += dx;
      next.y += dy;
    } else if (drag.mode === "draw") {
      const start = pointerToImageCoords(drag.startX, drag.startY);
      const current = pointerToImageCoords(e.clientX, e.clientY);
      next = {
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      };
    } else {
      if (drag.mode.includes("n")) {
        next.y = drag.startRect.y + dy;
        next.height = drag.startRect.height - dy;
      }
      if (drag.mode.includes("s")) {
        next.height = drag.startRect.height + dy;
      }
      if (drag.mode.includes("w")) {
        next.x = drag.startRect.x + dx;
        next.width = drag.startRect.width - dx;
      }
      if (drag.mode.includes("e")) {
        next.width = drag.startRect.width + dx;
      }
    }

    const clamped = clampDisplayRect(next, w, h);
    setDisplayRect(clamped);
    setCropRegion(displayRectToNatural(clamped, w, h, imageNatural.w, imageNatural.h));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const applyCrop = async () => {
    setIsProcessing(true);
    try {
      const cropped = await cropImageDataUrl(workingSource, cropRegion);
      setWorkingSource(cropped);
      setCropRegion(FULL_CROP_REGION);
      setCropMode(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCrop = () => {
    setCropRegion(FULL_CROP_REGION);
    if (displayLayout.w > 0) {
      setDisplayRect(naturalToDisplayRect(FULL_CROP_REGION, displayLayout.w, displayLayout.h));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        dataUrl: previewUrl,
        mimeType: "image/jpeg",
        compressedSizeBytes,
        quality: qualityFromPercent(qualityPercent),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" aria-hidden />
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-500">
              Adjust quality to save space or improve readability. Crop to remove extra background.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCropMode((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${
                  cropMode
                    ? "border-[#ff791a] bg-orange-50 text-[#ff791a]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-orange-200"
                }`}
              >
                <Crop size={14} />
                {cropMode ? "Cropping on" : "Crop image"}
              </button>
              {cropMode && (
                <>
                  <button
                    type="button"
                    onClick={() => void applyCrop()}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check size={14} />
                    Apply crop
                  </button>
                  <button
                    type="button"
                    onClick={resetCrop}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <RotateCcw size={14} />
                    Reset selection
                  </button>
                </>
              )}
            </div>

            <div
              ref={containerRef}
              className="relative h-72 overflow-hidden rounded-xl border border-slate-200 bg-slate-900/95 sm:h-80"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {isProcessing ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-300">
                  <Loader2 size={20} className="mr-2 animate-spin" />
                  Processing...
                </div>
              ) : (
                <>
                  <img
                    src={cropMode ? workingSource : previewUrl}
                    alt="Edit preview"
                    className="absolute max-h-full max-w-full object-contain"
                    style={{
                      width: displayLayout.w || "auto",
                      height: displayLayout.h || "auto",
                      left: displayLayout.offsetX,
                      top: displayLayout.offsetY,
                    }}
                    draggable={false}
                  />
                  {cropMode && displayRect && (
                    <>
                      <div
                        className="absolute inset-0 cursor-crosshair"
                        style={{
                          left: displayLayout.offsetX,
                          top: displayLayout.offsetY,
                          width: displayLayout.w,
                          height: displayLayout.h,
                        }}
                        onPointerDown={(e) => onPointerDown(e, "draw")}
                      />
                      <div
                        className="absolute border-2 border-[#ff791a] bg-[#ff791a]/10"
                        style={{
                          left: displayLayout.offsetX + displayRect.x,
                          top: displayLayout.offsetY + displayRect.y,
                          width: displayRect.width,
                          height: displayRect.height,
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onPointerDown(e, "move");
                        }}
                      >
                        {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                          <div
                            key={corner}
                            className="absolute h-3 w-3 rounded-full border-2 border-white bg-[#ff791a]"
                            style={{
                              top: corner.includes("n") ? -6 : undefined,
                              bottom: corner.includes("s") ? -6 : undefined,
                              left: corner.includes("w") ? -6 : undefined,
                              right: corner.includes("e") ? -6 : undefined,
                              cursor: `${corner}-resize`,
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              onPointerDown(e, corner);
                            }}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            {cropMode && (
              <p className="mt-2 text-[10px] text-slate-500">
                Drag on the image to draw a new crop area, or drag the orange box to reposition. Use corner handles to resize.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <SlidersHorizontal size={12} />
                  Image quality
                </label>
                <span className="text-xs font-bold text-[#ff791a]">{qualityPercent}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={qualityPercent}
                onChange={(e) => handleQualityChange(Number(e.target.value))}
                className="mt-2 w-full accent-[#ff791a]"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <ZoomOut size={12} />
                  Smaller file
                </span>
                <span className="inline-flex items-center gap-1">
                  Sharper view
                  <ZoomIn size={12} />
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs text-slate-600">
              <p>
                Original: <strong>{formatFileSize(originalSizeBytes)}</strong>
              </p>
              <p className="mt-1">
                Stored:{" "}
                <strong className="text-emerald-700">{formatFileSize(compressedSizeBytes)}</strong>
                {originalSizeBytes > 0 && compressedSizeBytes < originalSizeBytes && (
                  <span className="ml-1 text-emerald-600">
                    ({savingsPercent(originalSizeBytes, compressedSizeBytes)}% smaller)
                  </span>
                )}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Quality setting: {compressionPercent(qualityFromPercent(qualityPercent))}%
              </p>
            </div>

            <div className="mt-auto flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || isProcessing}
                className="flex-1 rounded-lg bg-[#ff791a] px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
