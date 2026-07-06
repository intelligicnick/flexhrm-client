import React, { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import type {
  CommitmentDiary,
  Contract,
  ContractStatus,
  Employee,
  Renewal,
  SchoolPartner,
  SchoolVisit,
  Tender,
  TenderStatus,
} from "../../types";
import {
  getDayOfWeekForMonthDay,
  getEffectiveAttendanceStatus,
  isWeeklyOffDay,
  resolveBulkAttendanceStatus,
} from "../../lib/attendance-helpers";
import { getDaysInMonthStatic } from "../../lib/date-helpers";
import { isEmployeeExitedOnDayStatic } from "../../lib/employee-helpers";
import {
  defaultTempLedgerEntry,
  formatLedgerDisplayDate,
  formatLedgerRecordedSummary,
  getLedgerDateBoundsForMonth,
  getMonthLedger,
  groupLedgerItemsByDate,
  LEDGER_TYPE_LABELS,
  tempEntryFromLedgerItems,
  type LedgerItem,
  type LedgerItemType,
  type TempLedgerEntry,
} from "../../lib/ledger-helpers";
import { parseNonNegativeNumber } from "../../lib/number-validation";

type PaymentStatus = "Unpaid" | "Paid" | "Hold";

const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = ["Unpaid", "Paid", "Hold"];

const CONTRACT_STATUS_OPTIONS: ContractStatus[] = [
  "active",
  "upcoming",
  "expired",
  "extended",
  "terminated",
];

const TENDER_STATUS_OPTIONS: TenderStatus[] = [
  "not_filed",
  "not_evaluated",
  "filed",
  "technical_qualified",
  "qualified",
  "disqualified",
  "technical_not_open",
  "cancelled",
  "representation_asked",
  "challenged_representation",
  "financial",
  "bid_awarded",
  "bid_not_awarded",
  "won_bid",
];

function formatStatusLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ActionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-3 mt-1 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#ff791a]">Actions</p>
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = "orange",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "orange" | "emerald" | "rose" | "slate" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : tone === "rose"
        ? "bg-rose-600 hover:bg-rose-700"
        : tone === "amber"
          ? "bg-amber-600 hover:bg-amber-700"
          : tone === "slate"
            ? "bg-slate-600 hover:bg-slate-700"
            : "bg-[#ff791a] hover:bg-[#e4640c]";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-bold text-white transition disabled:opacity-60 cursor-pointer ${toneClass}`}
    >
      {children}
    </button>
  );
}

function isReviewableVisitStatus(status: SchoolVisit["status"]): boolean {
  return status === "submitted" || status === "pending";
}

export function ObserverVisitActions({
  visitId,
  status,
  onUpdate,
  onComplete,
}: {
  visitId: string;
  status: SchoolVisit["status"];
  onUpdate: (id: string, next: "approved" | "rejected") => Promise<boolean>;
  onComplete?: () => void;
}) {
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  if (!isReviewableVisitStatus(status)) return null;

  const run = async (next: "approved" | "rejected") => {
    setBusy(next);
    const ok = await onUpdate(visitId, next);
    setBusy(null);
    if (ok) onComplete?.();
  };

  return (
    <ActionShell>
      <div className="flex gap-2">
        <PrimaryButton tone="emerald" disabled={!!busy} onClick={() => run("approved")}>
          {busy === "approved" ? <Loader2 size={14} className="animate-spin mx-auto" /> : <span className="inline-flex items-center justify-center gap-1"><Check size={14} /> Approve</span>}
        </PrimaryButton>
        <PrimaryButton tone="rose" disabled={!!busy} onClick={() => run("rejected")}>
          {busy === "rejected" ? <Loader2 size={14} className="animate-spin mx-auto" /> : <span className="inline-flex items-center justify-center gap-1"><X size={14} /> Reject</span>}
        </PrimaryButton>
      </div>
    </ActionShell>
  );
}

export function ObserverCommitmentActions({
  commitment,
  onUpdate,
  onComplete,
}: {
  commitment: CommitmentDiary;
  onUpdate: (
    id: string,
    patch: { status?: CommitmentDiary["status"]; adminNotes?: string; notes?: string },
  ) => Promise<boolean>;
  onComplete?: () => void;
}) {
  const [adminNotes, setAdminNotes] = useState(commitment.adminNotes || "");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (patch: { status?: CommitmentDiary["status"]; adminNotes?: string }) => {
    setBusy(patch.status || "save");
    const ok = await onUpdate(commitment.id, patch);
    setBusy(null);
    if (ok) onComplete?.();
  };

  const statusActions: Array<{ status: CommitmentDiary["status"]; label: string; tone: "amber" | "emerald" | "rose" | "slate" }> = [];
  if (commitment.status === "committed") {
    statusActions.push({ status: "in_progress", label: "Mark In Progress", tone: "amber" });
  }
  if (commitment.status === "committed" || commitment.status === "in_progress") {
    statusActions.push({ status: "completed", label: "Mark Completed", tone: "emerald" });
    statusActions.push({ status: "cancelled", label: "Cancel", tone: "rose" });
  }

  return (
    <ActionShell>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admin Notes</label>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 resize-none focus:border-[#ff791a] focus:outline-none"
          placeholder="Add admin notes…"
        />
      </div>
      <PrimaryButton
        disabled={!!busy}
        onClick={() => run({ adminNotes: adminNotes.trim() })}
      >
        {busy === "save" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save Notes"}
      </PrimaryButton>
      {statusActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {statusActions.map((action) => (
            <PrimaryButton
              key={action.status}
              tone={action.tone}
              disabled={!!busy}
              onClick={() => run({ status: action.status, adminNotes: adminNotes.trim() })}
            >
              {busy === action.status ? <Loader2 size={14} className="animate-spin mx-auto" /> : action.label}
            </PrimaryButton>
          ))}
        </div>
      )}
    </ActionShell>
  );
}

export function ObserverPaymentStatusActions({
  currentStatus,
  onSave,
  onComplete,
}: {
  currentStatus: PaymentStatus;
  onSave: (status: PaymentStatus) => Promise<boolean | void>;
  onComplete?: () => void;
}) {
  const [selected, setSelected] = useState<PaymentStatus>(currentStatus);
  const [busy, setBusy] = useState(false);

  return (
    <ActionShell>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Status</label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value as PaymentStatus)}
        className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:border-[#ff791a] focus:outline-none"
      >
        {PAYMENT_STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <PrimaryButton
        disabled={busy || selected === currentStatus}
        onClick={async () => {
          setBusy(true);
          await onSave(selected);
          setBusy(false);
          onComplete?.();
        }}
      >
        {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Update Status"}
      </PrimaryButton>
    </ActionShell>
  );
}

export function ObserverTenderStatusActions({
  tender,
  onUpdate,
  onComplete,
}: {
  tender: Tender;
  onUpdate: (id: string, payload: Partial<Tender>) => Promise<void>;
  onComplete?: () => void;
}) {
  const [status, setStatus] = useState<TenderStatus>(tender.status);
  const [notes, setNotes] = useState(tender.notes || "");
  const [busy, setBusy] = useState(false);

  return (
    <ActionShell>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as TenderStatus)}
        className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:border-[#ff791a] focus:outline-none"
      >
        {TENDER_STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {formatStatusLabel(option)}
          </option>
        ))}
      </select>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 resize-none focus:border-[#ff791a] focus:outline-none"
      />
      <PrimaryButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onUpdate(tender.id, { status, notes: notes.trim() });
            onComplete?.();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save Changes"}
      </PrimaryButton>
    </ActionShell>
  );
}

export function ObserverContractStatusActions({
  contract,
  onUpdate,
  onComplete,
}: {
  contract: Contract;
  onUpdate: (id: string, payload: Partial<Contract>) => Promise<void>;
  onComplete?: () => void;
}) {
  const [status, setStatus] = useState<ContractStatus>(contract.status);
  const [notes, setNotes] = useState(contract.notes || "");
  const [busy, setBusy] = useState(false);

  return (
    <ActionShell>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as ContractStatus)}
        className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:border-[#ff791a] focus:outline-none"
      >
        {CONTRACT_STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {formatStatusLabel(option)}
          </option>
        ))}
      </select>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 resize-none focus:border-[#ff791a] focus:outline-none"
      />
      <PrimaryButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onUpdate(contract.id, { status, notes: notes.trim() });
            onComplete?.();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save Changes"}
      </PrimaryButton>
    </ActionShell>
  );
}

export function ObserverRenewalActions({
  renewal,
  onUpdate,
  onComplete,
}: {
  renewal: Renewal;
  onUpdate: (id: string, payload: Partial<Renewal>) => Promise<void>;
  onComplete?: () => void;
}) {
  const expiry = renewal.expiresOn || renewal.expiryDate || "";
  const [expiresOn, setExpiresOn] = useState(expiry);
  const [notes, setNotes] = useState(renewal.notes || "");
  const [busy, setBusy] = useState(false);

  return (
    <ActionShell>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expiry Date</label>
      <input
        type="date"
        value={expiresOn}
        onChange={(e) => setExpiresOn(e.target.value)}
        className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:border-[#ff791a] focus:outline-none"
      />
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 resize-none focus:border-[#ff791a] focus:outline-none"
      />
      <PrimaryButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onUpdate(renewal.id, {
              expiresOn,
              expiryDate: expiresOn,
              notes: notes.trim(),
            });
            onComplete?.();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save Changes"}
      </PrimaryButton>
    </ActionShell>
  );
}

const ALL_LEDGER_TYPES: LedgerItemType[] = [
  "advance",
  "uniform",
  "penalty",
  "foodPerk",
  "accommodationPerk",
  "conveyancePerk",
];

function ledgerAmountFieldClass(type: LedgerItemType): string {
  const base =
    "w-full mt-1 px-2 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white focus:border-[#ff791a] focus:outline-none";
  switch (type) {
    case "uniform":
      return `${base} text-[#f57416]`;
    case "foodPerk":
      return `${base} text-indigo-700`;
    case "accommodationPerk":
    case "conveyancePerk":
      return `${base} text-teal-700`;
    default:
      return `${base} text-slate-800`;
  }
}

