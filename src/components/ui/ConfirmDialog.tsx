import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";

export type ConfirmDialogVariant = "danger" | "warning" | "default";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles: Record<
  ConfirmDialogVariant,
  { header: string; icon: React.ReactNode; confirm: string }
> = {
  danger: {
    header: "border-rose-100 bg-rose-50",
    icon: <Trash2 size={18} className="shrink-0 text-rose-600" />,
    confirm: "bg-rose-600 hover:bg-rose-700 text-white",
  },
  warning: {
    header: "border-amber-100 bg-amber-50",
    icon: <AlertTriangle size={18} className="shrink-0 text-amber-600" />,
    confirm: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  default: {
    header: "border-slate-100 bg-slate-50",
    icon: <AlertTriangle size={18} className="shrink-0 text-slate-600" />,
    confirm: "bg-[#ff791a] hover:bg-[#e66a15] text-white",
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const styles = variantStyles[variant];

  useEffect(() => {
    if (!open) return;
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
        aria-labelledby="confirm-dialog-title"
      >
        <div
          className={`flex items-center justify-between gap-3 rounded-t-2xl border-b px-5 py-4 ${styles.header}`}
        >
          <div className="flex items-center gap-2">
            {styles.icon}
            <h3 id="confirm-dialog-title" className="text-sm font-extrabold text-slate-900">
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
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${styles.confirm}`}
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
