import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, Minus, Plus, RotateCcw } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

function touchDistance(touches: TouchList | React.TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export function ObserverPdfCanvas({ data }: { data: ArrayBuffer }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const changeZoom = useCallback((next: number | ((current: number) => number)) => {
    setZoom((current) => clampZoom(typeof next === "function" ? next(current) : next));
  }, []);

  useEffect(() => {
    let cancelled = false;
    pdfRef.current = null;
    setPageCount(0);
    setZoom(1);
    setLoading(true);
    setError(null);

    pdfjsLib
      .getDocument({ data: data.slice(0) })
      .promise.then((pdf) => {
        if (cancelled) return;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        canvasRefs.current = Array.from({ length: pdf.numPages }, () => null);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not render PDF in app.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [data]);

  useLayoutEffect(() => {
    if (pageCount === 0) return;

    let cancelled = false;

    async function renderAllPages() {
      setLoading(true);
      setError(null);

      const pdf = pdfRef.current;
      if (!pdf) return;

      try {
        const containerWidth = Math.max(wrapRef.current?.clientWidth || scrollRef.current?.clientWidth || 360, 280);

        for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
          if (cancelled) return;

          const canvas = canvasRefs.current[pageNum - 1];
          if (!canvas) continue;

          const pdfPage = await pdf.getPage(pageNum);
          if (cancelled) return;

          const baseViewport = pdfPage.getViewport({ scale: 1 });
          const fitScale = containerWidth / baseViewport.width;
          const viewport = pdfPage.getViewport({ scale: fitScale * zoom });

          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Unable to render PDF page.");

          await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        }

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Could not render PDF in app.");
          setLoading(false);
        }
      }
    }

    void renderAllPages();

    return () => {
      cancelled = true;
    };
  }, [pageCount, zoom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        pinchStart.current = {
          distance: touchDistance(event.touches),
          zoom,
        };
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchStart.current) return;
      event.preventDefault();
      const distance = touchDistance(event.touches);
      const ratio = distance / pinchStart.current.distance;
      changeZoom(pinchStart.current.zoom * ratio);
    };

    const onTouchEnd = () => {
      pinchStart.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [changeZoom, zoom]);

  const zoomLabel = `${Math.round(zoom * 100)}%`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/90 shrink-0 border-b border-white/10">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={loading || zoom <= MIN_ZOOM}
            onClick={() => changeZoom((current) => current - ZOOM_STEP)}
            className="p-2 rounded-lg bg-white/10 text-white disabled:opacity-40 cursor-pointer"
            aria-label="Zoom out"
          >
            <Minus size={16} />
          </button>
          <span className="min-w-[3.25rem] text-center text-xs font-bold text-white/90">{zoomLabel}</span>
          <button
            type="button"
            disabled={loading || zoom >= MAX_ZOOM}
            onClick={() => changeZoom((current) => current + ZOOM_STEP)}
            className="p-2 rounded-lg bg-white/10 text-white disabled:opacity-40 cursor-pointer"
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            disabled={loading || zoom === 1}
            onClick={() => changeZoom(1)}
            className="p-2 rounded-lg bg-white/10 text-white disabled:opacity-40 cursor-pointer"
            aria-label="Reset zoom"
            title="Fit to width"
          >
            <RotateCcw size={15} />
          </button>
        </div>
        {pageCount > 0 && (
          <p className="text-[10px] font-bold text-white/60 shrink-0">
            {pageCount} page{pageCount === 1 ? "" : "s"} · scroll to read
          </p>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto overscroll-contain touch-pan-y bg-slate-800"
      >
        <div ref={wrapRef} className="relative px-2 py-3 min-h-full">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 size={24} className="animate-spin text-[#ff791a]" />
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center z-10">
              <p className="text-sm font-semibold text-white/80">{error}</p>
            </div>
          )}

          <div className={`mx-auto flex flex-col gap-3 w-fit ${loading ? "opacity-0" : "opacity-100"}`}>
            {Array.from({ length: pageCount }, (_, index) => (
              <div key={index} className="bg-white shadow-md rounded-sm overflow-hidden">
                <canvas
                  ref={(node) => {
                    canvasRefs.current[index] = node;
                  }}
                  className="block max-w-none h-auto"
                />
                {pageCount > 1 && (
                  <p className="text-[10px] font-semibold text-slate-400 px-2 py-1 border-t border-slate-100">
                    Page {index + 1}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
