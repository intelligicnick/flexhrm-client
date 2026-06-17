/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  User,
  DollarSign,
  Notebook,
  Key,
  Clipboard,
  CheckCircle,
  Edit,
  IdCard,
  MapPin,
  Phone,
  Briefcase,
  ShieldCheck,
  Users,
  LayoutGrid,
  LogOut,
  Calendar,
  FolderOpen,
} from "lucide-react";
import { Employee } from "../types";
import { normalizeSkillCategory, calculatePfAmounts, isEmployeePtEnabled, isPfEsicCompliant, isProfessionalTaxApplicable, resolveLocationCompliance, resolveLocationPtEnabled } from "../utils";
import EmployeePhoto from "./EmployeePhoto";
import { useEmployeePhotoUrl } from "../hooks/useEmployeePhotoUrl";
import IdCardPanel from "./id-card/IdCardPanel";
import EmployeeDocumentsPanel from "./EmployeeDocumentsPanel";
import { fetchEmployeeDocuments } from "../lib/employee-documents";

interface EmployeeViewModalProps {
  employee: Employee;
  onClose: () => void;
  onEditClick?: (employee: Employee) => void;
  onMarkExit?: (employee: Employee, exitDate: string, exitReason: string) => Promise<boolean>;
  readOnly?: boolean;
}

type ViewTab = "overview" | "personal" | "payroll" | "statutory" | "family" | "idcard" | "documents";

const TABS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutGrid size={14} /> },
  { id: "personal", label: "Personal", icon: <User size={14} /> },
  { id: "payroll", label: "Payroll", icon: <DollarSign size={14} /> },
  { id: "statutory", label: "IDs & Bank", icon: <Key size={14} /> },
  { id: "family", label: "Family", icon: <Users size={14} /> },
  { id: "documents", label: "Documents", icon: <FolderOpen size={14} /> },
  { id: "idcard", label: "ID Card", icon: <IdCard size={14} /> },
];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const EXIT_REASON_OPTIONS = [
  "Resignation",
  "Termination",
  "Retirement",
  "Absconding",
  "Contract Ended",
  "Mutual Separation",
  "Other",
] as const;

function buildExitReason(category: string, details: string): string {
  const trimmedDetails = details.trim();
  return trimmedDetails ? `${category} — ${trimmedDetails}` : category;
}

