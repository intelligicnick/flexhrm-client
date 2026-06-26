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
const RENDER_BUFFER_PX = 400;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

function touchDistance(touches: TouchList | React.TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function PdfPage({
  pdf,
  pageNum,
  zoom,
  containerWidth,
  onHeight,
}: {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  zoom: number;
  containerWidth: number;
  onHeight: (pageNum: number, height: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: `${RENDER_BUFFER_PX}px 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!visible || rendered) return undefined;

    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    async function renderPage() {
      try {
        const pdfPage = await pdf.getPage(pageNum);
        if (cancelled) return;

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const fitScale = containerWidth / baseViewport.width;
        const viewport = pdfPage.getViewport({ scale: fitScale * zoom });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        onHeight(pageNum, viewport.height);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setRendered(true);
      } catch {
        if (!cancelled) setRendered(false);
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
    };
  }, [visible, rendered, pdf, pageNum, zoom, containerWidth, onHeight]);

  return (
    <div ref={wrapRef} className="bg-white shadow-md rounded-sm overflow-hidden min-h-[120px]">
      {!rendered && (
        <div className="flex items-center justify-center h-[120px] bg-slate-100">
          <Loader2 size={18} className="animate-spin text-[#ff791a]" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`block max-w-none h-auto w-full ${rendered ? "" : "hidden"}`}
      />
      <p className="text-[10px] font-semibold text-slate-400 px-2 py-1 border-t border-slate-100">
        Page {pageNum}
      </p>
    </div>
  );
}

export function ObserverPdfCanvas({ data }: { data: ArrayBuffer }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  const [pageCount, setPageCount] = useState(0);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(360);

  const changeZoom = useCallback((next: number | ((current: number) => number)) => {
    setZoom((current) => clampZoom(typeof next === "function" ? next(current) : next));
  }, []);

  const handlePageHeight = useCallback((_pageNum: number, _height: number) => {
    // placeholder for future virtual scroll height tracking
  }, []);

  useEffect(() => {
    let cancelled = false;
    pdfRef.current = null;
    setPdf(null);
    setPageCount(0);
    setZoom(1);
    setLoading(true);
    setError(null);

    pdfjsLib
      .getDocument({ data: data.slice(0) })
      .promise.then((pdf) => {
        if (cancelled) return;
        pdfRef.current = pdf;
        setPdf(pdf);
        setPageCount(pdf.numPages);
        setLoading(false);
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
      setPdf(null);
    };
  }, [data]);

  useEffect(() => {
    const el = wrapRef.current || scrollRef.current;
    if (!el) return undefined;

    const updateWidth = () => {
      setContainerWidth(Math.max(el.clientWidth - 16, 280));
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageCount]);

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

          {pdf && pageCount > 0 && (
            <div className="mx-auto flex flex-col gap-3 w-full max-w-full">
              {Array.from({ length: pageCount }, (_, index) => (
                <PdfPage
                  key={`${index}-${zoom}-${containerWidth}`}
                  pdf={pdf}
                  pageNum={index + 1}
                  zoom={zoom}
                  containerWidth={containerWidth}
                  onHeight={handlePageHeight}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
