import React, { useState } from "react";
import { ArrowLeft, ExternalLink, Share2, FileText, Loader2 } from "lucide-react";
import type { DetailField, ObserverDocumentLink } from "./observer-details";
import { sharePdfUrl, type PdfActionStatus } from "./observer-share";
import { ObserverPdfViewer } from "./ObserverPdfViewer";

const toneClasses: Record<NonNullable<DetailField["tone"]>, string> = {
  green: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-red-700",
  blue: "text-blue-700",
  slate: "text-slate-700",
};

type PdfAction = { url: string; title: string; mode: "view" | "share" } | null;

function FieldValue({
  field,
  onPdfAction,
  pdfBusy,
}: {
  field: DetailField;
  onPdfAction: (action: PdfAction) => void;
  pdfBusy: boolean;
}) {
  if (field.imageSrc) {
    return (
      <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
        <img
          src={field.imageSrc}
          alt={field.label}
          className="w-full max-h-64 object-contain bg-black/5"
        />
        {field.value && field.value !== "—" && (
          <p className="text-[10px] font-semibold text-slate-500 px-2 py-1.5 border-t border-slate-100">
            {field.value}
          </p>
        )}
      </div>
    );
  }

  if (field.href) {
    const shareTarget = field.shareUrl || field.href;
    const shareTitle = field.shareTitle || field.label;
    return (
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pdfBusy}
          onClick={() => onPdfAction({ url: field.href!, title: shareTitle, mode: "view" })}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0C1E4A] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
        >
          {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
          {field.value || "View"}
        </button>
        {shareTarget && (
          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => onPdfAction({ url: shareTarget, title: shareTitle, mode: "share" })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            Share PDF
          </button>
        )}
      </div>
    );
  }

  return (
    <p
      className={`text-sm font-semibold mt-0.5 whitespace-pre-wrap break-words ${
        field.tone ? toneClasses[field.tone] : "text-slate-800"
      } ${field.hideLabel ? "text-emerald-700 text-lg font-black" : ""}`}
    >
      {field.value || "—"}
    </p>
  );
}

export function ObserverDetailSheet({
  title,
  fields,
  documents,
  onClose,
}: {
  title: string;
  fields: DetailField[];
  documents?: ObserverDocumentLink[];
  onClose: () => void;
}) {
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handlePdfAction = async (action: PdfAction) => {
    if (!action) return;
    setStatusMessage(null);

    if (action.mode === "view") {
      setPdfViewer({ url: action.url, title: action.title });
      return;
    }

    setPdfBusy(true);
    await sharePdfUrl(action.url, action.title, (status: PdfActionStatus, message?: string) => {
      if (status === "loading") setStatusMessage(message || "Preparing PDF…");
      if (status === "ready" && message) setStatusMessage(message);
      if (status === "error" && message) setStatusMessage(message);
      if (status !== "loading") {
        setPdfBusy(false);
      }
    });
  };

  const handleDocumentView = (doc: ObserverDocumentLink) => {
    setPdfViewer({ url: doc.url, title: doc.label });
  };

  const handleDocumentShare = async (doc: ObserverDocumentLink) => {
    setPdfBusy(true);
    await sharePdfUrl(doc.url, doc.label, (status, message) => {
      if (status === "loading") setStatusMessage(message || "Preparing PDF…");
      if (status === "ready" && message) setStatusMessage(message);
      if (status === "error" && message) setStatusMessage(message);
      if (status !== "loading") setPdfBusy(false);
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
          aria-label="Close details"
          onClick={onClose}
        />
        <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col safe-area-bottom animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <h3 className="text-sm font-black text-slate-800 truncate flex-1">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer shrink-0"
              aria-label="Close"
            >
              <span className="sr-only">Close</span>
              ✕
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-3 space-y-2.5">
            {statusMessage && (
              <p className="text-xs font-semibold text-[#ff791a] bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                {statusMessage}
              </p>
            )}
            {fields.map((field) => (
              <div key={field.label} className="border-b border-slate-50 pb-2 last:border-0">
                {!field.hideLabel && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{field.label}</p>
                )}
                <FieldValue field={field} onPdfAction={handlePdfAction} pdfBusy={pdfBusy} />
              </div>
            ))}

            {documents && documents.length > 0 && (
              <div className="border-t border-slate-100 pt-3 mt-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Documents</p>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-100 bg-slate-50"
                    >
                      <FileText size={16} className="text-[#ff791a] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{doc.label}</p>
                      </div>
                      <button
                        type="button"
                        disabled={pdfBusy}
                        onClick={() => handleDocumentView(doc)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#0C1E4A] text-white text-[10px] font-bold cursor-pointer shrink-0 disabled:opacity-60"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        disabled={pdfBusy}
                        onClick={() => handleDocumentShare(doc)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 cursor-pointer shrink-0 disabled:opacity-60"
                        title="Share PDF"
                      >
                        {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {pdfViewer && (
        <ObserverPdfViewer
          url={pdfViewer.url}
          title={pdfViewer.title}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </>
  );
}
