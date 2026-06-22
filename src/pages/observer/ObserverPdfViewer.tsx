import React, { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, X } from "lucide-react";
import { viewPdfUrl, openExternalUrl, canOpenPdfExternally, type PdfActionStatus } from "./observer-share";
import { ObserverPdfCanvas } from "./ObserverPdfCanvas";

export function ObserverPdfViewer({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [status, setStatus] = useState<PdfActionStatus>("loading");
  const [message, setMessage] = useState("Loading PDF…");

  useEffect(() => {
    let active = true;

    viewPdfUrl(url, (nextStatus, nextMessage) => {
      if (!active) return;
      setStatus(nextStatus);
      if (nextMessage) setMessage(nextMessage);
    }).then((resolved) => {
      if (!active) return;
      if (resolved) setPdfData(resolved);
    });

    return () => {
      active = false;
    };
  }, [url]);

  const showExternal = canOpenPdfExternally(url);

  const openExternal = () => {
    void openExternalUrl(url);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/95 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-2 px-3 py-2.5 safe-area-top bg-[#0C1E4A] shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-white/90 hover:bg-white/10 cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <p className="text-sm font-bold text-white truncate flex-1">{title}</p>
        {showExternal && (
          <button
            type="button"
            onClick={openExternal}
            className="p-2 rounded-xl text-white/70 hover:bg-white/10 cursor-pointer shrink-0"
            aria-label="Open in browser"
            title="Open in browser"
          >
            <ExternalLink size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-white/70 hover:bg-white/10 cursor-pointer shrink-0"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 min-h-0 bg-slate-800 relative">
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 size={28} className="animate-spin text-[#ff791a]" />
            <p className="text-sm font-semibold">{message}</p>
          </div>
        )}
        {pdfData && <ObserverPdfCanvas data={pdfData} />}
        {status === "error" && !pdfData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm font-semibold text-white/80">{message}</p>
            {showExternal && (
              <button
                type="button"
                onClick={openExternal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff791a] text-white text-sm font-bold cursor-pointer"
              >
                <ExternalLink size={16} />
                Open in browser
              </button>
            )}
          </div>
        )}
        {status === "ready" && !pdfData && message !== "Loading PDF…" && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="text-sm font-semibold text-white/80">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
