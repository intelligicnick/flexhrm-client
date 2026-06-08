/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, User, DollarSign, Notebook, ShieldAlert, Key, Clipboard, CheckCircle, Edit } from "lucide-react";
import { Employee } from "../types";
import { normalizeSkillCategory, calculatePfAmounts } from "../utils";

interface EmployeeViewModalProps {
  employee: Employee;
  onClose: () => void;
  onEditClick?: (employee: Employee) => void;
}

export default function EmployeeViewModal({ employee, onClose, onEditClick }: EmployeeViewModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const resolvedExitDate = employee.exitDate || (() => {
    if (employee.customFields && Array.isArray(employee.customFields)) {
      const exitField = employee.customFields.find(f => 
        f.name.toLowerCase().includes("exit") || 
        f.name.toLowerCase().includes("resignation") || 
        f.name.toLowerCase().includes("leaving_date") ||
        f.name.toLowerCase().includes("leaving date")
      );
      return exitField?.value || "";
    }
    return "";
  })();

  const isEmpExited = !!resolvedExitDate;

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  // Helper to render copyable value
  const renderCopyable = (label: string, value: string, fieldName: string, isMono = false) => {
    const formattedValue = value || "—";
    const hasValue = !!value;

    return (
      <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100 flex flex-col justify-between group relative">
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</span>
        <div className="flex items-center justify-between gap-1">
          <span className={`text-xs text-slate-800 ${isMono ? "font-mono font-medium text-[13px] tracking-wide" : "font-semibold"}`}>
            {formattedValue}
          </span>
          {hasValue && (
            <button
              onClick={() => handleCopy(value, fieldName)}
              className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-slate-100 transition cursor-pointer"
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

  // Helper for regular simple fields
  const renderField = (label: string, value: string | number | undefined, isMono = false, highlight = false) => {
    const displayValue = value !== undefined && value !== null && value !== "" ? String(value) : "—";
    return (
      <div className="bg-slate-50/20 rounded-lg p-2.5 border border-slate-100/50 flex flex-col justify-between">
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">{label}</span>
        <span className={`text-xs ${highlight ? "text-slate-900 font-bold" : "text-slate-700 font-medium"} ${isMono ? "font-mono" : ""}`}>
          {displayValue}
        </span>
      </div>
    );
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div 
      onClick={handleBackdropClick} 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-fade-in cursor-pointer" 
      id="employee-view-modal"
    >
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 cursor-default">
        
        {/* Header Ribbon */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm tracking-widest text-white shadow-inner uppercase">
              {employee.nameAsPerAadhar ? employee.nameAsPerAadhar.split(" ").slice(0, 2).map(n => n[0]).join("") : "EP"}
            </div>
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-left">
                <span className="text-sm font-bold tracking-tight text-slate-100 truncate max-w-[180px] sm:max-w-xs md:max-w-none block">{employee.nameAsPerAadhar}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-slate-800 text-blue-300 font-mono text-[10px] font-bold rounded-md border border-slate-700 shrink-0">
                    {employee.employeeCode}
                  </span>
                  <span className="px-2.5 py-0.5 bg-slate-800 text-emerald-400 text-[10px] font-medium rounded-full border border-slate-705 shrink-0">
                    SR NO: {employee.srNo}
                  </span>
                  {isEmpExited ? (
                    <span className="px-2.5 py-0.5 bg-rose-900/50 text-rose-300 text-[10px] font-bold rounded-full border border-rose-700 tracking-wide uppercase shrink-0">
                      Exited
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-emerald-950/50 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-800 tracking-wide uppercase shrink-0">
                      Active
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 text-left">
                <span>Location:</span>
                <span className="font-semibold text-slate-300">{employee.location || "N/A"}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            id="close-view-modal-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/30">
          
          {/* Section 1: Core Personal & Demographic Details */}
          <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2 pb-2 border-b border-slate-100">
              <User size={15} className="text-blue-600" />
              General & Personal Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {renderField("Employee Name", employee.nameAsPerAadhar, false, true)}
              {renderField("Father Name", employee.fatherName)}
              {renderField("Husband Name", employee.husbandName)}
              {renderField("Date of Birth", employee.dateOfBirth, true)}
              {renderField("Gender", employee.gender)}
              {renderField("Marital Status", employee.maritalStatus)}
              {renderField("Aadhar Bound Phone", employee.aadharLinkMobNo, true)}
              {renderField("PF Join Date", employee.pfJoiningDate, true)}
              {isEmpExited && renderField("Exit / Leaving Date", resolvedExitDate, true, true)}
              {renderField("Skill Category", normalizeSkillCategory(employee.skillCategory))}
              {renderField("Job Role", employee.role)}
              {renderField("Daily Wage", employee.dailyWage ? `Rs. ${employee.dailyWage}` : undefined)}
              {renderField("Employee Mobile", employee.employeeMobile, true)}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="bg-slate-50/20 rounded-lg p-2.5 border border-slate-100/50">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5 block">Present Address</span>
                <p className="text-xs text-slate-750 font-medium leading-relaxed">{employee.presentAddress || "—"}</p>
              </div>
              <div className="bg-slate-50/20 rounded-lg p-2.5 border border-slate-100/50">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5 block">Permanent Address</span>
                <p className="text-xs text-slate-750 font-medium leading-relaxed">{employee.permanentAddress || "—"}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Financial Details & ESIC Status */}
          <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2 pb-2 border-b border-slate-100">
              <DollarSign size={15} className="text-emerald-600" />
              Compensation & Statutory ESIC/EPF
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-emerald-50/30 border border-emerald-100 rounded-lg p-3 flex flex-col justify-between">
                <span className="text-[10px] text-emerald-700 font-black uppercase tracking-wider mb-1">Gross Salary</span>
                <span className="text-base font-extrabold text-emerald-800">
                  Rs. {employee.grossSalary ? employee.grossSalary.toLocaleString("en-IN") : "0"}
                </span>
              </div>

              <div className="bg-blue-50/30 border border-blue-100 rounded-lg p-3 flex flex-col justify-between">
                <span className="text-[10px] text-blue-700 font-black uppercase tracking-wider mb-1">Basic Salary</span>
                <span className="text-base font-extrabold text-blue-800">
                  Rs. {employee.basicSalary ? employee.basicSalary.toLocaleString("en-IN") : "0"}
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 flex flex-col justify-between border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">ESIC Coverage Status</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded text-[10px] font-black tracking-wide border uppercase ${
                    employee.esic === "Yes" ? "bg-emerald-100 border-emerald-200 text-emerald-800" : "bg-slate-100 border-slate-200 text-slate-605"
                  }`}>
                    {employee.esic === "Yes" ? "Covered" : "Non-Covered"}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Auto-Calculated</span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 flex flex-col justify-between border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Working Days Cycle</span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`px-2.5 py-1 rounded text-[10px] font-black tracking-wide border uppercase ${
                    employee.workingDaysType === "22 Days (Sat/Sun Off)"
                      ? "bg-indigo-100 border-indigo-200 text-indigo-800"
                      : employee.workingDaysType === "30/31 Days (No Off)"
                      ? "bg-rose-100 border-rose-200 text-rose-800"
                      : "bg-amber-105 border-amber-200 text-amber-800"
                  }`}>
                    {employee.workingDaysType || "26 Days (Sun Off)"}
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 flex flex-col justify-between border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Compliance (PF/ESIC/PT)</span>
                <div className="flex flex-col gap-1 mt-1">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wide border uppercase self-start ${
                    employee.complianceEnabled !== false
                      ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                      : "bg-rose-100 border-rose-200 text-rose-800"
                  }`}>
                    Emp: {employee.complianceEnabled !== false ? "Enabled" : "Disabled"}
                  </span>
                  {(() => {
                    const loc = employee.location || "";
                    const saved = typeof window !== 'undefined' ? localStorage.getItem("hrms_location_compliance") : null;
                    const complianceMap = saved ? JSON.parse(saved) : {};
                    const isLocCompliant = loc ? !!complianceMap[loc] : false;
                    return (
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wide border uppercase self-start ${
                        isLocCompliant
                          ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                          : "bg-rose-100 border-rose-200 text-rose-800"
                      }`}>
                        Loc: {isLocCompliant ? "Enabled" : "Disabled"}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {(() => {
              const loc = employee.location || "";
              const saved = typeof window !== "undefined" ? localStorage.getItem("hrms_location_compliance") : null;
              const complianceMap = saved ? JSON.parse(saved) : {};
              const isLocCompliant = loc ? !!complianceMap[loc] : false;
              const isCompliant = isLocCompliant && employee.complianceEnabled !== false;
              const gross = Number(employee.grossSalary) || 0;
              const { pfWage, employeePf, employerPf } = calculatePfAmounts(gross, {
                mode: employee.pfCalculationMode,
                isCompliant,
              });
              const pfModeLabel =
                employee.pfCalculationMode === "gross"
                  ? "PF on gross salary"
                  : "PF with ₹15,000 ceiling";
              return (
                <div className="mt-3 p-3 rounded-lg border border-violet-100 bg-violet-50/40">
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-800 mb-1">PF Calculation</p>
                  <p className="text-xs font-semibold text-slate-700">{pfModeLabel}</p>
                  {isCompliant && gross > 0 && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      On ₹{gross.toLocaleString("en-IN")} gross: PF wage ₹{pfWage.toLocaleString("en-IN")} · Employee PF ₹{employeePf.toLocaleString("en-IN")} · Employer PF ₹{employerPf.toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              );
            })()}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {renderField("Previous Pension Scheme UAN", employee.previousUanNo, true)}
              {renderField("Previous ESIC Reference Number", employee.previousEsicNo, true)}
            </div>
          </div>

          {/* Section 3: Statutory IDs & Bank details (Highly Copyable) */}
          <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Key size={15} className="text-amber-600" />
              Statutory Credentials & Banking Details (Click Clipboard to copy)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {renderCopyable("UAN PIN", employee.uan, "uan", true)}
              {renderCopyable("Aadhar Card Number", employee.aadharNo, "aadharNo", true)}
              {renderCopyable("PAN Card Number", employee.panNo, "panNo", true)}
              {renderCopyable("Name as per Aadhar", employee.nameAsPerAadharColumn, "nameAsPerAadhar")}
              {renderCopyable("Name as per PAN", employee.nameAsPerPan, "nameAsPerPan")}
              {renderCopyable("Bank Account Number", employee.bankAccountNo, "bankAccountNo", true)}
              {renderCopyable("IFSC Code", employee.ifscCode, "ifscCode", true)}
              {renderCopyable("Name as per Bank", employee.nameAsPerBank, "nameAsPerBank")}
            </div>
          </div>

          {/* Section 4: Nominals & Family Declarations */}
          <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Notebook size={15} className="text-purple-600" />
              Nominees & Family Declarations
            </h3>
            
            <div className="bg-blue-50/20 border border-blue-100/50 rounded-xl p-3 mb-4">
              <div className="text-xs font-bold text-blue-900 mb-2.5 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                Primary Nominee Info (First-Line ESIC Beneficiary)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {renderField("Nominee Name", employee.nomineeName, false, true)}
                {renderField("Nominee Date of Birth", employee.nomineeDob, true)}
                {renderField("Nominee Relation", employee.nomineeRelation)}
                {renderField("Nominee Mobile", employee.nomineeMobile, true)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                Family Members / Dependents
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                {renderField("Family Member 1", employee.familyMember1Name)}
                {renderField("DOB Member 1", employee.familyMember1Dob, true)}
                {renderField("Relation Member 1", employee.familyMember1Relation)}
                {renderField("Mobile Member 1", employee.familyMember1Mobile, true)}
              </div>

              {(employee.familyMember2Name || employee.familyMember2Relation) && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                  {renderField("Family Member 2", employee.familyMember2Name)}
                  {renderField("DOB Member 2", employee.familyMember2Dob, true)}
                  {renderField("Relation Member 2", employee.familyMember2Relation)}
                  {renderField("Mobile Member 2", employee.familyMember2Mobile, true)}
                </div>
              )}

              {(employee.familyMember3Name || employee.familyMember3Relation) && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                  {renderField("Family Member 3", employee.familyMember3Name)}
                  {renderField("DOB Member 3", employee.familyMember3Dob, true)}
                  {renderField("Relation Member 3", employee.familyMember3Relation)}
                  {renderField("Mobile Member 3", employee.familyMember3Mobile, true)}
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Dynamic Custom Attributes */}
          {employee.customFields && employee.customFields.length > 0 && (
            <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-xs" id="custom-attributes-view-section">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2 pb-2 border-b border-slate-100">
                <Notebook size={15} className="text-slate-600" />
                Custom Attributes & Custom Fields
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {employee.customFields.map((field, idx) => (
                  <div key={idx} className="bg-slate-50/50 rounded-lg p-3 border border-slate-100 flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      {field.name}
                      <span className="text-[8px] bg-slate-100 text-slate-500 border border-slate-205 uppercase px-1 rounded font-black tracking-wide">
                        {field.type}
                      </span>
                    </span>
                    <span className="text-xs text-slate-800 font-semibold truncate">
                      {field.value || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div>
            {onEditClick && (
              <button
                onClick={() => onEditClick(employee)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-xs hover:shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                id="edit-from-view-btn"
              >
                <Edit size={14} />
                Edit Employee Details
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white text-xs font-bold rounded-lg shadow-xs hover:shadow-sm transition cursor-pointer"
            id="close-footer-view-btn"
          >
            Close Personal Dossier
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
