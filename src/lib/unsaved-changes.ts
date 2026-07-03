import { defaultTempLedgerEntry, type TempLedgerEntry } from "./ledger-helpers";
import { parseNonNegativeNumber } from "./number-validation";

export const UNSAVED_CHANGES_CONFIRM = {
  title: "Unsaved changes",
  message:
    "You have unsaved changes on this screen. If you leave now, your changes will be lost.",
  confirmLabel: "Leave anyway",
  cancelLabel: "Stay",
  variant: "warning" as const,
};

export function hasDraftRecords(drafts: Record<string, unknown>): boolean {
  return Object.keys(drafts).length > 0;
}

export function hasTempLedgerDrafts(
  entries: Record<string, TempLedgerEntry>,
): boolean {
  return Object.values(entries).some((entry) => {
    const amounts = [
      entry.advance,
      entry.penalty,
      entry.uniform,
      entry.foodPerk,
      entry.accommodationPerk,
      entry.conveyancePerk,
    ];
    if (amounts.some((raw) => parseNonNegativeNumber(raw, 0) > 0)) return true;
    if (entry.penaltyReason.trim().length > 0) return true;
    return false;
  });
}

export function hasBulkWizardProgress(
  isOpen: boolean,
  employees: string[],
  months: string[],
  dates: number[],
): boolean {
  if (!isOpen) return false;
  return employees.length > 0 || months.length > 0 || dates.length > 0;
}
