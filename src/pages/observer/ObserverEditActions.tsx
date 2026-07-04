import React, { useState } from "react";
import { Check, Loader2, Trash2, X } from "lucide-react";
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
} from "../../lib/attendance-helpers";
import { getDaysInMonthStatic } from "../../lib/date-helpers";
import { isEmployeeExitedOnDayStatic } from "../../lib/employee-helpers";
import {
  defaultTempLedgerEntry,
  getLedgerDateBoundsForMonth,
  getMonthLedger,
  LEDGER_TYPE_LABELS,
  type LedgerItem,
  type LedgerItemType,
  type TempLedgerEntry,
} from "../../lib/ledger-helpers";

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

function LedgerItemEditor({
  item,
  monthKey,
  onSave,
  onDelete,
  canDelete,
}: {
  item: LedgerItem;
  monthKey: string;
  onSave: (patch: { type: LedgerItemType; amount: number; entryDate: string; note: string }) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  canDelete: boolean;
}) {
  const dateBounds = getLedgerDateBoundsForMonth(monthKey);
  const [type, setType] = useState<LedgerItemType>(item.type);
  const [amount, setAmount] = useState(String(item.amount));
  const [entryDate, setEntryDate] = useState(item.entryDate);
  const [note, setNote] = useState(item.note || "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {LEDGER_TYPE_LABELS[item.type]} · {entryDate}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LedgerItemType)}
            className="w-full mt-1 px-2 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white"
          >
            {ALL_LEDGER_TYPES.map((option) => (
              <option key={option} value={option}>
                {LEDGER_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full mt-1 px-2 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</label>
        <input
          type="date"
          value={entryDate}
          min={dateBounds.min}
          max={dateBounds.max}
          onChange={(e) => setEntryDate(e.target.value)}
          className="w-full mt-1 px-2 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white"
        />
      </div>
      {type === "penalty" && (
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reason</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full mt-1 px-2 py-2 border border-slate-200 rounded-lg text-xs bg-white"
            placeholder="Penalty reason…"
          />
        </div>
      )}
      <div className="flex gap-2">
        <PrimaryButton
          disabled={!!busy}
          onClick={async () => {
            setBusy("save");
            const ok = await onSave({
              type,
              amount: Number(amount),
              entryDate,
              note: note.trim(),
            });
            setBusy(null);
          }}
        >
          {busy === "save" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save"}
        </PrimaryButton>
        {canDelete && onDelete && (
          <PrimaryButton
            tone="rose"
            disabled={!!busy}
            onClick={async () => {
              setBusy("delete");
              await onDelete();
              setBusy(null);
            }}
          >
            {busy === "delete" ? <Loader2 size={14} className="animate-spin mx-auto" /> : <Trash2 size={14} className="mx-auto" />}
          </PrimaryButton>
        )}
      </div>
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
  const dateBounds = getLedgerDateBoundsForMonth(monthKey);
  const [form, setForm] = useState<TempLedgerEntry>(() => defaultTempLedgerEntry(monthKey));
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const hasPenaltyAmount = Number(form.penalty) > 0;

  const updateField = (field: keyof TempLedgerEntry, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "penalty" && Number(value) <= 0) {
        next.penaltyReason = "";
      }
      return next;
    });
  };

  const refresh = () => {
    setRefreshKey((k) => k + 1);
    setForm(defaultTempLedgerEntry(monthKey));
  };

  const amountFields: Array<{ key: keyof TempLedgerEntry; type: LedgerItemType; label: string }> = [
    { key: "advance", type: "advance", label: LEDGER_TYPE_LABELS.advance },
    { key: "uniform", type: "uniform", label: LEDGER_TYPE_LABELS.uniform },
    { key: "penalty", type: "penalty", label: LEDGER_TYPE_LABELS.penalty },
    { key: "foodPerk", type: "foodPerk", label: LEDGER_TYPE_LABELS.foodPerk },
    { key: "accommodationPerk", type: "accommodationPerk", label: LEDGER_TYPE_LABELS.accommodationPerk },
    { key: "conveyancePerk", type: "conveyancePerk", label: LEDGER_TYPE_LABELS.conveyancePerk },
  ];

  return (
    <ActionShell key={refreshKey}>
      {ledger.ledgerItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Existing Entries</p>
          {ledger.ledgerItems.map((item) => (
            <LedgerItemEditor
              key={item.id}
              item={item}
              monthKey={monthKey}
              canDelete={canDelete}
              onSave={(patch) => onUpdate(item.id, patch).then((ok) => { if (ok) refresh(); return ok; })}
              onDelete={canDelete ? () => onDelete(item.id).then((ok) => { if (ok) refresh(); return ok; }) : undefined}
            />
          ))}
        </div>
      )}

      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Record Ledger · One Save</p>
      <p className="text-[10px] text-slate-500 font-medium">
        Fill all amounts for the same date, then save once. Leave unused fields at 0.
      </p>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</label>
        <input
          type="date"
          value={form.entryDate}
          min={dateBounds.min}
          max={dateBounds.max}
          onChange={(e) => updateField("entryDate", e.target.value)}
          className="w-full mt-1 px-2 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white focus:border-[#ff791a] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {amountFields.map(({ key, type, label }) => (
          <div key={key}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form[key]}
              onChange={(e) => updateField(key, e.target.value)}
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
          onChange={(e) => updateField("penaltyReason", e.target.value)}
          rows={2}
          placeholder={hasPenaltyAmount ? "Required when penalty amount is entered…" : "Optional unless penalty is entered"}
          className="w-full mt-1 px-2 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 bg-white resize-none focus:border-[#ff791a] focus:outline-none"
        />
      </div>

      <PrimaryButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const ok = await onSaveBatch(form);
          setBusy(false);
          if (ok) refresh();
        }}
      >
        {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save All Entries"}
      </PrimaryButton>
    </ActionShell>
  );
}

