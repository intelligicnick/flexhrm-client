import React, { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, Printer, Share2, X } from "lucide-react";
import { registerObserverBackHandler } from "../../lib/observer-back-handler";
import { printPdfViaNative, canUseObserverNativePdf } from "../../lib/observer-native-bridge";
import {
  viewPdfUrl,
  openExternalUrl,
  canOpenPdfExternally,
  sharePdfUrl,
  resolvePdfFetchUrl,
  type PdfActionStatus,
} from "./observer-share";
import { ObserverPdfCanvas } from "./ObserverPdfCanvas";

function sanitizeFilename(title: string): string {
  const base = title.trim().replace(/[^\w.-]+/g, "_").replace(/_+/g, "_") || "document";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

async function printPdfWeb(data: ArrayBuffer, _title: string): Promise<void> {
  const blob = new Blob([data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60_000);
  };
}

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
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    return registerObserverBackHandler(() => {
      onClose();
      return true;
    });
  }, [onClose]);

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

  const handleShare = async () => {
    setActionBusy(true);
    await sharePdfUrl(url, title, (nextStatus, nextMessage) => {
      if (nextMessage) setMessage(nextMessage);
      if (nextStatus !== "loading") setActionBusy(false);
    });
  };

  const handlePrint = async () => {
    setActionBusy(true);
    setMessage("Preparing print…");
    try {
      if (canUseObserverNativePdf()) {
        await printPdfViaNative(resolvePdfFetchUrl(url), sanitizeFilename(title));
        setMessage("Print dialog opened.");
        return;
      }

      if (pdfData) {
        await printPdfWeb(pdfData, title);
        setMessage("Print dialog opened.");
      } else {
        setMessage("Load the PDF first to print.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not print PDF.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/95 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-1 px-2 py-2.5 safe-area-top bg-[#0C1E4A] shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-white/90 hover:bg-white/10 cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <p className="text-sm font-bold text-white truncate flex-1 min-w-0">{title}</p>
        <button
          type="button"
          disabled={actionBusy || status === "loading"}
          onClick={() => void handleShare()}
          className="p-2 rounded-xl text-white/70 hover:bg-white/10 cursor-pointer shrink-0 disabled:opacity-50"
          aria-label="Share PDF"
          title="Share"
        >
          <Share2 size={18} />
        </button>
        <button
          type="button"
          disabled={actionBusy || status === "loading"}
          onClick={() => void handlePrint()}
          className="p-2 rounded-xl text-white/70 hover:bg-white/10 cursor-pointer shrink-0 disabled:opacity-50"
          aria-label="Print PDF"
          title="Print"
        >
          <Printer size={18} />
        </button>
        {showExternal && (
          <button
            type="button"
            onClick={() => void openExternalUrl(url)}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80 z-10">
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
                onClick={() => void openExternalUrl(url)}
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
