import { getDaysInMonthStatic, MONTH_NAME_LIST, normalizeMonthKey } from "./date-helpers";
import { Employee } from "../types";

export type LedgerItemType =
  | "advance"
  | "penalty"
  | "uniform"
  | "foodPerk"
  | "accommodationPerk"
  | "conveyancePerk";

export type LedgerItem = {
  id: string;
  type: LedgerItemType;
  amount: number;
  entryDate: string;
  note: string;
};

export type MonthLedger = {
  advance: number;
  penalty: number;
  uniform: number;
  foodPerk: number;
  accommodationPerk: number;
  conveyancePerk: number;
  penaltyReason: string;
  paymentStatus?: "Unpaid" | "Paid" | "Hold";
  ledgerItems: LedgerItem[];
};

export const LEDGER_TYPE_LABELS: Record<LedgerItemType, string> = {
  advance: "Advance",
  penalty: "Penalty",
  uniform: "Uniform",
  foodPerk: "Food",
  accommodationPerk: "Accommodation",
  conveyancePerk: "Conveyance",
};

const TOTAL_KEYS: Record<LedgerItemType, keyof MonthLedger> = {
  advance: "advance",
  penalty: "penalty",
  uniform: "uniform",
  foodPerk: "foodPerk",
  accommodationPerk: "accommodationPerk",
  conveyancePerk: "conveyancePerk",
};