function attendanceCellClass(status: string): string {
  switch (status) {
    case "P":
      return "bg-emerald-50 border-emerald-200 text-emerald-800";
    case "A":
      return "bg-rose-50 border-rose-200 text-rose-800";
    case "L":
      return "bg-amber-50 border-amber-200 text-amber-800";
    case "H":
      return "bg-blue-50 border-blue-200 text-blue-800";
    case "WO":
      return "bg-red-50 border-red-200 text-red-800";
    default:
      return "bg-white border-slate-200 text-slate-400";
  }
}

/** Calendar rows (Sun–Sat) — matches the month grid layout. */
function buildCalendarWeekRows(monthKey: string, daysInMonth: number): number[][] {
  const weeks: number[][] = [];
  let week: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    const dow = getDayOfWeekForMonthDay(monthKey, day);
    if (dow === 6 || day === daysInMonth) {
      weeks.push(week);
      week = [];
    }
  }
  return weeks;
}

function filterActiveDays(
  employee: Employee,
  monthKey: string,
  days: number[],
): number[] {
  return days.filter((day) => !isEmployeeExitedOnDayStatic(employee, monthKey, day));
}

function nextTapAttendanceStatus(currentStatus: string, isWeeklyOff: boolean): string {
  if (isWeeklyOff) {
    return currentStatus === "P" ? "" : "P";
  }
  if (currentStatus === "P") return "A";
  if (currentStatus === "A") return "P";
  return "P";
}