export function ObserverAttendanceActions({
  employee,
  monthKey,
  attendanceDb,
  onCellChange,
}: {
  employee: Employee;
  monthKey: string;
  attendanceDb: Record<string, Record<string, Record<number, string>>>;
  onCellChange: (empId: string, day: number, status: string, monthKey?: string) => Promise<void>;
}) {
  const daysInMonth = getDaysInMonthStatic(monthKey);
  const empData = attendanceDb[monthKey]?.[employee.id] || {};

  return (
    <ActionShell>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mark Attendance</p>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => {
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
            isWeeklyOff && currentStatus !== "P" ? "WO" : effectiveStatus || currentStatus;
          const cellClass = attendanceCellClass(displayStatus);

          return (
            <div
              key={dayNum}
              className={`h-11 flex flex-col items-center justify-center rounded-lg border gap-0.5 ${cellClass} ${isSunday ? "ring-1 ring-red-100" : ""}`}
            >
              <span className="text-[9px] font-bold opacity-70">{dayNum}</span>
              {isWeeklyOff && currentStatus !== "P" ? (
                <select
                  value="WO"
                  onChange={(e) => {
                    if (e.target.value === "P") {
                      void onCellChange(employee.id, dayNum, "P", monthKey);
                    }
                  }}
                  className="text-[8px] font-black text-center border-0 rounded bg-transparent cursor-pointer"
                >
                  <option value="WO">WO</option>
                  <option value="P">P</option>
                </select>
              ) : isWeeklyOff && currentStatus === "P" ? (
                <select
                  value="P"
                  onChange={(e) => {
                    const val = e.target.value;
                    void onCellChange(employee.id, dayNum, val === "WO" ? "" : val, monthKey);
                  }}
                  className="text-[8px] font-black text-center border-0 rounded bg-transparent cursor-pointer"
                >
                  <option value="WO">WO</option>
                  <option value="P">P</option>
                </select>
              ) : (
                <select
                  value={currentStatus}
                  onChange={(e) => void onCellChange(employee.id, dayNum, e.target.value, monthKey)}
                  className="text-[8px] font-black text-center border-0 rounded bg-transparent cursor-pointer"
                >
                  <option value="">—</option>
                  <option value="P">P</option>
                  <option value="A">A</option>
                  <option value="L">L</option>
                  <option value="H">H</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 font-medium">P = Present · A = Absent · L = Leave · H = Holiday · WO = Weekly Off</p>
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