export default function EmployeeViewModal({
  employee,
  onClose,
  onEditClick,
  onMarkExit,
  readOnly = false,
}: EmployeeViewModalProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [documentCount, setDocumentCount] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitDateInput, setExitDateInput] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [exitReasonCategory, setExitReasonCategory] = useState<string>(EXIT_REASON_OPTIONS[0]);
  const [exitReasonDetails, setExitReasonDetails] = useState("");
  const [isMarkingExit, setIsMarkingExit] = useState(false);
  const employeePhotoUrl = useEmployeePhotoUrl(employee.id, employee.photo);

  const resolvedExitDate = employee.exitDate || (() => {
    if (employee.customFields && Array.isArray(employee.customFields)) {
      const exitField = employee.customFields.find((f) =>
        f.name.toLowerCase().includes("exit") ||
        f.name.toLowerCase().includes("resignation") ||
        f.name.toLowerCase().includes("leaving_date") ||
        f.name.toLowerCase().includes("leaving date"),
      );
      return exitField?.value || "";
    }
    return "";
  })();

  const isEmpExited = !!resolvedExitDate;
  const resolvedExitReason = employee.exitReason?.trim() || "";

  const pfSummary = useMemo(() => {
    const loc = employee.location || "";
    const saved = typeof window !== "undefined" ? localStorage.getItem("hrms_location_compliance") : null;
    const complianceMap = saved ? JSON.parse(saved) : {};
    const savedPt = typeof window !== "undefined" ? localStorage.getItem("hrms_location_pt_enabled") : null;
    const ptMap = savedPt ? JSON.parse(savedPt) : {};
    const isLocCompliant = resolveLocationCompliance(loc, complianceMap);
    const isLocPt = resolveLocationPtEnabled(loc, ptMap);
    const isCompliant = isPfEsicCompliant(employee, complianceMap);
    const isPtEnabled = isProfessionalTaxApplicable(employee, ptMap);
    const gross = Number(employee.grossSalary) || 0;
    const { pfWage, employeePf, employerPf } = calculatePfAmounts(gross, {
      mode: employee.pfCalculationMode,
      isCompliant,
    });
    const pfModeLabel =
      employee.pfCalculationMode === "gross"
        ? "PF on gross salary"
        : "PF with ₹15,000 ceiling";
    return { isLocCompliant, isLocPt, isCompliant, isPtEnabled, gross, pfWage, employeePf, employerPf, pfModeLabel };
  }, [employee]);

  useEffect(() => {
    let cancelled = false;
    void fetchEmployeeDocuments(employee.id)
      .then((docs) => {
        if (!cancelled) setDocumentCount(docs.length);
      })
      .catch(() => {
        if (!cancelled) setDocumentCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [employee.id]);

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

  const handleConfirmMarkExit = async () => {
    if (!onMarkExit || !exitDateInput.trim()) return;

    const reason = buildExitReason(exitReasonCategory, exitReasonDetails);
    if (exitReasonCategory === "Other" && !exitReasonDetails.trim()) {
      alert("Please describe the exit reason when selecting Other.");
      return;
    }

    setIsMarkingExit(true);
    const ok = await onMarkExit(employee, exitDateInput.trim(), reason);
    setIsMarkingExit(false);
    if (ok) onClose();
  };

  const openExitDialog = () => {
    setExitDateInput(new Date().toISOString().split("T")[0]);
    setExitReasonCategory(EXIT_REASON_OPTIONS[0]);
    setExitReasonDetails("");
    setShowExitDialog(true);
  };

  const renderCopyable = (label: string, value: string, fieldName: string, isMono = false) => {
    const formattedValue = value || "—";
    const hasValue = !!value;

    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs text-slate-800 ${isMono ? "font-mono text-[13px] font-medium tracking-wide" : "font-semibold"}`}>
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

  const renderField = (label: string, value: string | number | undefined, isMono = false, highlight = false) => {
    const displayValue = value !== undefined && value !== null && value !== "" ? String(value) : "—";
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className={`text-xs ${highlight ? "font-bold text-slate-900" : "font-medium text-slate-700"} ${isMono ? "font-mono" : ""}`}>
          {displayValue}
        </span>
      </div>
    );
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const overviewQuickFacts = [
    { label: "Role", value: employee.role || "—", icon: <Briefcase size={14} className="text-blue-600" /> },
    { label: "Location", value: employee.location || "—", icon: <MapPin size={14} className="text-rose-500" /> },
    { label: "Mobile", value: employee.employeeMobile || "—", icon: <Phone size={14} className="text-emerald-600" /> },
    { label: "Skill", value: normalizeSkillCategory(employee.skillCategory) || "—", icon: <ShieldCheck size={14} className="text-violet-600" /> },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-hidden animate-fade-in"
      id="employee-view-modal"
    >
      <div
        onClick={handleBackdropClick}
        className="absolute inset-0 cursor-pointer bg-slate-950/50 backdrop-blur-sm"
        aria-hidden
      />
      <div className="relative flex h-full items-center justify-center p-3 sm:p-4 pointer-events-none">
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex h-full max-h-[92vh] w-full max-w-5xl min-h-0 cursor-default flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
        {/* Profile header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#0C1E4A] via-slate-900 to-slate-800 px-5 pb-4 pt-5 text-white sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,121,26,0.18),transparent_55%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <EmployeePhoto
                employeeId={employee.id}
                photo={employee.photo}
                alt={employee.nameAsPerAadhar || "Employee"}
                className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/20 object-cover shadow-lg sm:h-20 sm:w-20"
                fallback={
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#ff791a] text-lg font-black tracking-wide text-white shadow-lg sm:h-20 sm:w-20">
                    {getInitials(employee.nameAsPerAadhar || "EP")}
                  </div>
                }
              />
              <div className="min-w-0 text-left">
                <h2 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
                  {employee.nameAsPerAadhar || "Unnamed Employee"}
                </h2>
                <p className="mt-0.5 text-sm text-slate-300">{employee.role || "No role assigned"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[11px] font-bold text-orange-200">
                    {employee.employeeCode}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
                    SR {employee.srNo}
                  </span>
                  {isEmpExited ? (
                    <span className="rounded-full border border-rose-400/30 bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-200">
                      Exited
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                      Active
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onMarkExit && !isEmpExited && !readOnly && (
                <button
                  onClick={openExitDialog}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-[11px] font-bold text-rose-100 transition hover:bg-rose-500/25"
                  id="mark-exit-from-view-btn"
                  type="button"
                >
                  <LogOut size={14} />
                  Mark Exit
                </button>
              )}
              <button
                onClick={onClose}
                className="cursor-pointer rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                id="close-view-modal-btn"
                type="button"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Gross</p>
              <p className="text-sm font-extrabold text-emerald-300">
                ₹{(employee.grossSalary || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Basic</p>
              <p className="text-sm font-extrabold text-sky-300">
                ₹{(employee.basicSalary || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">ESIC</p>
              <p className="text-sm font-bold text-white">{employee.esic === "Yes" ? "Covered" : "Not covered"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Location</p>
              <p className="truncate text-sm font-bold text-white">{employee.location || "—"}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 sm:px-4">
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

        {/* Tab content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/60 p-4 sm:p-5">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {overviewQuickFacts.map((fact) => (
                  <div key={fact.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">{fact.icon}</div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{fact.label}</p>
                      <p className="truncate text-sm font-bold text-slate-800">{fact.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("documents")}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50/80 to-white p-4 text-left shadow-xs transition hover:border-orange-200 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-[#ff791a]">
                    <FolderOpen size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Employee documents
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {documentCount == null
                        ? "Loading..."
                        : documentCount === 0
                          ? "No documents uploaded"
                          : `${documentCount} document${documentCount === 1 ? "" : "s"} on file`}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-bold text-[#ff791a]">
                  View →
                </span>
              </button>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {renderCopyable("UAN", employee.uan, "uan", true)}
                {renderCopyable("Aadhar", employee.aadharNo, "aadharNo", true)}
                {renderCopyable("Bank A/C", employee.bankAccountNo, "bankAccountNo", true)}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Present address</p>
                  <p className="text-sm leading-relaxed text-slate-700">{employee.presentAddress || "—"}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Permanent address</p>
                  <p className="text-sm leading-relaxed text-slate-700">{employee.permanentAddress || "—"}</p>
                </div>
              </div>

              {employee.customFields && employee.customFields.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Notebook size={14} />
                    Custom fields
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {employee.customFields.slice(0, 6).map((field, idx) => (
                      <div key={idx} className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase text-slate-400">{field.name}</p>
                        <p className="truncate text-xs font-semibold text-slate-800">{field.value || "—"}</p>
                      </div>
                    ))}
                  </div>
                  {employee.customFields.length > 6 && (
                    <p className="mt-2 text-[10px] text-slate-500">
                      +{employee.customFields.length - 6} more in Personal tab
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "personal" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {renderField("Employee Name", employee.nameAsPerAadhar, false, true)}
                {renderField("Father Name", employee.fatherName)}
                {renderField("Husband Name", employee.husbandName)}
                {renderField("Date of Birth", employee.dateOfBirth, true)}
                {renderField("Gender", employee.gender)}
                {renderField("Marital Status", employee.maritalStatus)}
                {renderField("Aadhar Bound Phone", employee.aadharLinkMobNo, true)}
                {renderField("PF Join Date", employee.pfJoiningDate, true)}
                {isEmpExited && renderField("Exit / Leaving Date", resolvedExitDate, true, true)}
                {isEmpExited && resolvedExitReason && renderField("Exit Reason", resolvedExitReason, false, true)}
                {renderField("Skill Category", normalizeSkillCategory(employee.skillCategory))}
                {renderField("Job Role", employee.role)}
                {renderField("Daily Wage", employee.dailyWage ? `Rs. ${employee.dailyWage}` : undefined)}
                {renderField("Employee Mobile", employee.employeeMobile, true)}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Present Address</p>
                  <p className="text-sm leading-relaxed text-slate-700">{employee.presentAddress || "—"}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Permanent Address</p>
                  <p className="text-sm leading-relaxed text-slate-700">{employee.permanentAddress || "—"}</p>
                </div>
              </div>
              {employee.customFields && employee.customFields.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {employee.customFields.map((field, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
                      <span className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {field.name}
                        <span className="rounded bg-slate-100 px-1 text-[8px] font-black text-slate-500">{field.type}</span>
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{field.value || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "payroll" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Gross Salary</p>
                  <p className="mt-1 text-xl font-extrabold text-emerald-800">
                    ₹{(employee.grossSalary || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Basic Salary</p>
                  <p className="mt-1 text-xl font-extrabold text-blue-800">
                    ₹{(employee.basicSalary || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Working Days</p>
                  <p className="mt-2 text-xs font-bold text-slate-800">{employee.workingDaysType || "26 Days (Sun Off)"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">ESIC Coverage</p>
                  <span className={`mt-2 inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase ${
                    employee.esic === "Yes"
                      ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                  }`}>
                    {employee.esic === "Yes" ? "Covered" : "Non-Covered"}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">PF/ESIC & PT</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${
                      employee.complianceEnabled !== false
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                        : "border-rose-200 bg-rose-100 text-rose-800"
                    }`}>
                      Emp PF/ESIC: {employee.complianceEnabled !== false ? "On" : "Off"}
                    </span>
                    <span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${
                      isEmployeePtEnabled(employee)
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                        : "border-rose-200 bg-rose-100 text-rose-800"
                    }`}>
                      Emp PT: {isEmployeePtEnabled(employee) ? "On" : "Off"}
                    </span>
                    <span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${
                      pfSummary.isLocCompliant
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                        : "border-rose-200 bg-rose-100 text-rose-800"
                    }`}>
                      Loc PF/ESIC: {pfSummary.isLocCompliant ? "On" : "Off"}
                    </span>
                    <span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${
                      pfSummary.isLocPt
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                        : "border-rose-200 bg-rose-100 text-rose-800"
                    }`}>
                      Loc PT: {pfSummary.isLocPt ? "On" : "Off"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-violet-800">PF Calculation</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{pfSummary.pfModeLabel}</p>
                {pfSummary.isCompliant && pfSummary.gross > 0 && (
                  <p className="mt-2 text-xs text-slate-600">
                    PF wage ₹{pfSummary.pfWage.toLocaleString("en-IN")} · Employee PF ₹{pfSummary.employeePf.toLocaleString("en-IN")} · Employer PF ₹{pfSummary.employerPf.toLocaleString("en-IN")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {renderField("Previous UAN", employee.previousUanNo, true)}
                {renderField("Previous ESIC No.", employee.previousEsicNo, true)}
              </div>
            </div>
          )}

          {activeTab === "statutory" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {renderCopyable("UAN PIN", employee.uan, "uan", true)}
              {renderCopyable("Aadhar Number", employee.aadharNo, "aadharNo", true)}
              {renderCopyable("PAN Number", employee.panNo, "panNo", true)}
              {renderCopyable("Name as per Aadhar", employee.nameAsPerAadharColumn, "nameAsPerAadhar")}
              {renderCopyable("Name as per PAN", employee.nameAsPerPan, "nameAsPerPan")}
              {renderCopyable("Bank Account", employee.bankAccountNo, "bankAccountNo", true)}
              {renderCopyable("IFSC Code", employee.ifscCode, "ifscCode", true)}
              {renderCopyable("Name as per Bank", employee.nameAsPerBank, "nameAsPerBank")}
            </div>
          )}

          {activeTab === "family" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-900">Primary Nominee</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {renderField("Nominee Name", employee.nomineeName, false, true)}
                  {renderField("Date of Birth", employee.nomineeDob, true)}
                  {renderField("Relation", employee.nomineeRelation)}
                  {renderField("Mobile", employee.nomineeMobile, true)}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Family Members</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
                  {renderField("Member 1", employee.familyMember1Name)}
                  {renderField("DOB", employee.familyMember1Dob, true)}
                  {renderField("Relation", employee.familyMember1Relation)}
                  {renderField("Mobile", employee.familyMember1Mobile, true)}
                </div>
                {(employee.familyMember2Name || employee.familyMember2Relation) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
                    {renderField("Member 2", employee.familyMember2Name)}
                    {renderField("DOB", employee.familyMember2Dob, true)}
                    {renderField("Relation", employee.familyMember2Relation)}
                    {renderField("Mobile", employee.familyMember2Mobile, true)}
                  </div>
                )}
                {(employee.familyMember3Name || employee.familyMember3Relation) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
                    {renderField("Member 3", employee.familyMember3Name)}
                    {renderField("DOB", employee.familyMember3Dob, true)}
                    {renderField("Relation", employee.familyMember3Relation)}
                    {renderField("Mobile", employee.familyMember3Mobile, true)}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "idcard" && (
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs" id="employee-id-card-section">
              <IdCardPanel employee={employee} photoUrl={employeePhotoUrl} />
            </div>
          )}

          {activeTab === "documents" && (
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
              <EmployeeDocumentsPanel employeeId={employee.id} readOnly />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {onEditClick && !readOnly && (
              <button
                onClick={() => onEditClick(employee)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#ff791a] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#e56a12]"
                id="edit-from-view-btn"
                type="button"
              >
                <Edit size={14} />
                Edit Employee
              </button>
            )}
            {isEmpExited && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                <Calendar size={12} className="text-rose-500" />
                Exited {resolvedExitDate}
                {resolvedExitReason ? ` · ${resolvedExitReason}` : ""}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            id="close-footer-view-btn"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
      </div>

      {showExitDialog && onMarkExit && !readOnly && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => !isMarkingExit && setShowExitDialog(false)}
            aria-hidden
          />
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Mark employee as exited</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Record the leaving date and reason for {employee.nameAsPerAadhar || employee.employeeCode}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExitDialog(false)}
                disabled={isMarkingExit}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="view-modal-exit-date"
                  className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  Exit / leaving date
                </label>
                <input
                  type="date"
                  id="view-modal-exit-date"
                  value={exitDateInput}
                  onChange={(e) => setExitDateInput(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>

              <div>
                <label
                  htmlFor="view-modal-exit-reason"
                  className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  Reason for exit
                </label>
                <select
                  id="view-modal-exit-reason"
                  value={exitReasonCategory}
                  onChange={(e) => setExitReasonCategory(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                >
                  {EXIT_REASON_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="view-modal-exit-details"
                  className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  {exitReasonCategory === "Other" ? "Details (required)" : "Additional notes (optional)"}
                </label>
                <textarea
                  id="view-modal-exit-details"
                  value={exitReasonDetails}
                  onChange={(e) => setExitReasonDetails(e.target.value)}
                  rows={3}
                  placeholder={
                    exitReasonCategory === "Other"
                      ? "Describe why the employee is leaving..."
                      : "Any extra context about the separation..."
                  }
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExitDialog(false)}
                disabled={isMarkingExit}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMarkExit}
                disabled={
                  isMarkingExit ||
                  !exitDateInput.trim() ||
                  (exitReasonCategory === "Other" && !exitReasonDetails.trim())
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                id="confirm-mark-exit-btn"
              >
                <LogOut size={14} />
                {isMarkingExit ? "Saving..." : "Confirm Exit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