const ATTENDANCE_LONG_PRESS_MS = 450;

type AttendanceStatusOption = { value: string; label: string };

function getAttendanceStatusOptions(isWeeklyOff: boolean): AttendanceStatusOption[] {
  if (isWeeklyOff) {
    return [
      { value: "WO", label: "Weekly Off" },
      { value: "P", label: "Present" },
    ];
  }
  return [
    { value: "", label: "Clear" },
    { value: "P", label: "Present" },
    { value: "A", label: "Absent" },
    { value: "L", label: "Leave" },
    { value: "H", label: "Holiday" },
  ];
}

function attendanceStatusMenuClass(value: string): string {
  switch (value) {
    case "P":
      return "bg-emerald-50 border-emerald-200 text-emerald-800";
    case "A":
      return "bg-rose-50 border-rose-200 text-rose-800";
    case "L":
      return "bg-amber-50 border-amber-200 text-amber-800";
    case "H":
      return "bg-blue-50 border-blue-200 text-blue-800";
    case "WO":
      return "bg-red-50 border-red-200 text-red-800";
    default:
      return "bg-slate-50 border-slate-200 text-slate-600";
  }
}

type AttendanceRangePreset = "month" | "first15" | "last15" | "w1" | "w2" | "w3" | "w4";

function getDaysForRangePreset(
  preset: AttendanceRangePreset,
  monthKey: string,
  daysInMonth: number,
): number[] {
  const weeks = buildCalendarWeekRows(monthKey, daysInMonth);
  switch (preset) {
    case "month":
      return Array.from({ length: daysInMonth }, (_, i) => i + 1);
    case "first15":
      return Array.from({ length: Math.min(15, daysInMonth) }, (_, i) => i + 1);
    case "last15":
      return Array.from(
        { length: Math.min(15, daysInMonth) },
        (_, i) => Math.max(1, daysInMonth - 14) + i,
      );
    case "w1":
      return weeks[0] || [];
    case "w2":
      return weeks[1] || [];
    case "w3":
      return weeks[2] || [];
    case "w4":
      return weeks[3] || [];
    default:
      return [];
  }
}