function toAmount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function newId() {
  return `li_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeItems(raw: LedgerItem[] | undefined): LedgerItem[] {
  return (raw ?? []).map((item) => ({
    id: String(item.id || newId()),
    type: item.type,
    amount: toAmount(item.amount),
    entryDate: String(item.entryDate || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    note: String(item.note || ""),
  }));
}

function migrateLegacy(raw: Record<string, unknown>, items: LedgerItem[]): LedgerItem[] {
  if (items.length > 0) return items;
  const migrated: LedgerItem[] = [];
  const fallbackDate = new Date().toISOString().slice(0, 10);
  const legacyNote = String(raw.penaltyReason || "");
  for (const type of Object.keys(TOTAL_KEYS) as LedgerItemType[]) {
    const total = toAmount(raw[TOTAL_KEYS[type]]);
    if (total > 0) {
      migrated.push({
        id: newId(),
        type,
        amount: total,
        entryDate: fallbackDate,
        note: type === "advance" || type === "penalty" ? legacyNote : "",
      });
    }
  }
  return migrated;
}

function computeTotals(items: LedgerItem[]) {
  const totals = { advance: 0, penalty: 0, uniform: 0, foodPerk: 0, accommodationPerk: 0, conveyancePerk: 0 };
  for (const item of items) totals[TOTAL_KEYS[item.type] as keyof typeof totals] += item.amount;
  return totals;
}

export function getMonthLedger(emp: Employee, monthKey: string): MonthLedger {
  const raw = emp.monthlyLedger?.[monthKey] as Record<string, unknown> | undefined;
  if (!raw) {
    return {
      advance: 0,
      penalty: 0,
      uniform: 0,
      foodPerk: 0,
      accommodationPerk: 0,
      conveyancePerk: 0,
      penaltyReason: "",
      paymentStatus: "Unpaid",
      ledgerItems: [],
    };
  }
  let items = migrateLegacy(raw, normalizeItems(raw.ledgerItems as LedgerItem[] | undefined));
  items = items.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.id.localeCompare(b.id));
  const totals = computeTotals(items);
  return {
    ...totals,
    penaltyReason: String(raw.penaltyReason || ""),
    paymentStatus: (raw.paymentStatus as MonthLedger["paymentStatus"]) || "Unpaid",
    ledgerItems: items,
  };
}

export function getItemsByType(ledger: MonthLedger, type: LedgerItemType): LedgerItem[] {
  return ledger.ledgerItems.filter((item) => item.type === type);
}

export function getTotalByType(ledger: MonthLedger, type: LedgerItemType): number {
  return ledger[TOTAL_KEYS[type] as keyof typeof ledger] as number;
}

export function formatEntryDate(entryDate: string): string {
  const d = new Date(`${entryDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return entryDate;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function sumMonthTotals(employees: Employee[], monthKey: string, type: LedgerItemType): number {
  return employees.reduce((sum, emp) => sum + getTotalByType(getMonthLedger(emp, monthKey), type), 0);
}

export function clearItemsOfType(ledger: MonthLedger, type: LedgerItemType): MonthLedger {
  const items = ledger.ledgerItems.filter((item) => item.type !== type);
  const totals = computeTotals(items);
  return { ...ledger, ...totals, ledgerItems: items };
}

export function appendLedgerItem(
  ledger: MonthLedger,
  item: { type: LedgerItemType; amount: number; entryDate: string; note?: string },
): MonthLedger {
  const nextItem: LedgerItem = {
    id: newId(),
    type: item.type,
    amount: toAmount(item.amount),
    entryDate: String(item.entryDate || "").slice(0, 10) || todayDateInputValue(),
    note: String(item.note || "").trim(),
  };
  const items = [...ledger.ledgerItems, nextItem].sort(
    (a, b) => a.entryDate.localeCompare(b.entryDate) || a.id.localeCompare(b.id),
  );
  const totals = computeTotals(items);
  return { ...ledger, ...totals, ledgerItems: items };
}

export function removeLedgerItem(ledger: MonthLedger, itemId: string): MonthLedger {
  const items = ledger.ledgerItems.filter((item) => item.id !== itemId);
  const totals = computeTotals(items);
  return { ...ledger, ...totals, ledgerItems: items };
}

export function updateLedgerItem(
  ledger: MonthLedger,
  itemId: string,
  patch: Partial<Pick<LedgerItem, "type" | "amount" | "entryDate" | "note">>,
): MonthLedger {
  const items = ledger.ledgerItems
    .map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.amount !== undefined ? { amount: toAmount(patch.amount) } : {}),
        ...(patch.entryDate !== undefined
          ? { entryDate: String(patch.entryDate || "").slice(0, 10) || todayDateInputValue() }
          : {}),
        ...(patch.note !== undefined ? { note: String(patch.note || "").trim() } : {}),
      };
    })
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.id.localeCompare(b.id));
  const totals = computeTotals(items);
  return { ...ledger, ...totals, ledgerItems: items };
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateInputValue(year: number, monthIndex: number, day: number): string {
  const month = String(monthIndex + 1).padStart(2, "0");
  const date = String(day).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export function getLedgerDateBoundsForMonth(monthKey: string): { min: string; max: string } {
  const normalized = normalizeMonthKey(monthKey);
  const [monthName, yearText] = normalized.split(" ");
  const monthIndex = MONTH_NAME_LIST.indexOf(monthName);
  const year = parseInt(yearText, 10);

  if (monthIndex < 0 || !Number.isFinite(year)) {
    const today = todayDateInputValue();
    return { min: today, max: today };
  }

  const maxDay = getDaysInMonthStatic(normalized);
  return {
    min: formatDateInputValue(year, monthIndex, 1),
    max: formatDateInputValue(year, monthIndex, maxDay),
  };
}

export function isLedgerDateWithinMonth(entryDate: string, monthKey: string): boolean {
  if (!entryDate) return false;
  const { min, max } = getLedgerDateBoundsForMonth(monthKey);
  return entryDate >= min && entryDate <= max;
}

export function getDefaultLedgerEntryDate(monthKey?: string): string {
  if (!monthKey) return todayDateInputValue();

  const normalized = normalizeMonthKey(monthKey);
  const [monthName, yearText] = normalized.split(" ");
  const monthIndex = MONTH_NAME_LIST.indexOf(monthName);
  const year = parseInt(yearText, 10);

  if (monthIndex < 0 || !Number.isFinite(year)) {
    return todayDateInputValue();
  }

  const today = new Date();
  const maxDay = getDaysInMonthStatic(normalized);
  const day = Math.min(today.getDate(), maxDay);
  return formatDateInputValue(year, monthIndex, day);
}

export type TempLedgerEntry = {
  entryDate: string;
  advance: string;
  penalty: string;
  uniform: string;
  foodPerk: string;
  accommodationPerk: string;
  conveyancePerk: string;
  penaltyReason: string;
};

export function defaultTempLedgerEntry(monthKey?: string): TempLedgerEntry {
  return {
    entryDate: getDefaultLedgerEntryDate(monthKey),
    advance: "0",
    penalty: "0",
    uniform: "0",
    foodPerk: "0",
    accommodationPerk: "0",
    conveyancePerk: "0",
    penaltyReason: "",
  };
}

export function monthLedgerToPayload(ledger: MonthLedger) {
  return {
    advance: ledger.advance,
    penalty: ledger.penalty,
    uniform: ledger.uniform,
    foodPerk: ledger.foodPerk,
    accommodationPerk: ledger.accommodationPerk,
    conveyancePerk: ledger.conveyancePerk,
    penaltyReason: ledger.penaltyReason,
    paymentStatus: ledger.paymentStatus || "Unpaid",
    ledgerItems: ledger.ledgerItems,
  };
}
