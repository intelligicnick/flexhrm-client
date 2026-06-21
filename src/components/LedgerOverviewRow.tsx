import React, { useState } from "react";
import { Employee } from "../types";
import {
  formatEntryDate,
  getTotalByType,
  LEDGER_TYPE_LABELS,
  LedgerItemType,
  MonthLedger,
} from "../lib/ledger-helpers";
import { LEDGER_CELL_COLORS, LEDGER_OVERVIEW_TYPES } from "./LedgerOverviewCell";

type Props = {
  emp: Employee;
  monthLedger: MonthLedger;
  canEdit: boolean;
  onDeleteItem: (itemId: string) => void | Promise<void>;
  onClearType: (type: LedgerItemType) => void | Promise<void>;
};

function TotalCell({ total, colorClass }: { total: number; colorClass: string }) {
  if (total <= 0) {
    return <span className="text-slate-350 font-mono">-</span>;
  }
  return (
    <span className={`font-extrabold ${colorClass} text-[11px]`}>
      ₹{total.toLocaleString("en-IN")}
    </span>
  );
}

export function LedgerOverviewRow({
  emp,
  monthLedger,
  canEdit,
  onDeleteItem,
  onClearType,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const itemNotes = monthLedger.ledgerItems.map((item) => item.note.trim()).filter(Boolean);
  const reason = itemNotes.length > 0 ? itemNotes.join(" · ") : monthLedger.penaltyReason;
  const entryCount = monthLedger.ledgerItems.length;
  const typesWithEntries = LEDGER_OVERVIEW_TYPES.filter(
    (type) => getTotalByType(monthLedger, type) > 0,
  );

  return (
    <div className="border-b border-slate-100 last:border-b-0 bg-orange-50/15 hover:bg-orange-50/25 transition">
      <div className="px-4 py-2.5 grid grid-cols-10 items-center gap-1 text-xs text-left">
        <div className="col-span-2 pr-2 space-y-1">
          <p className="font-bold text-slate-800 truncate">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</p>
          <p className="font-mono text-[9px] text-slate-450">{emp.employeeCode} • {emp.location || "Unassigned"}</p>
          {entryCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[9px] font-bold text-orange-600 hover:text-orange-700 cursor-pointer flex items-center gap-0.5"
            >
              {expanded ? "Hide" : "View"} {entryCount} entr{entryCount === 1 ? "y" : "ies"}
              <span className={`inline-block transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
            </button>
          )}
        </div>

        {LEDGER_OVERVIEW_TYPES.map((type) => (
          <div key={type}>
            <TotalCell total={getTotalByType(monthLedger, type)} colorClass={LEDGER_CELL_COLORS[type]} />
          </div>
        ))}

        <div className="col-span-2 text-center pr-2" title={reason || "No remarks"}>
          {reason ? (
            <span className="text-slate-700 font-semibold text-[11px] block truncate">{reason}</span>
          ) : (
            <span className="text-slate-300 font-normal italic text-[11px]">None recorded</span>
          )}
        </div>
      </div>

      {expanded && entryCount > 0 && (
        <div className="px-4 pb-3">
          <div className="ml-0 sm:ml-2 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="grid grid-cols-[minmax(4rem,1fr)_minmax(4.5rem,1fr)_minmax(4rem,1fr)_1fr_auto] gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-wider">
              <span>Date</span>
              <span>Type</span>
              <span>Amount</span>
              <span>Note</span>
              <span className="text-right w-14">{canEdit ? "Action" : ""}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {monthLedger.ledgerItems.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[minmax(4rem,1fr)_minmax(4.5rem,1fr)_minmax(4rem,1fr)_1fr_auto] gap-2 px-3 py-2 items-center text-[10px]"
                >
                  <span className="font-bold text-slate-600">{formatEntryDate(item.entryDate)}</span>
                  <span className="font-semibold text-slate-700">{LEDGER_TYPE_LABELS[item.type]}</span>
                  <span className={`font-extrabold ${LEDGER_CELL_COLORS[item.type]}`}>
                    ₹{item.amount.toLocaleString("en-IN")}
                  </span>
                  <span className="text-slate-500 truncate" title={item.note || undefined}>
                    {item.note || "—"}
                  </span>
                  <span className="text-right w-14">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="text-[9px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-wider cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {canEdit && typesWithEntries.length > 0 && (
              <div className="px-3 py-2 bg-slate-50/80 border-t border-slate-100 flex flex-wrap gap-2">
                {typesWithEntries.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onClearType(type)}
                    className="text-[9px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-wider cursor-pointer"
                  >
                    Clear all {LEDGER_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function filterEmployeesWithLedgerEntries(
  employees: Employee[],
  selectedMonth: string,
  getMonthLedger: (emp: Employee, monthKey: string) => MonthLedger,
) {
  return employees.filter((emp) => {
    const ledger = getMonthLedger(emp, selectedMonth);
    const itemNotes = ledger.ledgerItems.map((item) => item.note.trim()).filter(Boolean);
    const reason = itemNotes.length > 0 ? itemNotes.join(" · ") : ledger.penaltyReason;
    return (
      ledger.ledgerItems.length > 0 ||
      ledger.advance > 0 ||
      ledger.uniform > 0 ||
      ledger.penalty > 0 ||
      ledger.foodPerk > 0 ||
      ledger.accommodationPerk > 0 ||
      ledger.conveyancePerk > 0 ||
      !!reason
    );
  });
}
