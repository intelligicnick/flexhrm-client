import React from "react";
import { Employee } from "../types";
import {
  getTotalByType,
  MonthLedger,
} from "../lib/ledger-helpers";
import { LEDGER_CELL_COLORS, LEDGER_OVERVIEW_TYPES } from "./LedgerOverviewCell";

type Props = {
  emp: Employee;
  monthLedger: MonthLedger;
};

function getUniqueLedgerNotes(monthLedger: MonthLedger): string[] {
  return Array.from(
    new Set(monthLedger.ledgerItems.map((item) => item.note.trim()).filter(Boolean)),
  );
}

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
}: Props) {
  const itemNotes = getUniqueLedgerNotes(monthLedger);
  const reason = itemNotes.length > 0 ? itemNotes.join(" · ") : monthLedger.penaltyReason;

  return (
    <div className="border-b border-slate-100 last:border-b-0 bg-orange-50/15 hover:bg-orange-50/25 transition">
      <div className="px-4 py-2.5 grid grid-cols-10 items-center gap-1 text-xs text-left">
        <div className="col-span-2 pr-2 space-y-1">
          <p className="font-bold text-slate-800 truncate">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</p>
          <p className="font-mono text-[9px] text-slate-450">{emp.employeeCode} • {emp.location || "Unassigned"}</p>
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
    const itemNotes = getUniqueLedgerNotes(ledger);
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
