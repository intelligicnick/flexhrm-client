/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, Calculator, UserCheck, CreditCard, Users, Link, MapPin, Plus } from "lucide-react";
import { Employee } from "../types";
import {
  calculateSalaryDetails,
  validateEmployee,
  normalizeSkillCategory,
  calculatePfAmounts,
  resolvePfCalculationMode,
  DEFAULT_LOCATION_PT_AMOUNT,
  parseLocationPtInput,
} from "../utils";

interface EmployeeFormModalProps {
  employee?: Employee | null; // null if adding
  onClose: () => void;
  onSave: (empData: Partial<Employee>) => Promise<boolean>;
  availableLocations?: string[];
  availableRoles?: string[];
  basicSalaryPercent?: number;
  esicEligibilityLimit?: number;
  onLocationRegistryUpdate?: () => void;
  onCreateLocation?: (name: string, complianceEnabled: boolean, ptAmount: number) => Promise<void>;
  onCreateRole?: (name: string) => Promise<void>;
}

type FormTab = "basic" | "identity" | "bank" | "dependents" | "custom";

export default function EmployeeFormModal({
  employee,
  onClose,
  onSave,
  availableLocations,
  availableRoles,
  basicSalaryPercent = 50,
  esicEligibilityLimit = 21000,
  onLocationRegistryUpdate,
  onCreateLocation,
  onCreateRole,
}: EmployeeFormModalProps) {
  const isEdit = !!employee;
  const [activeTab, setActiveTab] = useState<FormTab>("basic");
  
  // Custom locations state
  const [localLocations, setLocalLocations] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showAddLocationInput, setShowAddLocationInput] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");

  // Custom roles state
  const [localRoles, setLocalRoles] = useState<string[]>([]);
  const [roleSearchFocused, setRoleSearchFocused] = useState(false);
  const [showAddRoleInput, setShowAddRoleInput] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  useEffect(() => {
    const presets = [
      "Mumbai Main Office",
      "Delhi Branch Office",
      "Bangalore R&D Center",
      "Pune Tech Park",
      "Chennai Operational Hub",
      "Hyderabad Global Center",
      "Kolkata Zonal Hub"
    ];
    const propLocs = availableLocations || [];
    const merged = Array.from(new Set([...presets, ...propLocs]));
    setLocalLocations(merged);
  }, [availableLocations]);

  useEffect(() => {
    const presets = [
      "Driver",
      "Guard",
      "Supervisor",
      "Helper",
      "Operator",
      "Plumber",
      "Electrician"
    ];
    const propRoles = availableRoles || [];
    const merged = Array.from(new Set([...presets, ...propRoles]));
    setLocalRoles(merged);
  }, [availableRoles]);

  // Form State
  const [formData, setFormData] = useState<Partial<Employee>>({
    employeeCode: "",
    location: "Mumbai Main Office",
    nameAsPerAadhar: "",
    grossSalary: 0,
    basicSalary: 0,
    esic: "No",
    complianceEnabled: true,
    pfCalculationMode: "ceiling_15000",
    uan: "",
    aadharNo: "",
    nameAsPerAadharColumn: "",
    panNo: "",
    nameAsPerPan: "",
    bankAccountNo: "",
    ifscCode: "",
    nameAsPerBank: "",
    fatherName: "",
    husbandName: "",
    pfJoiningDate: new Date().toISOString().split("T")[0],
    exitDate: "",
    dateOfBirth: "",
    gender: "Male",
    maritalStatus: "Single",
    aadharLinkMobNo: "",
    previousUanNo: "",
    previousEsicNo: "",
    presentAddress: "",
    permanentAddress: "",
    nomineeName: "",
    nomineeDob: "",
    nomineeRelation: "",
    familyMember1Name: "",
    familyMember1Dob: "",
    familyMember1Relation: "",
    familyMember2Name: "",
    familyMember2Dob: "",
    familyMember2Relation: "",
    familyMember3Name: "",
    familyMember3Dob: "",
    familyMember3Relation: "",
    workingDaysType: "26 Days (Sun Off)",
    skillCategory: "Skilled",
    role: "Driver",
    dailyWage: 0,
    employeeMobile: "",
    nomineeMobile: "",
    familyMember1Mobile: "",
    familyMember2Mobile: "",
    familyMember3Mobile: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Custom fields helper state
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");

  // Location compliance maps
  const [locationCompliance, setLocationCompliance] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("hrms_location_compliance");
    return saved ? JSON.parse(saved) : {};
  });
  const [newLocationCompliance, setNewLocationCompliance] = useState(true);
  const [newLocationPtAmount, setNewLocationPtAmount] = useState(String(DEFAULT_LOCATION_PT_AMOUNT));

  const resetQuickAddLocationForm = () => {
    setShowAddLocationInput(false);
    setNewLocationName("");
    setNewLocationCompliance(true);
    setNewLocationPtAmount(String(DEFAULT_LOCATION_PT_AMOUNT));
  };

  const openQuickAddLocation = (prefill = "") => {
    setShowAddLocationInput(true);
    setNewLocationName(prefill);
    setNewLocationCompliance(true);
    setNewLocationPtAmount(String(DEFAULT_LOCATION_PT_AMOUNT));
    setSearchFocused(false);
  };

  const commitQuickAddLocation = async (rawName: string): Promise<boolean> => {
    const val = rawName.trim();
    if (!val) return false;

    const ptVal = parseLocationPtInput(newLocationPtAmount);
    await onCreateLocation?.(val, newLocationCompliance, ptVal);
    setLocationCompliance((prev) => ({ ...prev, [val]: newLocationCompliance }));

    setLocalLocations((prev) => Array.from(new Set([...prev, val])));
    setFormData((prev) => ({ ...prev, location: val }));
    onLocationRegistryUpdate?.();
    resetQuickAddLocationForm();
    return true;
  };

  // Dynamic search select computations for location list
  const currentTyped = formData.location || "";
  const filteredLocs = localLocations.filter(loc => 
    loc.toLowerCase().includes(currentTyped.toLowerCase())
  );
  const isNotInList = currentTyped.trim() !== "" && !localLocations.some(l => l.toLowerCase() === currentTyped.trim().toLowerCase());

  // Dynamic search select computations for role list
  const currentRoleTyped = formData.role || "";
  const filteredRoles = localRoles.filter(r => 
    r.toLowerCase().includes(currentRoleTyped.toLowerCase())
  );

  const commitQuickAddRole = async (rawName: string): Promise<boolean> => {
    const val = rawName.trim();
    if (!val) return false;
    await onCreateRole?.(val);
    setLocalRoles(prev => Array.from(new Set([...prev, val])));
    setFormData(prev => ({ ...prev, role: val }));
    setShowAddRoleInput(false);
    setNewRoleName("");
    return true;
  };

  // Load existing employee
  useEffect(() => {
    if (employee) {
      setFormData({
        ...employee,
        skillCategory: normalizeSkillCategory(employee.skillCategory) || "Skilled",
        pfCalculationMode: employee.pfCalculationMode || "ceiling_15000",
      });
    }
  }, [employee]);

  // Handle standard field change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // Intelligently auto-populate empty names as they type the primary name
      if (name === "nameAsPerAadhar") {
        if (!prev.nameAsPerAadharColumn) updated.nameAsPerAadharColumn = value;
        if (!prev.nameAsPerPan) updated.nameAsPerPan = value;
        if (!prev.nameAsPerBank) updated.nameAsPerBank = value;
      }

      return updated;
    });

    // Clear error for field as they edit
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const getWorkingDaysCount = (cycle: string | undefined): number => {
    if (!cycle) return 26;
    const match = cycle.match(/(\d+)\s*Days?/i);
    if (match) return parseInt(match[1]);
    if (cycle.includes("22")) return 22;
    if (cycle.includes("26")) return 26;
    if (cycle.includes("30") || cycle.includes("31")) return 30;
    return 26;
  };

  // Automated Salary Calculators
  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const gross = parseFloat(e.target.value) || 0;
    const workingDays = getWorkingDaysCount(formData.workingDaysType);
    const daily = workingDays > 0 ? parseFloat((gross / workingDays).toFixed(2)) : 0;
    const { basic, esic } = calculateSalaryDetails(gross, basicSalaryPercent, esicEligibilityLimit);

    setFormData((prev) => ({
      ...prev,
      grossSalary: gross,
      dailyWage: daily,
      basicSalary: basic,
      esic: esic,
    }));

    if (errors.grossSalary) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.grossSalary;
        delete copy.basicSalary;
        return copy;
      });
    }
  };

  const handleDailyWageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const daily = parseFloat(e.target.value) || 0;
    const workingDays = getWorkingDaysCount(formData.workingDaysType);
    const gross = Math.round(daily * workingDays);
    const { basic, esic } = calculateSalaryDetails(gross, basicSalaryPercent, esicEligibilityLimit);

    setFormData((prev) => ({
      ...prev,
      dailyWage: daily,
      grossSalary: gross,
      basicSalary: basic,
      esic: esic,
    }));

    if (errors.grossSalary) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.grossSalary;
        delete copy.basicSalary;
        return copy;
      });
    }
  };

  const handleWorkingDaysChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cycle = e.target.value;
    const workingDays = getWorkingDaysCount(cycle);
    const gross = formData.grossSalary || 0;
    const daily = workingDays > 0 ? parseFloat((gross / workingDays).toFixed(2)) : 0;

    setFormData((prev) => ({
      ...prev,
      workingDaysType: cycle,
      dailyWage: daily,
    }));
  };

  // Toggle present/permanent address copy
  const handleCopyAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    if (formData.presentAddress) {
      setFormData((prev) => ({
        ...prev,
        permanentAddress: prev.presentAddress,
      }));
      if (errors.permanentAddress) {
        setErrors((prev) => {
          const copy = { ...prev };
          delete copy.permanentAddress;
          return copy;
        });
      }
    }
  };
  
  // Custom Fields Actions
  const handleCustomFieldValueChange = (index: number, val: string) => {
    setFormData((prev) => {
      const fields = [...(prev.customFields || [])];
      fields[index] = { ...fields[index], value: val };
      return { ...prev, customFields: fields };
    });
  };

  const handleAddCustomField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    const currentFields = formData.customFields || [];
    if (currentFields.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      alert("A custom field with this name already exists!");
      return;
    }
    const updated = [...currentFields, { name, type: newFieldType, value: "" }];
    setFormData((prev) => ({ ...prev, customFields: updated }));
    setNewFieldName("");
  };

  const handleRemoveCustomField = (index: number) => {
    const currentFields = formData.customFields || [];
    const updated = currentFields.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, customFields: updated }));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateEmployee(formData);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Automatically switch to the tab that contains the first error to guide users!
      if (
        validationErrors.employeeCode ||
        validationErrors.grossSalary ||
        validationErrors.basicSalary
      ) {
        setActiveTab("basic");
      } else if (
        validationErrors.nameAsPerAadhar ||
        validationErrors.aadharNo ||
        validationErrors.nameAsPerAadharColumn ||
        validationErrors.gender ||
        validationErrors.maritalStatus ||
        validationErrors.fatherName ||
        validationErrors.aadharLinkMobNo
      ) {
        setActiveTab("identity");
      } else if (
        validationErrors.bankAccountNo ||
        validationErrors.ifscCode ||
        validationErrors.nameAsPerBank ||
        validationErrors.presentAddress ||
        validationErrors.permanentAddress
      ) {
        setActiveTab("bank");
      }
      return;
    }

    setIsSubmitting(true);
    const success = await onSave(formData);
    setIsSubmitting(false);
    if (success) onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div 
      onClick={handleBackdropClick} 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer" 
      id="employee-form-modal"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden cursor-default">
        
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50 gap-2">
          <div className="text-left">
            <h3 className="font-extrabold text-slate-800 text-sm md:text-lg leading-tight" id="modal-header-heading">
              {isEdit ? `Edit Profile Checklist: ${employee.employeeCode}` : "Onboard New Employee"}
            </h3>
            <p className="text-[10px] md:text-xs text-slate-500 mt-1 leading-tight">
              Fields with <span className="text-red-500 font-bold">*</span> are required for statutory ECR compliance.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-150 hover:text-slate-600 transition shrink-0"
            id="close-form-modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection Header */}
        <div className="flex border-b border-slate-150 bg-slate-50/50 p-1 px-4 gap-1 overflow-x-auto shrink-0 select-none" id="form-tab-headers">
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === "basic"
                ? "border-blue-600 text-blue-600 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            id="tab-btn-basic"
          >
            <Calculator size={15} />
            Corporate & Salary
            {Object.keys(errors).some((k) => ["employeeCode", "grossSalary", "basicSalary"].includes(k)) && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("identity")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === "identity"
                ? "border-blue-600 text-blue-600 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            id="tab-btn-identity"
          >
            <UserCheck size={15} />
            Identity & Personal
            {Object.keys(errors).some((k) =>
              ["nameAsPerAadhar", "aadharNo", "nameAsPerAadharColumn", "gender", "maritalStatus", "fatherName", "aadharLinkMobNo"].includes(k)
            ) && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bank")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === "bank"
                ? "border-blue-600 text-blue-600 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            id="tab-btn-bank"
          >
            <CreditCard size={15} />
            Banking & Address
            {Object.keys(errors).some((k) =>
              ["bankAccountNo", "ifscCode", "nameAsPerBank", "presentAddress", "permanentAddress"].includes(k)
            ) && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dependents")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === "dependents"
                ? "border-blue-600 text-blue-600 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            id="tab-btn-dependents"
          >
            <Users size={15} />
            Nominee & Dependents
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === "custom"
                ? "border-blue-600 text-blue-600 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            id="tab-btn-custom"
          >
            <Plus size={15} />
            Custom Fields
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6" id="onboard-employee-form">
          
          {/* TAB 1: BASIC & CORPORATE SALARY */}
          {activeTab === "basic" && (
            <div className="space-y-5 animate-fade-in" id="basic-fields-group">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Employee Code <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    name="employeeCode"
                    value={formData.employeeCode}
                    onChange={handleChange}
                    placeholder="e.g. EMP404"
                    disabled={isEdit}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition disabled:bg-slate-50 disabled:text-slate-400"
                    id="field-emp-code"
                  />
                  {errors.employeeCode && (
                    <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.employeeCode}</span>
                  )}
                </div>

                <div className={`relative min-w-0 ${showAddLocationInput ? "md:col-span-2" : ""}`}>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Work Location</label>
                  
                  {!showAddLocationInput ? (
                    <div className="flex items-stretch gap-1.5">
                      <div className="relative flex-1 min-w-0">
                        <input
                          type="text"
                          name="location"
                          value={formData.location || ""}
                          onChange={handleChange}
                          onFocus={() => setSearchFocused(true)}
                          placeholder="Search or select location..."
                          className="w-full pl-3 pr-8 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                          id="field-location"
                          autoComplete="off"
                        />
                        <span className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none z-10">
                          <MapPin size={12} />
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          openQuickAddLocation("");
                        }}
                        className="px-3 bg-white hover:bg-orange-50 border border-slate-250 hover:border-orange-300 active:bg-orange-100/50 rounded text-orange-600 flex items-center justify-center transition cursor-pointer shrink-0"
                        id="btn-add-location-toggle"
                        title="Add a new branch office"
                      >
                        <Plus size={15} className="stroke-[2.5]" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="rounded-xl border border-orange-200 bg-gradient-to-b from-orange-50/80 to-white p-3 space-y-3 shadow-sm animate-fade-in"
                      id="quick-add-location-panel"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                          <MapPin size={14} />
                        </span>
                        <div>
                          <p className="text-[11px] font-black text-slate-700 uppercase tracking-wide">New branch office</p>
                          <p className="text-[10px] text-slate-500 leading-snug">Saved to registry with compliance &amp; PT settings</p>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Enter office location name..."
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitQuickAddLocation(newLocationName);
                          } else if (e.key === "Escape") {
                            resetQuickAddLocationForm();
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-250 bg-white text-xs text-slate-800 rounded-lg placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
                        id="new-location-name-input-field"
                        autoFocus
                      />

                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 space-y-2.5">
                        <label htmlFor="inline-new-loc-compliance" className="flex items-start gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            id="inline-new-loc-compliance"
                            checked={newLocationCompliance}
                            onChange={(e) => setNewLocationCompliance(e.target.checked)}
                            className="mt-0.5 w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer shrink-0"
                          />
                          <span className="text-[11px] font-bold text-slate-650 leading-snug">
                            Enable Compliance (PF, ESIC, PT)
                          </span>
                        </label>
                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                          <label htmlFor="inline-new-loc-pt" className="text-[11px] font-bold text-slate-650 whitespace-nowrap">
                            Professional Tax (₹)
                          </label>
                          <input
                            type="number"
                            id="inline-new-loc-pt"
                            min={0}
                            step={1}
                            value={newLocationPtAmount}
                            onChange={(e) => setNewLocationPtAmount(e.target.value)}
                            className="w-24 px-2 py-1 border border-slate-250 bg-white text-xs font-semibold text-slate-800 rounded focus:outline-none focus:border-orange-500 text-right"
                            title="PT deducted when monthly gross exceeds ₹10,000"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-snug">
                          PT applies per location when gross salary is above ₹10,000 for the month.
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            resetQuickAddLocationForm();
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] rounded-lg border border-slate-200 transition cursor-pointer"
                          id="btn-cancel-new-location"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!newLocationName.trim()}
                          onClick={(e) => {
                            e.preventDefault();
                            commitQuickAddLocation(newLocationName);
                          }}
                          className="px-3.5 py-1.5 bg-[#f57416] hover:bg-[#e4640c] disabled:opacity-40 text-white font-bold text-[11px] rounded-lg shadow-sm flex items-center gap-1 transition cursor-pointer"
                          id="btn-confirm-new-location"
                        >
                          <Check size={13} className="stroke-[3]" /> Add Branch
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dropdown Options Box */}
                  {!showAddLocationInput && searchFocused && (
                    <>
                      {/* Invisible backdrop to dismiss dropdown cleanly */}
                      <div 
                        className="fixed inset-0 z-40 bg-transparent cursor-default" 
                        onMouseDown={() => setSearchFocused(false)}
                      />
                      
                      <div className="absolute left-0 mt-1 w-full max-h-[175px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 divide-y divide-slate-50 animate-fade-in text-xs">
                        {filteredLocs.length > 0 ? (
                          filteredLocs.map((loc, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, location: loc }));
                                setSearchFocused(false);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 active:bg-slate-100 font-medium transition flex items-center justify-between"
                            >
                              <span>{loc}</span>
                              {formData.location?.toLowerCase() === loc.toLowerCase() && (
                                <Check size={12} className="text-blue-600 stroke-[3]" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-slate-400 italic text-center">No search match found</div>
                        )}
                        
                        <div className="p-1 text-center bg-slate-50 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              openQuickAddLocation(currentTyped);
                            }}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold transition flex items-center justify-center gap-1 mx-auto"
                          >
                            <Plus size={10} className="stroke-[3]" /> Add new custom option ...
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Corporate PF Joining Date</label>
                  <input
                    type="date"
                    name="pfJoiningDate"
                    value={formData.pfJoiningDate}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                    id="field-pf-joining-date"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Exit / Leaving Date</label>
                  <input
                    type="date"
                    name="exitDate"
                    value={formData.exitDate || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                    id="field-exit-date"
                  />
                </div>
              </div>

              {/* Skill and Job Role Symmetrical Block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Skill Category</label>
                  <select
                    name="skillCategory"
                    value={normalizeSkillCategory(formData.skillCategory) || "Skilled"}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition cursor-pointer font-semibold"
                    id="field-skill-category"
                  >
                    <option value="Highly Skilled">Highly Skilled</option>
                    <option value="Skilled">Skilled</option>
                    <option value="Semi Skilled">Semi Skilled</option>
                    <option value="Unskilled">Unskilled</option>
                  </select>
                </div>

                <div className="relative">
                  <label className="text-xs font-bold text-slate-600 block mb-1">Job Role</label>
                  
                  {!showAddRoleInput ? (
                    <div className="flex items-stretch gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          name="role"
                          value={formData.role || ""}
                          onChange={handleChange}
                          onFocus={() => setRoleSearchFocused(true)}
                          placeholder="Search or select job role..."
                          className="w-full pl-3 pr-8 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                          id="field-role"
                          autoComplete="off"
                        />
                        <span className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none z-10 text-xs">
                          ⚙️
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowAddRoleInput(true);
                          setNewRoleName("");
                          setRoleSearchFocused(false);
                        }}
                        className="px-3 bg-white hover:bg-slate-50 border border-slate-250 active:bg-slate-100 rounded text-slate-700 flex items-center justify-center transition cursor-pointer"
                        id="btn-add-role-toggle"
                        title="Add a brand new custom role"
                      >
                        <Plus size={15} className="stroke-[2.5]" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-stretch gap-1.5 animate-fade-in">
                      <input
                        type="text"
                        placeholder="Enter brand new role name..."
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitQuickAddRole(newRoleName);
                          } else if (e.key === "Escape") {
                            setShowAddRoleInput(false);
                            setNewRoleName("");
                          }
                        }}
                        className="flex-1 px-3 py-1.5 border border-blue-400 bg-blue-50/20 text-slate-800 font-medium text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        id="new-role-name-input-field"
                        autoFocus
                      />
                      
                      <button
                        type="button"
                        disabled={!newRoleName.trim()}
                        onClick={(e) => {
                          e.preventDefault();
                          commitQuickAddRole(newRoleName);
                        }}
                        className="px-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded flex items-center justify-center transition cursor-pointer font-bold text-xs"
                        title="Confirm adding custom role"
                        id="btn-confirm-new-role"
                      >
                        <Check size={14} className="stroke-[3]" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowAddRoleInput(false);
                          setNewRoleName("");
                        }}
                        className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded border border-slate-200 flex items-center justify-center transition cursor-pointer"
                        title="Cancel adding custom role"
                        id="btn-cancel-new-role"
                      >
                        <X size={14} className="stroke-[2.5]" />
                      </button>
                    </div>
                  )}

                  {/* Dropdown Options Box */}
                  {!showAddRoleInput && roleSearchFocused && (
                    <>
                      {/* Invisible backdrop to dismiss dropdown cleanly */}
                      <div 
                        className="fixed inset-0 z-40 bg-transparent cursor-default" 
                        onMouseDown={() => setRoleSearchFocused(false)}
                      />
                      
                      <div className="absolute left-0 mt-1 w-full max-h-[175px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 divide-y divide-slate-50 animate-fade-in text-xs">
                        {filteredRoles.length > 0 ? (
                          filteredRoles.map((r, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, role: r }));
                                setRoleSearchFocused(false);
                              }}
                              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 active:bg-slate-100 font-medium transition flex items-center justify-between"
                            >
                              <span>{r}</span>
                              {formData.role?.toLowerCase() === r.toLowerCase() && (
                                <Check size={12} className="text-blue-600 stroke-[3]" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-slate-400 italic text-center">No search match found</div>
                        )}
                        
                        <div className="p-1 text-center bg-slate-50 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddRoleInput(true);
                              setNewRoleName(currentRoleTyped);
                              setRoleSearchFocused(false);
                            }}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold transition flex items-center justify-center gap-1 mx-auto"
                          >
                            <Plus size={10} className="stroke-[3]" /> Add new custom role ...
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 relative">
                <span className="text-[11px] font-black text-slate-800 tracking-wider uppercase mb-3 block flex items-center gap-1.5">
                  Financial & Insurance Structure
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 flex items-end h-10 mb-1">
                      <span>Monthly Gross Salary <span className="text-red-500 font-bold">*</span></span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">Rs.</span>
                      <input
                        type="number"
                        name="grossSalary"
                        value={formData.grossSalary || ""}
                        onChange={handleSalaryChange}
                        placeholder="e.g. 25000"
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                        id="field-gross-salary"
                      />
                    </div>
                    {errors.grossSalary && (
                      <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.grossSalary}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 flex items-end h-10 mb-1">
                      <span>Daily Wage <span className="text-red-500 font-bold">*</span></span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">Rs.</span>
                      <input
                        type="number"
                        name="dailyWage"
                        value={formData.dailyWage || ""}
                        onChange={handleDailyWageChange}
                        placeholder="Auto-calculated"
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition font-mono font-medium"
                        id="field-daily-wage"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 flex items-end h-10 mb-1">
                      <span>Basic Salary <span className="text-red-500 font-bold">*</span></span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">Rs.</span>
                      <input
                        type="number"
                        name="basicSalary"
                        value={formData.basicSalary || ""}
                        onChange={handleChange}
                        placeholder="Calculates as 50% automatically"
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                        id="field-basic-salary"
                      />
                    </div>
                    {errors.basicSalary && (
                      <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.basicSalary}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 flex items-end h-10 mb-1">
                      <span>ESIC Covered? (Auto-Triggered)</span>
                    </label>
                    <select
                      name="esic"
                      value={formData.esic}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition cursor-pointer"
                      id="field-esic"
                    >
                      <option value="Yes">Yes (Gross Salary ≤ Rs. 21,000)</option>
                      <option value="No">No (Gross Salary &gt; Rs. 21,000)</option>
                      <option value="Exempt">Exempt / Custom Exception</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 flex items-end h-10 mb-1">
                      <span>Working Days Cycle</span>
                    </label>
                    <select
                      name="workingDaysType"
                      value={formData.workingDaysType || "26 Days (Sun Off)"}
                      onChange={handleWorkingDaysChange}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition cursor-pointer font-medium"
                      id="field-working-days-type"
                    >
                      <option value="22 Days (Sat/Sun Off)">22 Days Month (Sat-Sun Off)</option>
                      <option value="26 Days (Sun Off)">26 Days Month (Sun Off)</option>
                      <option value="30/31 Days (No Off)">30/31 Days Month (No Off)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 flex items-end h-10 mb-1">
                      <span>Statutory Compliance</span>
                    </label>
                    <div className="flex flex-col gap-1.5 justify-center h-[34px]">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          name="complianceEnabled"
                          checked={formData.complianceEnabled !== false}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, complianceEnabled: e.target.checked }));
                          }}
                          className="w-4 h-4 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                          id="field-compliance-enabled"
                        />
                        <label htmlFor="field-compliance-enabled" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                          Enable PF/ESIC/PT
                        </label>
                      </div>
                      {(() => {
                        const loc = formData.location || "";
                        const isLocCompliant = loc ? !!locationCompliance[loc] : false;
                        return (
                          <span className={`text-[9px] font-black uppercase tracking-wider ${isLocCompliant ? "text-emerald-600" : "text-rose-500"}`}>
                            Loc Compliance: {isLocCompliant ? "ON" : "OFF"}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-xs font-bold text-slate-600 block mb-1">PF Calculation Basis</label>
                  <select
                    name="pfCalculationMode"
                    value={formData.pfCalculationMode || "ceiling_15000"}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition cursor-pointer font-semibold"
                    id="field-pf-calculation-mode"
                  >
                    <option value="gross">PF on Gross Salary (full monthly gross)</option>
                    <option value="ceiling_15000">PF with ₹15,000 ceiling</option>
                  </select>
                  {(() => {
                    const loc = formData.location || "";
                    const isLocCompliant = loc ? !!locationCompliance[loc] : false;
                    const isCompliant = isLocCompliant && formData.complianceEnabled !== false;
                    const previewGross = Number(formData.grossSalary) || 0;
                    const { pfWage, employeePf, employerPf } = calculatePfAmounts(previewGross, {
                      mode: formData.pfCalculationMode,
                      isCompliant,
                    });
                    const modeLabel =
                      resolvePfCalculationMode(formData.pfCalculationMode) === "gross"
                        ? "PF wage = this month's gross salary"
                        : "PF wage = gross if below ₹15,000, else ₹15,000";
                    return (
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                        <strong>{modeLabel}.</strong>
                        {isCompliant && previewGross > 0 ? (
                          <>
                            {" "}
                            Preview on ₹{previewGross.toLocaleString("en-IN")} gross: PF wage ₹{pfWage.toLocaleString("en-IN")} →
                            Employee PF (12%) ₹{employeePf.toLocaleString("en-IN")}, Employer PF (13%) ₹{employerPf.toLocaleString("en-IN")}.
                          </>
                        ) : null}
                      </p>
                    );
                  })()}
                </div>

                <p className="text-[10px] text-slate-400 mt-2.5">
                  💡 <strong>Indian Payroll Rule Check:</strong> ESIC eligibility is auto-enabled for monthly salaries of Rs. 21,000 or below. Basic Salary is mapped as 50% of gross as default. PF uses gross for the active salary month (prorated by attendance on the salary sheet).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">EPF Universal Account No (UAN)</label>
                  <input
                    type="text"
                    name="uan"
                    value={formData.uan}
                    onChange={handleChange}
                    placeholder="12 digit number"
                    maxLength={12}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs font-mono text-slate-800 transition"
                    id="field-uan"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Previous UAN No (if rehired)</label>
                  <input
                    type="text"
                    name="previousUanNo"
                    value={formData.previousUanNo}
                    onChange={handleChange}
                    placeholder="Previous 12 digit UAN"
                    maxLength={12}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs font-mono text-slate-800 transition"
                    id="field-prev-uan"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Previous ESIC No <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    name="previousEsicNo"
                    value={formData.previousEsicNo}
                    onChange={handleChange}
                    placeholder="17 digit ESIC code or NOT APPLICABLE"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs font-mono text-slate-800 transition"
                    id="field-prev-esic"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL IDENTITY */}
          {activeTab === "identity" && (
            <div className="space-y-4 animate-fade-in" id="identity-fields-group">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Employee Name As Per Aadhar CARD <span className="text-red-500 font-bold">**</span>
                  </label>
                  <input
                    type="text"
                    name="nameAsPerAadhar"
                    value={formData.nameAsPerAadhar}
                    onChange={handleChange}
                    placeholder="FULL LEGAL NAME IN ALL CAPS"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-850 uppercase transition font-bold"
                    id="field-aadhar-full-name"
                  />
                  <p className="text-[10px] text-blue-600 mt-1">
                    💡 Types here will automatically replicate to PAN & Bank names!
                  </p>
                  {errors.nameAsPerAadhar && (
                    <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.nameAsPerAadhar}</span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Verify Name As Per Aadhar Column <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    name="nameAsPerAadharColumn"
                    value={formData.nameAsPerAadharColumn}
                    onChange={handleChange}
                    placeholder="Verification Name matches Aadhar Card"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-700 transition"
                    id="field-name-verify-col"
                  />
                  {errors.nameAsPerAadharColumn && (
                    <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.nameAsPerAadharColumn}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Aadhar Number <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    name="aadharNo"
                    value={formData.aadharNo}
                    onChange={handleChange}
                    placeholder="XXXX XXXX XXXX (12 Digits)"
                    maxLength={12}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs font-mono text-slate-800 transition"
                    id="field-aadhar-no"
                  />
                  {errors.aadharNo && (
                    <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.aadharNo}</span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Aadhar Linked Mobile No <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    name="aadharLinkMobNo"
                    value={formData.aadharLinkMobNo}
                    onChange={handleChange}
                    placeholder="10 digit cellular number"
                    maxLength={10}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs font-mono text-slate-855 transition"
                    id="field-aadhar-mobile"
                  />
                  {errors.aadharLinkMobNo && (
                    <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.aadharLinkMobNo}</span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Personal Mobile Number</label>
                  <input
                    type="text"
                    name="employeeMobile"
                    value={formData.employeeMobile || ""}
                    onChange={handleChange}
                    placeholder="Personal cellular phone"
                    maxLength={10}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs font-mono text-slate-800 transition"
                    id="field-personal-mobile"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                    id="field-dob"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">PAN Number</label>
                  <input
                    type="text"
                    name="panNo"
                    value={formData.panNo}
                    onChange={handleChange}
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs font-mono uppercase text-slate-800 transition"
                    id="field-pan-no"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Name As Per PAN</label>
                  <input
                    type="text"
                    name="nameAsPerPan"
                    value={formData.nameAsPerPan}
                    onChange={handleChange}
                    placeholder="Name appearing in Income Tax Card"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-700 transition"
                    id="field-pan-name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-150 rounded">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Father's Name <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    name="fatherName"
                    value={formData.fatherName}
                    onChange={handleChange}
                    placeholder="Father legal name"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                    id="field-father-name"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Husband's Name <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    name="husbandName"
                    value={formData.husbandName}
                    onChange={handleChange}
                    placeholder="Husband legal name (if married female)"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                    id="field-husband-name"
                  />
                </div>
                <p className="text-[9px] text-slate-450 col-span-2">
                  * Note: ECR portal rules stipulate either Father's Name or Husband's Name is mandatory for registration.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Gender <span className="text-red-500 font-bold">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition cursor-pointer"
                    id="field-gender"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Marital Status <span className="text-red-500 font-bold">*</span>
                  </label>
                  <select
                    name="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition cursor-pointer"
                    id="field-marital"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BANKING DETAILS & ADRESSES */}
          {activeTab === "bank" && (
            <div className="space-y-4 animate-fade-in" id="bank-fields-group">
              <div className="p-4 bg-blue-50/20 border border-blue-100 rounded-xl">
                <span className="text-[11px] font-black text-blue-900 uppercase tracking-widest block mb-3">
                  Checklist: Bank Remittance
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      Bank Account Number <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      name="bankAccountNo"
                      value={formData.bankAccountNo}
                      onChange={handleChange}
                      placeholder="Savings or salary account"
                      className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs font-mono text-slate-800 transition"
                      id="field-bank-account"
                    />
                    {errors.bankAccountNo && (
                      <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.bankAccountNo}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      IFSC Code <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      name="ifscCode"
                      value={formData.ifscCode}
                      onChange={handleChange}
                      placeholder="e.g. SBIN0001011"
                      maxLength={11}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs font-mono uppercase text-slate-800 transition"
                      id="field-ifsc"
                    />
                    {errors.ifscCode && (
                      <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.ifscCode}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      Employee Name As Per BANK <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      name="nameAsPerBank"
                      value={formData.nameAsPerBank}
                      onChange={handleChange}
                      placeholder="Card or bank book name"
                      className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                      id="field-bank-name"
                    />
                    {errors.nameAsPerBank && (
                      <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.nameAsPerBank}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Present Address <span className="text-red-500 font-bold">*</span>
                  </label>
                  <textarea
                    name="presentAddress"
                    value={formData.presentAddress}
                    onChange={handleChange}
                    placeholder="Enter complete current local residential address"
                    rows={3}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-805 transition resize-none"
                    id="field-present-address"
                  />
                  {errors.presentAddress && (
                    <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.presentAddress}</span>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-600 block">
                      Permanent Address <span className="text-red-500 font-bold">*</span>
                    </label>
                    <button
                      onClick={handleCopyAddress}
                      disabled={!formData.presentAddress}
                      className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-semibold disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
                      title="Copy Present Address to Permanent"
                      id="btn-copy-address"
                    >
                      <Link size={11} />
                      Same as Present
                    </button>
                  </div>
                  <textarea
                    name="permanentAddress"
                    value={formData.permanentAddress}
                    onChange={handleChange}
                    placeholder="Enter permanent hometown residential address"
                    rows={3}
                    className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-805 transition resize-none"
                    id="field-permanent-address"
                  />
                  {errors.permanentAddress && (
                    <span className="text-[10px] text-rose-600 mt-1 block font-medium">{errors.permanentAddress}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NOMINEES & IMMEDIATE DEPENDENTS */}
          {activeTab === "dependents" && (
            <div className="space-y-5 animate-fade-in" id="family-fields-group">
              {/* Nominee Details Section */}
              <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-xl">
                <span className="text-[11px] font-black text-emerald-800 uppercase tracking-widest block mb-3">
                  Nominee Details (ESIC Benefit Receiver)
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Nominee Name</label>
                    <input
                      type="text"
                      name="nomineeName"
                      value={formData.nomineeName}
                      onChange={handleChange}
                      placeholder="Nominee full name"
                      className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                      id="field-nominee-name"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Nominee Date of Birth (DOB)</label>
                    <input
                      type="date"
                      name="nomineeDob"
                      value={formData.nomineeDob}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                      id="field-nominee-dob"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Relation with Employee</label>
                    <input
                      type="text"
                      name="nomineeRelation"
                      value={formData.nomineeRelation}
                      onChange={handleChange}
                      placeholder="e.g. Spouse, Father"
                      className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition"
                      id="field-nominee-relation"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Nominee Mobile Number</label>
                    <input
                      type="text"
                      name="nomineeMobile"
                      value={formData.nomineeMobile || ""}
                      onChange={handleChange}
                      placeholder="Nominee mobile phone"
                      maxLength={10}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs font-mono text-slate-800 transition"
                      id="field-nominee-mobile"
                    />
                  </div>
                </div>
              </div>

              {/* Family Members Dependents */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-700 block border-b border-slate-200 pb-2">
                  Immediate Family Members Beneficiaries (Max 3)
                </span>

                {/* Family Member 1 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-slate-50/50 rounded border border-slate-200" id="family-mb1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Family Member Name (1)</label>
                    <input
                      type="text"
                      name="familyMember1Name"
                      value={formData.familyMember1Name}
                      onChange={handleChange}
                      placeholder="First family dependent"
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Member (1) Date of Birth</label>
                    <input
                      type="date"
                      name="familyMember1Dob"
                      value={formData.familyMember1Dob}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Relation (1)</label>
                    <input
                      type="text"
                      name="familyMember1Relation"
                      value={formData.familyMember1Relation}
                      onChange={handleChange}
                      placeholder="e.g. Mother, Son"
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Member (1) Mobile Phone</label>
                    <input
                      type="text"
                      name="familyMember1Mobile"
                      value={formData.familyMember1Mobile || ""}
                      onChange={handleChange}
                      placeholder="Dependent phone"
                      maxLength={10}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs font-mono text-slate-800 bg-white"
                    />
                  </div>
                </div>

                {/* Family Member 2 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-slate-50/50 rounded border border-slate-200" id="family-mb2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Family Member Name (2)</label>
                    <input
                      type="text"
                      name="familyMember2Name"
                      value={formData.familyMember2Name}
                      onChange={handleChange}
                      placeholder="Second family dependent"
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Member (2) Date of Birth</label>
                    <input
                      type="date"
                      name="familyMember2Dob"
                      value={formData.familyMember2Dob}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Relation (2)</label>
                    <input
                      type="text"
                      name="familyMember2Relation"
                      value={formData.familyMember2Relation}
                      onChange={handleChange}
                      placeholder="e.g. Brother, Wife"
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Member (2) Mobile Phone</label>
                    <input
                      type="text"
                      name="familyMember2Mobile"
                      value={formData.familyMember2Mobile || ""}
                      onChange={handleChange}
                      placeholder="Dependent phone"
                      maxLength={10}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs font-mono text-slate-800 bg-white"
                    />
                  </div>
                </div>

                {/* Family Member 3 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-slate-50/50 rounded border border-slate-200" id="family-mb3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Family Member Name (3)</label>
                    <input
                      type="text"
                      name="familyMember3Name"
                      value={formData.familyMember3Name}
                      onChange={handleChange}
                      placeholder="Third family dependent"
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Member (3) Date of Birth</label>
                    <input
                      type="date"
                      name="familyMember3Dob"
                      value={formData.familyMember3Dob}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Relation (3)</label>
                    <input
                      type="text"
                      name="familyMember3Relation"
                      value={formData.familyMember3Relation}
                      onChange={handleChange}
                      placeholder="e.g. Son, Daughter"
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Member (3) Mobile Phone</label>
                    <input
                      type="text"
                      name="familyMember3Mobile"
                      value={formData.familyMember3Mobile || ""}
                      onChange={handleChange}
                      placeholder="Dependent phone"
                      maxLength={10}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs font-mono text-slate-800 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DYNAMIC CUSTOM FIELDS */}
          {activeTab === "custom" && (
            <div className="space-y-6 animate-fade-in" id="custom-fields-group">
              <div className="p-4 bg-slate-50 border border-slate-205 rounded-xl">
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest block mb-1">
                  Define Extra Profile Fields
                </span>
                <p className="text-[11px] text-slate-500 mb-4">
                  Add non-standard attributes (e.g. Passport details, Alternate Contact, Vaccination Status, Shift Preference, or Training Completion dates) here.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Field Label Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Passport Number"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white"
                      id="new-custom-field-name-input"
                    />
                  </div>

                  <div className="w-full sm:w-44">
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Field Input Type</label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 bg-white cursor-pointer"
                      id="new-custom-field-type-dd"
                    >
                      <option value="text">Text Character string</option>
                      <option value="number">Numeric value</option>
                      <option value="date">Calendar Date</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    disabled={!newFieldName.trim()}
                    className="w-full sm:w-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded transition flex items-center justify-center gap-1.5 cursor-pointer"
                    id="add-custom-field-action-btn"
                  >
                    <Plus size={14} className="stroke-[3]" />
                    Add Attribute
                  </button>
                </div>
              </div>

              {/* Dynamic inputs for existing custom fields */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-700 block border-b border-slate-200 pb-2">
                  Active Custom Attributes Matrix ({formData.customFields?.length || 0})
                </span>

                {formData.customFields && formData.customFields.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.customFields.map((field, index) => (
                      <div 
                        key={index} 
                        className="p-4 border border-slate-200 bg-white shadow-xs rounded-xl flex flex-col justify-between relative group hover:border-slate-300 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-800 tracking-tight">{field.name}</span>
                            <span className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider scale-95 border border-slate-200">
                              {field.type}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition pointer"
                            title={`Remove field "${field.name}"`}
                          >
                            <X size={14} className="stroke-[2.5]" />
                          </button>
                        </div>

                        <div>
                          {field.type === "date" ? (
                            <input id={`custom-field-date-${index}`} name={`customFieldDate_${index}`}
                              type="date"
                              value={field.value || ""}
                              onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 hover:border-slate-350 focus:border-blue-500 focus:outline-none transition"
                            />
                          ) : field.type === "number" ? (
                            <input id={`custom-field-number-${index}`} name={`customFieldNumber_${index}`}
                              type="number"
                              step="any"
                              value={field.value || ""}
                              placeholder="Enter number..."
                              onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-800 hover:border-slate-350 focus:border-blue-500 focus:outline-none transition font-mono"
                            />
                          ) : (
                            <input id={`custom-field-text-${index}`} name={`customFieldText_${index}`}
                              type="text"
                              value={field.value || ""}
                              placeholder={`Enter custom ${field.name}...`}
                              onChange={(e) => handleCustomFieldValueChange(index, e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-250 rounded text-xs text-slate-850 hover:border-slate-350 focus:border-blue-500 focus:outline-none transition"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    💡 No custom fields defined yet. Create some above to extend this checklist profile!
                  </div>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Modal footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 font-medium">
            🚩 Switch tabs to fill out addresses and dependents
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-705 text-xs font-semibold cursor-pointer transition bg-white"
              id="btn-cancel-onboard"
            >
              Discard Changes
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              id="btn-save-onboard"
            >
              {isSubmitting ? (
                "Saving Record..."
              ) : (
                <>
                  <Check size={14} />
                  {isEdit ? "Update Employee" : "Save Employee Details"}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
