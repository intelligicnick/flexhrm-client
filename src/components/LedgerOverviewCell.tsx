import React from "react";
import { LedgerItem, LedgerItemType, formatEntryDate } from "../lib/ledger-helpers";

type Props = {
  items: LedgerItem[];
  total: number;
  colorClass: string;
  canEdit: boolean;
  onDelete?: (itemId: string) => void;
  onClearAll?: () => void;
};

export function LedgerOverviewCell({ items, total, colorClass, canEdit, onDelete, onClearAll }: Props) {
  if (items.length === 0) {
    return <span className="text-slate-350 font-mono">-</span>;
  }

  return (
    <div className="space-y-1">
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-1 text-[10px] leading-tight">
            <span className={`font-semibold ${colorClass} whitespace-nowrap`}>
              {formatEntryDate(item.entryDate)} · ₹{item.amount.toLocaleString("en-IN")}
            </span>
            {canEdit && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="text-slate-400 hover:text-red-500 font-bold shrink-0 cursor-pointer"
                title="Remove entry"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className={`text-[11px] font-extrabold ${colorClass} border-t border-slate-100 pt-0.5`}>
        Total ₹{total.toLocaleString("en-IN")}
      </p>
      {canEdit && onClearAll && total > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[9px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-wider cursor-pointer"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

export const LEDGER_OVERVIEW_TYPES: LedgerItemType[] = [
  "advance",
  "uniform",
  "penalty",
  "foodPerk",
  "accommodationPerk",
  "conveyancePerk",
];

export const LEDGER_CELL_COLORS: Record<LedgerItemType, string> = {
  advance: "text-blue-700",
  uniform: "text-rose-600",
  penalty: "text-rose-600",
  foodPerk: "text-indigo-700",
  accommodationPerk: "text-indigo-700",
  conveyancePerk: "text-indigo-700",
};