function LedgerBatchForm({
  form,
  monthKey,
  label,
  saveLabel,
  busy,
  onFieldChange,
  onSave,
}: {
  form: TempLedgerEntry;
  monthKey: string;
  label?: string;
  saveLabel?: string;
  busy?: boolean;
  onFieldChange: (field: keyof TempLedgerEntry, value: string) => void;
  onSave: () => void;
}) {
  const dateBounds = getLedgerDateBoundsForMonth(monthKey);
  const hasPenaltyAmount = Number(form.penalty) > 0;
  const amountFields: Array<{ key: keyof TempLedgerEntry; type: LedgerItemType; label: string }> = [
    { key: "advance", type: "advance", label: LEDGER_TYPE_LABELS.advance },
    { key: "uniform", type: "uniform", label: LEDGER_TYPE_LABELS.uniform },
    { key: "penalty", type: "penalty", label: LEDGER_TYPE_LABELS.penalty },
    { key: "foodPerk", type: "foodPerk", label: LEDGER_TYPE_LABELS.foodPerk },
    { key: "accommodationPerk", type: "accommodationPerk", label: LEDGER_TYPE_LABELS.accommodationPerk },
    { key: "conveyancePerk", type: "conveyancePerk", label: LEDGER_TYPE_LABELS.conveyancePerk },
  ];

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      )}

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</label>
        <input
          type="date"
          value={form.entryDate}
          min={dateBounds.min}
          max={dateBounds.max}
          onChange={(e) => onFieldChange("entryDate", e.target.value)}
          className="w-full mt-1 px-2 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white focus:border-[#ff791a] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {amountFields.map(({ key, type, label: fieldLabel }) => (
          <div key={key}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{fieldLabel}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form[key]}
              onChange={(e) => onFieldChange(key, e.target.value)}
              placeholder="0"
              className={ledgerAmountFieldClass(type)}
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Penalty reason / comment{hasPenaltyAmount ? " *" : ""}
        </label>
        <textarea
          value={form.penaltyReason}
          onChange={(e) => onFieldChange("penaltyReason", e.target.value)}
          rows={2}
          placeholder={hasPenaltyAmount ? "Required when penalty amount is entered…" : "Optional unless penalty is entered"}
          className="w-full mt-1 px-2 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white resize-none focus:border-[#ff791a] focus:outline-none"
        />
      </div>

      <PrimaryButton disabled={!!busy} onClick={onSave}>
        {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : saveLabel || "Save"}
      </PrimaryButton>
    </div>
  );
}

