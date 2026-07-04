import React, { useState } from "react";
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
