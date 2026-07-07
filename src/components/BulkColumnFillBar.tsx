import React, { useState } from "react";
import { MousePointerClick } from "lucide-react";

interface BulkColumnFillBarProps {
  selectedRowCount: number;
  columnLabel: string;
  inputType?: "text" | "select";
  selectOptions?: string[];
  onApply: (value: string) => void;
  onClear: () => void;
}

export default function BulkColumnFillBar({
  selectedRowCount,
  columnLabel,
  inputType = "text",
  selectOptions = [],
  onApply,
  onClear,
}: BulkColumnFillBarProps) {
  const [fillValue, setFillValue] = useState("");

  if (selectedRowCount <= 1) return null;

  return (
    <div className="px-5 py-2 border-b border-blue-200 bg-blue-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2 text-xs text-blue-900">
        <MousePointerClick size={14} />
        <span>
          <strong>{selectedRowCount}</strong> row{selectedRowCount !== 1 ? "s" : ""} selected in{" "}
          <strong>{columnLabel}</strong>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-semibold text-blue-900 whitespace-nowrap">
          Fill all selected:
        </label>
        {inputType === "select" ? (
          <select
            value={fillValue}
            onChange={(e) => setFillValue(e.target.value)}
            className="text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-white min-w-[120px]"
          >
            <option value="">Choose…</option>
            {selectOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={fillValue}
            onChange={(e) => setFillValue(e.target.value)}
            className="text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-white min-w-[160px]"
            placeholder="Value for all selected rows"
          />
        )}
        <button
          type="button"
          onClick={() => {
            onApply(fillValue);
            setFillValue("");
          }}
          className="px-2.5 py-1.5 text-[11px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onClear}
          className="px-2.5 py-1.5 text-[11px] font-bold border border-blue-200 text-blue-800 rounded-lg hover:bg-blue-100"
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}
