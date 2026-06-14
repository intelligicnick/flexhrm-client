import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";

export interface TypeToConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  requiredConfirmText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function TypeToConfirmDialog({
  open,
  title,
  message,
  requiredConfirmText = "DELETE",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isLoading = false,
  onConfirm,
  onCancel,
}: TypeToConfirmDialogProps) {
  const [typedText, setTypedText] = useState("");
  const isConfirmed = typedText === requiredConfirmText;

  useEffect(() => {
    if (!open) {
      setTypedText("");
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={() => !isLoading && onCancel()}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md animate-fade-in rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="type-confirm-dialog-title"
      >
        <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-rose-100 bg-rose-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <Trash2 size={18} className="shrink-0 text-rose-600" />
            <h3 id="type-confirm-dialog-title" className="text-sm font-extrabold text-slate-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-slate-600">{message}</p>

          <div>
            <label htmlFor="type-confirm-input" className="mb-1.5 block text-xs font-bold text-slate-600">
              Type{" "}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-rose-700">
                {requiredConfirmText}
              </span>{" "}
              to confirm
            </label>
            <input
              id="type-confirm-input"
              type="text"
              autoComplete="off"
              autoFocus
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={requiredConfirmText}
              disabled={isLoading}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 transition focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400/30 disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading || !isConfirmed}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {isLoading ? "Please wait..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
