import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  School,
  MapPin,
  Users,
  IndianRupee,
  Building2,
  Clipboard,
  CheckCircle,
  LayoutGrid,
  CreditCard,
  Notebook,
  Edit,
} from "lucide-react";
import { getSupervisorsForBlock } from "../lib/school-work-helpers";
import { SchoolSupervisor, SchoolWork } from "../types";

interface SchoolWorkViewModalProps {
  school: SchoolWork;
  supervisors?: SchoolSupervisor[];
  onClose: () => void;
  onEditClick?: (school: SchoolWork) => void;
  readOnly?: boolean;
}

type ViewTab = "overview" | "school" | "partner" | "banking" | "notes";

const TABS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutGrid size={14} /> },
  { id: "school", label: "School", icon: <School size={14} /> },
  { id: "partner", label: "Partner & Pay", icon: <IndianRupee size={14} /> },
  { id: "banking", label: "Banking", icon: <CreditCard size={14} /> },
  { id: "notes", label: "Notes", icon: <Notebook size={14} /> },
];

function formatCurrency(value: number | undefined): string {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function SchoolWorkViewModal({
  school,
  supervisors = [],
  onClose,
  onEditClick,
  readOnly = false,
}: SchoolWorkViewModalProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const blockSupervisors = useMemo(
    () => getSupervisorsForBlock(supervisors, school.block || ""),
    [supervisors, school.block],
  );

  const assignedSupervisor = useMemo(
    () =>
      school.assignedSupervisorId
        ? supervisors.find((supervisor) => supervisor.id === school.assignedSupervisorId)
        : undefined,
    [supervisors, school.assignedSupervisorId],
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const renderField = (label: string, value: string | number | undefined, isMono = false, highlight = false) => {
    const displayValue = value !== undefined && value !== null && value !== "" ? String(value) : "—";
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span
          className={`text-xs ${highlight ? "font-bold text-slate-900" : "font-medium text-slate-700"} ${isMono ? "font-mono" : ""}`}
        >
          {displayValue}
        </span>
      </div>
    );
  };

  const renderCopyable = (label: string, value: string, fieldName: string, isMono = false) => {
    const formattedValue = value || "—";
    const hasValue = !!value;

    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-xs text-slate-800 ${isMono ? "font-mono text-[13px] font-medium tracking-wide" : "font-semibold"}`}
          >
            {formattedValue}
          </span>
          {hasValue && (
            <button
              onClick={() => handleCopy(value, fieldName)}
              className="cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
              title={`Copy ${label}`}
              type="button"
            >
              {copiedField === fieldName ? (
                <CheckCircle size={14} className="text-emerald-600" />
              ) : (
                <Clipboard size={14} />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const overviewFacts = [
    {
      label: "District",
      value: school.district || "—",
      icon: <MapPin size={14} className="text-rose-500" />,
    },
    {
      label: "Block",
      value: school.block || "—",
      icon: <Building2 size={14} className="text-blue-600" />,
    },
    {
      label: "Category",
      value: school.schoolCategory || "—",
      icon: <School size={14} className="text-violet-600" />,
    },
    {
      label: "Supervisor(s)",
      value: blockSupervisors.length
        ? blockSupervisors.map((supervisor) => supervisor.name).join(", ")
        : "No supervisor for this block",
      icon: <Users size={14} className="text-emerald-600" />,
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in" id="school-work-view-modal">
      <div
        onClick={handleBackdropClick}
        className="absolute inset-0 cursor-pointer bg-slate-950/50 backdrop-blur-sm"
        aria-hidden
      />
      <div className="relative flex h-full items-center justify-center p-3 sm:p-4 pointer-events-none">
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex h-full max-h-[92vh] w-full max-w-4xl min-h-0 cursor-default flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#0C1E4A] via-slate-900 to-slate-800 px-5 pb-4 pt-5 text-white sm:px-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,121,26,0.18),transparent_55%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#ff791a] text-lg font-black tracking-wide text-white shadow-lg sm:h-20 sm:w-20">
                  <School size={28} />
                </div>
                <div className="min-w-0 text-left">
                  <h2 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
                    {school.schoolName || "School Record"}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-300">{school.schoolCategory || "No category"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[11px] font-bold text-orange-200">
                      {school.udise || "No UDISE"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
                      SR {school.srNo}
                    </span>
                    {school.block && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
                        <MapPin size={10} />
                        {school.block}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white shrink-0"
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Toilets</p>
                <p className="text-sm font-extrabold text-sky-300">{school.noOfToilets ?? 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Partner Pay</p>
                <p className="text-sm font-extrabold text-emerald-300">
                  {formatCurrency(school.partnerMonthlyPay)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Govt Rate</p>
                <p className="text-sm font-bold text-white">{formatCurrency(school.govtUnitRate)}/day</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">District</p>
                <p className="truncate text-sm font-bold text-white">{school.district || "—"}</p>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 sm:px-4" id="school-view-tab-headers">
            <div className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                    activeTab === tab.id
                      ? "bg-[#ff791a] text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/60 p-4 sm:p-5">
            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {overviewFacts.map((fact) => (
                    <div
                      key={fact.label}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-xs"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">{fact.icon}</div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{fact.label}</p>
                        <p className="truncate text-sm font-bold text-slate-800">{fact.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {renderCopyable("UDISE", school.udise, "udise", true)}
                  {renderField("Headmaster", school.headmasterName, false, true)}
                  {renderField("Cleaning Partner", school.sweeperName, false, true)}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Partner Monthly</p>
                    <p className="mt-1 text-xl font-extrabold text-emerald-800">
                      {formatCurrency(school.partnerMonthlyPay)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Govt Unit Rate</p>
                    <p className="mt-1 text-xl font-extrabold text-blue-800">
                      {formatCurrency(school.govtUnitRate)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">Material Cost</p>
                    <p className="mt-1 text-xl font-extrabold text-violet-800">
                      {formatCurrency(school.materialCost)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "school" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {renderField("School Name", school.schoolName, false, true)}
                {renderCopyable("UDISE", school.udise, "udise", true)}
                {renderField("Category", school.schoolCategory)}
                {renderField("Headmaster Name", school.headmasterName)}
                {renderField("Headmaster Number", school.headmasterNumber, true)}
                {renderField("District", school.district)}
                {renderField("Block", school.block)}
                {renderField(
                  "Assigned Supervisor",
                  assignedSupervisor
                    ? `${assignedSupervisor.name}${assignedSupervisor.phone ? ` (${assignedSupervisor.phone})` : ""}`
                    : undefined,
                )}
              </div>
            )}

            {activeTab === "partner" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {renderField("Cleaning Partner", school.sweeperName, false, true)}
                  {renderField("No of Toilets", school.noOfToilets)}
                  {renderField("Payment Method", school.paymentMethod)}
                  {renderField("Partner Monthly Pay", formatCurrency(school.partnerMonthlyPay))}
                  {renderField("Govt Unit Rate", formatCurrency(school.govtUnitRate))}
                  {renderField("Rates", formatCurrency(school.rates))}
                  {renderField("Material Cost", formatCurrency(school.materialCost))}
                </div>
                {school.rateExplanation && (
                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Explanation for Rate
                    </p>
                    <p className="text-sm leading-relaxed text-slate-700">{school.rateExplanation}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "banking" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {renderCopyable("Account Number", school.accountNumber, "accountNumber", true)}
                {renderCopyable("IFSC Code", school.ifscCode, "ifscCode", true)}
                {renderField("Account Holder Name", school.accountHolderName)}
                {renderField("Payment Method", school.paymentMethod)}
              </div>
            )}

            {activeTab === "notes" && (
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Remarks</p>
                <p className="text-sm leading-relaxed text-slate-700">{school.remarks || "No remarks recorded."}</p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
            <div>
              {onEditClick && !readOnly && (
                <button
                  onClick={() => onEditClick(school)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#ff791a] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#e56a12]"
                  type="button"
                >
                  <Edit size={14} />
                  Edit School
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