export function ObserverLedgerActions({
  employee,
  monthKey,
  onSaveBatch,
  onUpdate,
  onDelete,
  canDelete,
}: {
  employee: Employee;
  monthKey: string;
  onSaveBatch: (entry: TempLedgerEntry) => Promise<boolean>;
  onUpdate: (
    itemId: string,
    patch: { type: LedgerItemType; amount: number; entryDate: string; note: string },
  ) => Promise<boolean>;
  onDelete: (itemId: string) => Promise<boolean>;
  canDelete: boolean;
}) {
  const ledger = getMonthLedger(employee, monthKey);
  const dateGroups = groupLedgerItemsByDate(ledger.ledgerItems);
  const [isEditing, setIsEditing] = useState(false);
  const [editForms, setEditForms] = useState<Array<{ entryDate: string; form: TempLedgerEntry; items: LedgerItem[] }>>([]);
  const [newForm, setNewForm] = useState<TempLedgerEntry>(() => defaultTempLedgerEntry(monthKey));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const patchFormField = (
    form: TempLedgerEntry,
    field: keyof TempLedgerEntry,
    value: string,
  ): TempLedgerEntry => {
    const next = { ...form, [field]: value };
    if (field === "penalty" && Number(value) <= 0) {
      next.penaltyReason = "";
    }
    return next;
  };

  const resetEditState = () => {
    setIsEditing(false);
    setEditForms([]);
    setNewForm(defaultTempLedgerEntry(monthKey));
    setBusyKey(null);
  };

  const refresh = () => {
    setRefreshKey((k) => k + 1);
    resetEditState();
  };

  const startEditing = () => {
    setEditForms(
      dateGroups.map((group) => ({
        entryDate: group.entryDate,
        form: tempEntryFromLedgerItems(group.items, monthKey),
        items: group.items,
      })),
    );
    setNewForm(defaultTempLedgerEntry(monthKey));
    setIsEditing(true);
  };

  const saveExistingGroup = async (
    form: TempLedgerEntry,
    itemsOnDate: LedgerItem[],
  ): Promise<boolean> => {
    const penaltyAmount = parseNonNegativeNumber(form.penalty, 0);
    if (penaltyAmount > 0 && !form.penaltyReason.trim()) {
      return false;
    }

    const note = form.penaltyReason.trim();
    let ok = true;
    const addEntry: TempLedgerEntry = {
      ...defaultTempLedgerEntry(monthKey),
      entryDate: form.entryDate,
      penaltyReason: note,
    };
    let needsAdd = false;

    for (const type of ALL_LEDGER_TYPES) {
      const amount = parseNonNegativeNumber(form[type], 0);
      const existing = itemsOnDate.find((item) => item.type === type);
      if (existing) {
        if (amount > 0) {
          const updated = await onUpdate(existing.id, {
            type,
            amount,
            entryDate: form.entryDate,
            note: type === "penalty" ? note : "",
          });
          if (!updated) ok = false;
        } else if (canDelete) {
          const deleted = await onDelete(existing.id);
          if (!deleted) ok = false;
        }
      } else if (amount > 0) {
        addEntry[type] = form[type];
        needsAdd = true;
      }
    }

    if (needsAdd) {
      const added = await onSaveBatch(addEntry);
      if (!added) ok = false;
    }

    return ok;
  };

  if (!isEditing) {
    return (
      <ActionShell key={refreshKey}>
        {dateGroups.length === 0 ? (
          <p className="text-xs font-medium text-slate-500">No entries recorded for this month yet.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recorded</p>
            {dateGroups.map(({ entryDate, items }) => {
              const penaltyNote = items.find((item) => item.type === "penalty" && item.note?.trim())?.note?.trim();
              return (
                <div key={entryDate} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-800">{formatLedgerDisplayDate(entryDate)}</p>
                  <p className="text-xs font-semibold text-slate-600 mt-1">{formatLedgerRecordedSummary(items)}</p>
                  {penaltyNote && (
                    <p className="text-[11px] text-slate-500 mt-1">Reason: {penaltyNote}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <PrimaryButton onClick={startEditing}>
          {dateGroups.length === 0 ? "Record Entry" : "Edit"}
        </PrimaryButton>
      </ActionShell>
    );
  }

  return (
    <ActionShell key={refreshKey}>
      {editForms.map((group, index) => (
        <LedgerBatchForm
          key={`${group.entryDate}-${index}`}
          form={group.form}
          monthKey={monthKey}
          label={`Edit · ${formatLedgerDisplayDate(group.form.entryDate)}`}
          saveLabel="Save Changes"
          busy={busyKey === `edit-${index}`}
          onFieldChange={(field, value) => {
            setEditForms((prev) =>
              prev.map((row, rowIndex) =>
                rowIndex === index ? { ...row, form: patchFormField(row.form, field, value) } : row,
              ),
            );
          }}
          onSave={async () => {
            setBusyKey(`edit-${index}`);
            const ok = await saveExistingGroup(group.form, group.items);
            setBusyKey(null);
            if (ok) refresh();
          }}
        />
      ))}

      <LedgerBatchForm
        form={newForm}
        monthKey={monthKey}
        label={editForms.length > 0 ? "Add Another Entry" : "Record Entry"}
        saveLabel="Save All Entries"
        busy={busyKey === "new"}
        onFieldChange={(field, value) => setNewForm((prev) => patchFormField(prev, field, value))}
        onSave={async () => {
          setBusyKey("new");
          const ok = await onSaveBatch(newForm);
          setBusyKey(null);
          if (ok) refresh();
        }}
      />

      <PrimaryButton tone="slate" disabled={!!busyKey} onClick={resetEditState}>
        Cancel
      </PrimaryButton>
    </ActionShell>
  );
}

export function ObserverAttendanceActions({
  employee,
  monthKey,
  attendanceDb,
  onCellChange,
  onBulkApply,
}: {
  employee: Employee;
  monthKey: string;
  attendanceDb: Record<string, Record<string, Record<number, string>>>;
  onCellChange: (empId: string, day: number, status: string, monthKey?: string) => Promise<void>;
  onBulkApply?: (empId: string, monthKey: string, days: number[], status: string) => Promise<void>;
}) {
  const daysInMonth = getDaysInMonthStatic(monthKey);
  const empData = attendanceDb[monthKey]?.[employee.id] || {};
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [activeRange, setActiveRange] = useState<AttendanceRangePreset | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"P" | "A" | null>(null);
  const [statusMenuDay, setStatusMenuDay] = useState<number | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => {
    setStatusMenuDay(null);
  }, [employee.id, monthKey]);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const startLongPress = (dayNum: number) => {
    longPressFiredRef.current = false;
    clearPressTimer();
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setStatusMenuDay(dayNum);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(12);
      }
    }, ATTENDANCE_LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    clearPressTimer();
    longPressFiredRef.current = false;
  };

  const endLongPress = (onTap: () => void) => {
    clearPressTimer();
    if (!longPressFiredRef.current) {
      onTap();
    }
    longPressFiredRef.current = false;
  };

  const applyStatusFromMenu = (dayNum: number, val: string, isWeeklyOff: boolean) => {
    const status = isWeeklyOff && val === "WO" ? "" : val;
    void onCellChange(employee.id, dayNum, status, monthKey);
    setStatusMenuDay(null);
  };

  const selectRange = (preset: AttendanceRangePreset) => {
    const days = filterActiveDays(
      employee,
      monthKey,
      getDaysForRangePreset(preset, monthKey, daysInMonth),
    );
    setSelectedDays(new Set(days));
    setActiveRange(preset);
  };

  const applyBulkStatus = async (status: "P" | "A") => {
    const days = Array.from(selectedDays).sort((a, b) => a - b);
    if (days.length === 0) return;
    setBulkBusy(status);
    try {
      if (onBulkApply) {
        await onBulkApply(employee.id, monthKey, days, status);
      } else {
        await Promise.all(
          days.map((day) => {
            const resolved = resolveBulkAttendanceStatus(
              employee.workingDaysType,
              monthKey,
              day,
              status,
            );
            return onCellChange(employee.id, day, resolved, monthKey);
          }),
        );
      }
    } finally {
      setBulkBusy(null);
    }
  };

  const rangeButtons: Array<{ preset: AttendanceRangePreset; label: string }> = [
    { preset: "month", label: "Month" },
    { preset: "first15", label: "1–15" },
    { preset: "last15", label: "Last 15" },
    { preset: "w1", label: "W1" },
    { preset: "w2", label: "W2" },
    { preset: "w3", label: "W3" },
    { preset: "w4", label: "W4" },
  ];

  const renderDayCell = (dayNum: number) => {
    const isExited = isEmployeeExitedOnDayStatic(employee, monthKey, dayNum);
    const currentStatus = empData[dayNum] || "";
    const isWeeklyOff = isWeeklyOffDay(employee.workingDaysType, monthKey, dayNum);
    const isSunday = getDayOfWeekForMonthDay(monthKey, dayNum) === 0;
    const effectiveStatus = getEffectiveAttendanceStatus(
      employee.workingDaysType,
      monthKey,
      dayNum,
      currentStatus,
    );
    const isSelected = selectedDays.has(dayNum);

    if (isExited) {
      return (
        <div
          key={dayNum}
          className="h-11 flex flex-col items-center justify-center rounded-lg border bg-slate-100 border-slate-200 text-slate-400"
        >
          <span className="text-[9px] font-bold">{dayNum}</span>
          <span className="text-[8px]">—</span>
        </div>
      );
    }

  const displayStatus =
      isWeeklyOff && currentStatus !== "P"
        ? "WO"
        : effectiveStatus || currentStatus;
    const cellClass = attendanceCellClass(displayStatus);

    const handleTap = () => {
      const nextStatus = nextTapAttendanceStatus(currentStatus, isWeeklyOff);
      void onCellChange(employee.id, dayNum, nextStatus, monthKey);
    };

    return (
      <div
        key={dayNum}
        className={`relative h-11 rounded-lg border ${cellClass} ${
          isWeeklyOff || isSunday ? "ring-1 ring-red-100" : ""
        } ${isSelected ? "ring-2 ring-[#ff791a] ring-offset-1" : ""}`}
      >
        <span className="absolute top-0.5 left-0.5 text-[8px] font-bold opacity-70 leading-none pointer-events-none z-[1]">
          {dayNum}
        </span>
        <span
          className="absolute bottom-0.5 right-0.5 text-[7px] font-bold text-slate-400 leading-none pointer-events-none z-[1]"
          aria-hidden
        >
          ⋮
        </span>
        <button
          type="button"
          onPointerDown={() => startLongPress(dayNum)}
          onPointerUp={() => endLongPress(handleTap)}
          onPointerLeave={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 z-0 flex items-center justify-center text-[10px] font-black cursor-pointer active:opacity-70 select-none"
          aria-label={
            isWeeklyOff
              ? `Day ${dayNum}: ${displayStatus || "weekly off"}. Tap to toggle present. Hold for more options.`
              : `Day ${dayNum}: ${displayStatus || "unmarked"}. Tap to toggle present or absent. Hold for more options.`
          }
        >
          {displayStatus || "—"}
        </button>
      </div>
    );
  };

  const menuDay = statusMenuDay;
  const menuIsWeeklyOff =
    menuDay !== null && isWeeklyOffDay(employee.workingDaysType, monthKey, menuDay);
  const menuCurrentStatus = menuDay !== null ? empData[menuDay] || "" : "";
  const menuOptions = getAttendanceStatusOptions(!!menuIsWeeklyOff);
  const menuDisplayValue = menuIsWeeklyOff
    ? menuCurrentStatus === "P"
      ? "P"
      : "WO"
    : menuCurrentStatus;

  return (
    <ActionShell>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mark Attendance</p>

      <div className="flex flex-wrap gap-1">
        {rangeButtons.map(({ preset, label }) => (
          <button
            key={preset}
            type="button"
            onClick={() => selectRange(preset)}
            className={`px-2 py-1 rounded-md text-[9px] font-bold border transition cursor-pointer ${
              activeRange === preset
                ? "bg-[#ff791a] text-white border-[#ff791a]"
                : "bg-white text-slate-600 border-slate-200 hover:border-[#ff791a]/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selectedDays.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-semibold text-slate-500">{selectedDays.size} days</span>
          <button
            type="button"
            disabled={!!bulkBusy}
            onClick={() => void applyBulkStatus("P")}
            className="px-2 py-1 rounded-md text-[9px] font-bold bg-emerald-600 text-white disabled:opacity-60 cursor-pointer"
          >
            {bulkBusy === "P" ? "…" : "Mark P"}
          </button>
          <button
            type="button"
            disabled={!!bulkBusy}
            onClick={() => void applyBulkStatus("A")}
            className="px-2 py-1 rounded-md text-[9px] font-bold bg-rose-600 text-white disabled:opacity-60 cursor-pointer"
          >
            {bulkBusy === "A" ? "…" : "Mark A"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDays(new Set());
              setActiveRange(null);
            }}
            className="px-2 py-1 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
          <div
            key={`${label}-${index}`}
            className={`text-center text-[8px] font-black uppercase py-0.5 ${
              index === 0 ? "text-red-400" : "text-slate-400"
            }`}
          >
            {label}
          </div>
        ))}
        {Array.from({ length: getDayOfWeekForMonthDay(monthKey, 1) }).map((_, i) => (
          <div key={`pad-${i}`} className="h-11" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => renderDayCell(i + 1))}
      </div>

      <p className="text-[10px] text-slate-400 font-medium">
        Tap to toggle P/A · Hold for L/H/WO · Weekly off = red (same as admin)
      </p>

      {menuDay !== null && (
        <>
          <button
            type="button"
            aria-label="Close status menu"
            className="fixed inset-0 z-[60] bg-black/20"
            onClick={() => setStatusMenuDay(null)}
          />
          <div className="fixed inset-x-3 bottom-4 z-[61] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Day {menuDay} · Choose status
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {menuOptions.map((opt) => (
                <button
                  key={opt.value || "clear"}
                  type="button"
                  onClick={() => applyStatusFromMenu(menuDay, opt.value, !!menuIsWeeklyOff)}
                  className={`min-h-[40px] px-2 py-2 rounded-xl border text-[10px] font-bold cursor-pointer active:scale-[0.98] transition ${
                    attendanceStatusMenuClass(opt.value)
                  } ${menuDisplayValue === opt.value ? "ring-2 ring-[#ff791a]" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </ActionShell>
  );
}

export type ObserverEditHandlers = {
  handleUpdateVisitStatus: (id: string, status: "approved" | "rejected") => Promise<boolean>;
  handleUpdateCommitmentDiary: (
    id: string,
    patch: { status?: CommitmentDiary["status"]; adminNotes?: string; notes?: string },
  ) => Promise<boolean>;
  handleUpdatePaymentStatus: (empId: string, status: "Unpaid" | "Paid" | "Hold") => Promise<void>;
  handleSavePartnerPaymentStatus: (
    updates: Array<{ id: string; paymentStatus: "Unpaid" | "Paid" | "Hold" }>,
  ) => Promise<boolean>;
  handleUpdateTender: (id: string, payload: Partial<Tender>) => Promise<void>;
  handleUpdateContract: (id: string, payload: Partial<Contract>) => Promise<void>;
  handleUpdateRenewal: (id: string, payload: Partial<Renewal>) => Promise<void>;
  handleObserverAddLedgerEntry?: (
    employeeId: string,
    entry: { type: LedgerItemType; amount: number; entryDate: string; note?: string },
  ) => Promise<boolean>;
  handleObserverSaveLedgerBatch?: (employeeId: string, entry: TempLedgerEntry) => Promise<boolean>;
  handleObserverUpdateLedgerItem?: (
    employeeId: string,
    itemId: string,
    patch: { type?: LedgerItemType; amount?: number; entryDate?: string; note?: string },
  ) => Promise<boolean>;
  handleDeleteLedgerItem?: (employeeId: string, itemId: string) => Promise<boolean>;
  handleCellAttendanceChange?: (
    empId: string,
    day: number,
    status: string,
    monthKey?: string,
  ) => Promise<void>;
};

export function buildObserverSearchActions(
  kind: string,
  entity: unknown,
  canEdit: (tab: string) => boolean,
  selectedMonth: string,
  handlers: ObserverEditHandlers,
  onComplete: () => void,
): React.ReactNode | undefined {
  switch (kind) {
    case "employee":
    case "salary": {
      const emp = entity as Employee;
      if (!canEdit("Salary")) return undefined;
      return (
        <ObserverPaymentStatusActions
          currentStatus={emp.monthlyLedger?.[selectedMonth]?.paymentStatus || "Unpaid"}
          onSave={async (status) => {
            await handlers.handleUpdatePaymentStatus(emp.id, status);
          }}
          onComplete={onComplete}
        />
      );
    }
    case "visit": {
      const visit = entity as SchoolVisit;
      if (!canEdit("Field Team")) return undefined;
      return (
        <ObserverVisitActions
          visitId={visit.id}
          status={visit.status}
          onUpdate={handlers.handleUpdateVisitStatus}
          onComplete={onComplete}
        />
      );
    }
    case "commitment": {
      const commitment = entity as CommitmentDiary;
      if (!canEdit("Field Team")) return undefined;
      return (
        <ObserverCommitmentActions
          commitment={commitment}
          onUpdate={handlers.handleUpdateCommitmentDiary}
          onComplete={onComplete}
        />
      );
    }
    case "tender": {
      const tender = entity as Tender;
      if (!canEdit("Tenders")) return undefined;
      return (
        <ObserverTenderStatusActions
          tender={tender}
          onUpdate={handlers.handleUpdateTender}
          onComplete={onComplete}
        />
      );
    }
    case "contract": {
      const contract = entity as Contract;
      if (!canEdit("Contracts")) return undefined;
      return (
        <ObserverContractStatusActions
          contract={contract}
          onUpdate={handlers.handleUpdateContract}
          onComplete={onComplete}
        />
      );
    }
    case "renewal": {
      const renewal = entity as Renewal;
      if (!canEdit("Car Papers")) return undefined;
      return (
        <ObserverRenewalActions
          renewal={renewal}
          onUpdate={handlers.handleUpdateRenewal}
          onComplete={onComplete}
        />
      );
    }
    case "partner": {
      const partner = entity as SchoolPartner;
      if (!canEdit("Monthly Billing")) return undefined;
      return (
        <ObserverPaymentStatusActions
          currentStatus={partner.monthlyPayLedger?.[selectedMonth]?.paymentStatus || "Unpaid"}
          onSave={async (status) =>
            handlers.handleSavePartnerPaymentStatus([{ id: partner.id, paymentStatus: status }])
          }
          onComplete={onComplete}
        />
      );
    }
    default:
      return undefined;
  }
}
