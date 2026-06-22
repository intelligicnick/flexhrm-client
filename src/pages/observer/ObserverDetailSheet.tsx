import React from "react";
import { X, ExternalLink, Share2, FileText } from "lucide-react";
import type { DetailField, ObserverDocumentLink } from "./observer-details";
import { openExternalUrl, shareUrl } from "./observer-share";

const toneClasses: Record<NonNullable<DetailField["tone"]>, string> = {
  green: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-red-700",
  blue: "text-blue-700",
  slate: "text-slate-700",
};

function FieldValue({ field }: { field: DetailField }) {
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
    return (
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openExternalUrl(field.href!)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0C1E4A] text-white text-xs font-bold cursor-pointer"
        >
          <ExternalLink size={14} />
          {field.value || "View"}
        </button>
        {field.shareUrl && (
          <button
            type="button"
            onClick={() => shareUrl(field.shareUrl!, field.shareTitle || field.label)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold cursor-pointer"
          >
            <Share2 size={14} />
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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label="Close details"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col safe-area-bottom animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-black text-slate-800 truncate pr-2">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 space-y-2.5">
          {fields.map((field) => (
            <div key={field.label} className="border-b border-slate-50 pb-2 last:border-0">
              {!field.hideLabel && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{field.label}</p>
              )}
              <FieldValue field={field} />
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
                      onClick={() => openExternalUrl(doc.url)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0C1E4A] text-white text-[10px] font-bold cursor-pointer shrink-0"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => shareUrl(doc.url, doc.label)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 cursor-pointer shrink-0"
                      title="Share"
                    >
                      <Share2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
