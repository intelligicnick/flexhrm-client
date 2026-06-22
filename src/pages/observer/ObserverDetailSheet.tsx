import React from "react";
import { X } from "lucide-react";
import type { DetailField } from "./observer-details";

export function ObserverDetailSheet({
  title,
  fields,
  onClose,
}: {
  title: string;
  fields: DetailField[];
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{field.label}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5 whitespace-pre-wrap break-words">
                {field.value || "—"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
