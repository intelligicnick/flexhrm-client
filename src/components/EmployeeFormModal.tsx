/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Check, Calculator, UserCheck, CreditCard, Users, Link, MapPin, Plus, Camera, Trash2, Edit3, UserPlus, FolderOpen } from "lucide-react";
import { Employee } from "../types";
import type { Contract } from "../types";
import {
  validateEmployee,
  normalizeSkillCategory,
  calculatePfAmounts,
  calculateProfessionalTax,
  resolvePfCalculationMode,
  isPfEsicCompliant,
  isProfessionalTaxApplicable,
  isEmployeePtEnabled,
  PROFESSIONAL_TAX_SLAB_SUMMARY,
} from "../utils";
import {
  applySalaryFieldChange,
  applyWageModeSwitch,
  inferSalaryWageMode,
  toSalaryFieldValues,
  type SalaryWageMode,
} from "../lib/salary-calc";
import {
  ESIC_STATUS_APPLY_ABOVE_LIMIT,
  getEsicDisplayLabel,
  isEsicCoveredStatus,
} from "../lib/esic";
import { CARD_PHOTO, prepareCardPhoto } from "./id-card";
import { useEmployeePhotoUrl } from "../hooks/useEmployeePhotoUrl";
import EmployeeDocumentsPanel from "./EmployeeDocumentsPanel";
import {
  findContractsForLocation,
  formatContractLabel,
} from "../lib/contract-locations";
import { useHRMS } from "../context/HRMSContext";
import { UNSAVED_CHANGES_CONFIRM } from "../lib/unsaved-changes";

interface EmployeeFormModalProps {
  employee?: Employee | null; // null if adding
  onClose: () => void;
  onSave: (empData: Partial<Employee>) => Promise<Employee | null>;
  availableLocations?: string[];
  availableRoles?: string[];
  contracts?: Contract[];
  basicSalaryPercent?: number;
  esicEligibilityLimit?: number;
  onLocationRegistryUpdate?: () => void;
  onCreateLocation?: (name: string, complianceEnabled: boolean, ptEnabled: boolean) => Promise<void>;
  onCreateRole?: (name: string) => Promise<void>;
}

type FormTab = "basic" | "identity" | "bank" | "dependents" | "custom" | "documents";

const FORM_TABS: { id: FormTab; label: string; icon: React.ReactNode }[] = [
  { id: "basic", label: "Corporate & Salary", icon: <Calculator size={14} /> },
  { id: "identity", label: "Identity & Personal", icon: <UserCheck size={14} /> },
  { id: "bank", label: "Banking & Address", icon: <CreditCard size={14} /> },
  { id: "dependents", label: "Nominee & Dependents", icon: <Users size={14} /> },
  { id: "custom", label: "Custom Fields", icon: <Plus size={14} /> },
  { id: "documents", label: "Documents", icon: <FolderOpen size={14} /> },
];

const TAB_ERROR_KEYS: Partial<Record<FormTab, string[]>> = {
  basic: ["employeeCode", "grossSalary", "basicSalary"],
  identity: ["nameAsPerAadhar", "aadharNo", "nameAsPerAadharColumn", "gender", "maritalStatus", "fatherName", "aadharLinkMobNo"],
  bank: ["bankAccountNo", "ifscCode", "nameAsPerBank", "presentAddress", "permanentAddress"],
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function EmployeeFormModal({
  employee,
  onClose,
  onSave,
  availableLocations,
  availableRoles,
  contracts = [],
  basicSalaryPercent = 50,
  esicEligibilityLimit = 21000,
  onLocationRegistryUpdate,
  onCreateLocation,
  onCreateRole,
}: EmployeeFormModalProps) {
  const { confirmAction, setScreenUnsavedFlag } = useHRMS();
  const isEdit = !!employee;
  const [activeTab, setActiveTab] = useState<FormTab>("basic");
  const [createdEmployee, setCreatedEmployee] = useState<Employee | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const documentsEmployee = employee ?? createdEmployee;
  const markDirty = () => setIsDirty(true);
  
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
    const registryLocs = availableLocations || [];
    const editExtras = employee?.location ? [employee.location] : [];
    setLocalLocations(Array.from(new Set([...registryLocs, ...editExtras])).filter(Boolean));
  }, [availableLocations, employee?.location]);

  useEffect(() => {
    const registryRoles = availableRoles || [];
    const editExtras = employee?.role ? [employee.role] : [];
    setLocalRoles(Array.from(new Set([...registryRoles, ...editExtras])).filter(Boolean));
  }, [availableRoles, employee?.role]);

  // Form State
  const [formData, setFormData] = useState<Partial<Employee>>({
    employeeCode: "",
    location: "",
    nameAsPerAadhar: "",
    grossSalary: 0,
    basicSalary: 0,
    esic: "No",
    complianceEnabled: true,
    ptEnabled: false,
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
    salaryWageMode: "monthly",
    skillCategory: "Skilled",
    role: "",
    dailyWage: 0,
    employeeMobile: "",
    nomineeMobile: "",
    familyMember1Mobile: "",
    familyMember2Mobile: "",
    familyMember3Mobile: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoRemoveConfirm, setPhotoRemoveConfirm] = useState(false);
  const savedPhotoUrl = useEmployeePhotoUrl(
    employee?.id ?? formData.id,
    photoRemoved || formData.photo?.startsWith("data:")
      ? null
      : (formData.photo || employee?.photo),
  );
  const displayPhotoSrc = photoRemoved ? null : (photoPreview || savedPhotoUrl);
  
  // Custom fields helper state
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");

  // Location compliance maps
  const [locationCompliance, setLocationCompliance] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("hrms_location_compliance");
    return saved ? JSON.parse(saved) : {};
  });
  const [locationPtEnabled, setLocationPtEnabled] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("hrms_location_pt_enabled");
    return saved ? JSON.parse(saved) : {};
  });
  const [newLocationCompliance, setNewLocationCompliance] = useState(true);
  const [newLocationPtEnabled, setNewLocationPtEnabled] = useState(false);

  const resetQuickAddLocationForm = () => {
    setShowAddLocationInput(false);
    setNewLocationName("");
    setNewLocationCompliance(true);
    setNewLocationPtEnabled(false);
  };

  const openQuickAddLocation = (prefill = "") => {
    setShowAddLocationInput(true);
    setNewLocationName(prefill);
    setNewLocationCompliance(true);
    setNewLocationPtEnabled(false);
    setSearchFocused(false);
  };

  const commitQuickAddLocation = async (rawName: string): Promise<boolean> => {
    const val = rawName.trim();
    if (!val) return false;

    await onCreateLocation?.(val, newLocationCompliance, newLocationPtEnabled);
    setLocationCompliance((prev) => ({ ...prev, [val]: newLocationCompliance }));
    setLocationPtEnabled((prev) => ({ ...prev, [val]: newLocationPtEnabled }));

    setLocalLocations((prev) => Array.from(new Set([...prev, val])));
    markDirty();
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
    markDirty();
    setFormData(prev => ({ ...prev, role: val }));
    setShowAddRoleInput(false);
    setNewRoleName("");
    return true;
  };

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/locations")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const complianceMap: Record<string, boolean> = {};
        const ptMap: Record<string, boolean> = {};
        data.forEach((loc: { name?: string; complianceEnabled?: boolean; ptEnabled?: boolean; ptAmount?: number }) => {
          if (!loc.name) return;
          complianceMap[loc.name] = !!loc.complianceEnabled;
          ptMap[loc.name] =
            loc.ptEnabled !== undefined ? !!loc.ptEnabled : Number(loc.ptAmount || 0) > 0;
        });
        setLocationCompliance(complianceMap);
        setLocationPtEnabled(ptMap);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load existing employee
  useEffect(() => {
    setIsDirty(false);
    if (employee) {
      setFormData({
        ...employee,
        skillCategory: normalizeSkillCategory(employee.skillCategory) || "Skilled",
        pfCalculationMode: employee.pfCalculationMode || "ceiling_15000",
        salaryWageMode: inferSalaryWageMode(employee),
      });
      setPhotoPreview(null);
      setPhotoRemoved(false);
      setPhotoRemoveConfirm(false);
    } else {
      setPhotoPreview(null);
      setPhotoRemoved(false);
      setPhotoRemoveConfirm(false);
    }
  }, [employee]);

  useEffect(() => {
    setScreenUnsavedFlag("employeeForm", isDirty);
    return () => setScreenUnsavedFlag("employeeForm", false);
  }, [isDirty, setScreenUnsavedFlag]);

  const requestClose = async () => {
    if (isDirty) {
      const confirmed = await confirmAction(UNSAVED_CHANGES_CONFIRM);
      if (!confirmed) return;
    }
    onClose();
  };

  const locationContracts = useMemo(
    () => findContractsForLocation(formData.location || "", contracts),
    [formData.location, contracts],
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }
    if (file.size > CARD_PHOTO.maxFileSizeMb * 1024 * 1024) {
      alert(`Photo must be smaller than ${CARD_PHOTO.maxFileSizeMb} MB.`);
      return;
    }
    try {
      const dataUrl = await prepareCardPhoto(file);
      markDirty();
      setFormData((prev) => ({ ...prev, photo: dataUrl }));
      setPhotoPreview(dataUrl);
      setPhotoRemoved(false);
      setPhotoRemoveConfirm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to read the selected photo.");
    } finally {
      e.target.value = "";
    }
  };

  const handleConfirmRemovePhoto = () => {
    markDirty();
    setFormData((prev) => ({ ...prev, photo: "" }));
    setPhotoPreview(null);
    setPhotoRemoved(true);
    setPhotoRemoveConfirm(false);
  };

  // Handle standard field change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    markDirty();
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

  const applySalaryUpdate = (
    field: "grossSalary" | "dailyWage" | "basicSalary" | "workingDaysType",
    value: string,
  ) => {
    markDirty();
    setFormData((prev) => {
      const currentSalary = toSalaryFieldValues(prev);
      const wageMode = inferSalaryWageMode(prev);
      const { values, wageMode: nextMode } = applySalaryFieldChange(
        currentSalary,
        wageMode,
        field,
        value,
        basicSalaryPercent,
        esicEligibilityLimit,
      );

      return {
        ...prev,
        grossSalary: values.grossSalary,
        dailyWage: values.dailyWage,
        basicSalary: values.basicSalary,
        workingDaysType: values.workingDaysType,
        esic: values.esic,
        salaryWageMode: nextMode,
      };
    });

    if (errors.grossSalary || errors.basicSalary) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.grossSalary;
        delete copy.basicSalary;
        return copy;
      });
    }
  };

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applySalaryUpdate("grossSalary", e.target.value);
  };

  const handleDailyWageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applySalaryUpdate("dailyWage", e.target.value);
  };

  const handleBasicSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applySalaryUpdate("basicSalary", e.target.value);
  };

  const handleWorkingDaysChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    applySalaryUpdate("workingDaysType", e.target.value);
  };

  const handleWageModeChange = (mode: SalaryWageMode) => {
    setFormData((prev) => {
      if (inferSalaryWageMode(prev) === mode) return prev;
      const currentSalary = toSalaryFieldValues(prev);
      const values = applyWageModeSwitch(
        currentSalary,
        mode,
        basicSalaryPercent,
        esicEligibilityLimit,
      );
      return {
        ...prev,
        grossSalary: values.grossSalary,
        dailyWage: values.dailyWage,
        basicSalary: values.basicSalary,
        workingDaysType: values.workingDaysType,
        salaryWageMode: mode,
      };
    });
  };

  const salaryWageMode = inferSalaryWageMode(formData);
  const isMonthlyWage = salaryWageMode === "monthly";

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
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
    const { contractId: _contractId, ...employeePayload } = formData;
    const saved = await onSave(employeePayload);
    setIsSubmitting(false);
    if (!saved) return;
    if (!isEdit) {
      setCreatedEmployee(saved);
      setActiveTab("documents");
      return;
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      void requestClose();
    }
  };

  const displayName = formData.nameAsPerAadhar || employee?.nameAsPerAadhar || "Unnamed Employee";
  const isExited = !!(formData.exitDate || employee?.exitDate);
  const tabHasErrors = (tab: FormTab) =>
    (TAB_ERROR_KEYS[tab] ?? []).some((key) => key in errors);

  const renderPhotoSection = () => {
    const hasPhoto = !!(displayPhotoSrc || employee?.photo) && !photoRemoved;

    return (
      <div className="relative shrink-0 group" id="employee-photo-upload-section">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/20 bg-white shadow-lg sm:h-20 sm:w-20">
          {displayPhotoSrc ? (
            <img src={displayPhotoSrc} alt="Employee preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#ff791a] text-white">
              {isEdit ? (
                <span className="text-lg font-black tracking-wide">{getInitials(displayName)}</span>
              ) : (
                <UserPlus size={28} className="stroke-[2]" />
              )}
            </div>
          )}
          <label
            className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-black/45 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
            title={`Upload portrait photo (${CARD_PHOTO.aspectLabel}, up to ${CARD_PHOTO.maxFileSizeMb} MB)`}
          >
            <Camera size={20} className="text-white" />
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </label>
        </div>

        {hasPhoto && !photoRemoveConfirm && (
          <button
            type="button"
            onClick={() => setPhotoRemoveConfirm(true)}
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-rose-600 text-white shadow-md transition hover:bg-rose-700"
            title="Remove photo"
          >
            <Trash2 size={11} />
          </button>
        )}
        {photoRemoveConfirm && (
          <div className="absolute left-0 top-full z-10 mt-2 w-52 rounded-xl border border-rose-200 bg-white p-2.5 shadow-xl">
            <p className="text-[10px] font-bold text-rose-700 mb-2">Remove photo?</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleConfirmRemovePhoto}
                className="flex-1 rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-700"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setPhotoRemoveConfirm(false)}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in" id="employee-form-modal">
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
          {/* Header */}
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#0C1E4A] via-slate-900 to-slate-800 px-5 pb-4 pt-5 text-white sm:px-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,121,26,0.18),transparent_55%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                {renderPhotoSection()}
                <div className="min-w-0 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-200/90">
                    {isEdit ? "Edit employee profile" : "Employee onboarding"}
                  </p>
                  <h2 className="mt-0.5 truncate text-lg font-extrabold tracking-tight sm:text-xl" id="modal-header-heading">
                    {isEdit ? displayName : "Onboard New Employee"}
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-300">
                    {isEdit
                      ? formData.role || employee?.role || "Update payroll, identity, and compliance details"
                      : "Complete all tabs to register a new team member. Hover the avatar to add an ID card photo (optional)."}
                  </p>
                  {isEdit && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[11px] font-bold text-orange-200">
                        {formData.employeeCode || employee?.employeeCode}
                      </span>
                      {formData.location && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
                          <MapPin size={10} />
                          {formData.location}
                        </span>
                      )}
                      {isExited ? (
                        <span className="rounded-full border border-rose-400/30 bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-200">
                          Exited
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                          Active
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => void requestClose()}
                className="cursor-pointer rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white shrink-0"
                id="close-form-modal"
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            {isEdit && (
              <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Gross</p>
                  <p className="text-sm font-extrabold text-emerald-300">
                    ₹{(Number(formData.grossSalary) || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Basic</p>
                  <p className="text-sm font-extrabold text-sky-300">
                    ₹{(Number(formData.basicSalary) || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">ESIC</p>
                  <p className="text-sm font-bold text-white">
                    {isEsicCoveredStatus(formData.esic) ? "Covered" : "Not covered"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Skill</p>
                  <p className="truncate text-sm font-bold text-white">
                    {normalizeSkillCategory(formData.skillCategory) || "—"}
                  </p>
                </div>
              </div>
            )}

            {!isEdit && (
              <p className="relative mt-3 text-[11px] text-slate-300/90">
                Fields marked with <span className="font-bold text-rose-300">*</span> are required for statutory ECR compliance.
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 sm:px-4" id="form-tab-headers">
            <div className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FORM_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                    activeTab === tab.id
                      ? "bg-[#ff791a] text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                  id={`tab-btn-${tab.id}`}
                >
                  {tab.icon}
                  {tab.label}
                  {tabHasErrors(tab.id) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 ring-2 ring-white/30" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/60 p-4 sm:p-5" id="onboard-employee-form">
          {/* TAB 1: BASIC & CORPORATE SALARY */}
          {activeTab === "basic" && (
            <div className="rounded-xl border border-slate-100 bg-white p-4 sm:p-5 shadow-xs space-y-5 animate-fade-in" id="basic-fields-group">
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

                <div className="relative min-w-0">
                  <label className="text-xs font-bold text-slate-600 block mb-1">Work Location</label>
                  
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

                  {/* Dropdown Options Box */}
                  {searchFocused && (
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
                  <label className="text-xs font-bold text-slate-600 block mb-1 flex items-center gap-1">
                    <Link size={12} className="text-[#ff791a]" />
                    Assigned Contract
                  </label>
                  <div className="w-full px-3 py-1.5 border border-slate-200 rounded bg-slate-50 text-xs text-slate-700">
                    {locationContracts.length === 1
                      ? formatContractLabel(locationContracts[0])
                      : "— Not linked to a contract —"}
                  </div>
                  {formData.location?.trim() && locationContracts.length === 0 && contracts.length > 0 && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      No contract is linked to this office location yet. Link it from the Contracts page.
                    </p>
                  )}
                  {locationContracts.length > 1 && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      Multiple contracts use this location — assign the correct one on the Contracts page.
                    </p>
                  )}
                  {locationContracts.length === 1 && (
                    <p className="text-[10px] text-emerald-700 mt-1">
                      Resolved from office location mapping.
                    </p>
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
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Salary Basis:</span>
                  <div className="inline-flex rounded-lg border border-slate-250 overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => handleWageModeChange("monthly")}
                      className={`px-3 py-1.5 text-xs font-bold transition ${
                        isMonthlyWage
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                      id="btn-wage-mode-monthly"
                    >
                      Monthly Wage
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWageModeChange("daily")}
                      className={`px-3 py-1.5 text-xs font-bold transition border-l border-slate-250 ${
                        !isMonthlyWage
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                      id="btn-wage-mode-daily"
                    >
                      Daily Wage
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {isMonthlyWage
                      ? "Enter monthly gross; daily wage is auto-calculated from working-days cycle."
                      : "Enter daily wage; monthly gross is auto-calculated from working-days cycle."}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 flex items-end h-10 mb-1">
                      <span>Monthly Gross Salary <span className="text-red-500 font-bold">*</span></span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">Rs.</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        name="grossSalary"
                        value={formData.grossSalary || ""}
                        onChange={handleSalaryChange}
                        readOnly={!isMonthlyWage}
                        placeholder="e.g. 25000"
                        className={`w-full pl-9 pr-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition ${
                          !isMonthlyWage ? "bg-slate-100 cursor-default" : ""
                        }`}
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
                        min={0}
                        step="any"
                        name="dailyWage"
                        value={formData.dailyWage || ""}
                        onChange={handleDailyWageChange}
                        readOnly={isMonthlyWage}
                        placeholder={isMonthlyWage ? "Auto-calculated" : "e.g. 500"}
                        className={`w-full pl-9 pr-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition font-mono font-medium ${
                          isMonthlyWage ? "bg-slate-100 cursor-default" : ""
                        }`}
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
                        min={0}
                        step="any"
                        name="basicSalary"
                        value={formData.basicSalary || ""}
                        onChange={handleBasicSalaryChange}
                        placeholder={`Default ${basicSalaryPercent}% of gross — edit to override`}
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
                      <span>ESIC Covered? (Auto + manual override)</span>
                    </label>
                    <select
                      name="esic"
                      value={formData.esic}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 border border-slate-250 rounded hover:border-slate-350 focus:border-blue-500 focus:outline-none text-xs text-slate-800 transition cursor-pointer"
                      id="field-esic"
                    >
                      <option value="Yes">Yes (Gross Salary ≤ Rs. 21,000)</option>
                      <option value={ESIC_STATUS_APPLY_ABOVE_LIMIT}>Apply above Rs. 21,000</option>
                      <option value="No">No (Gross Salary &gt; Rs. 21,000)</option>
                      <option value="Exempt">Exempt / Custom Exception</option>
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Selected: <span className="font-semibold text-slate-700">{getEsicDisplayLabel(formData.esic)}</span>
                    </p>
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
                    <div className="flex flex-col gap-2 justify-center min-h-[34px]">
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
                          Enable PF/ESIC
                        </label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          name="ptEnabled"
                          checked={isEmployeePtEnabled(formData)}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, ptEnabled: e.target.checked }));
                          }}
                          className="w-4 h-4 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                          id="field-pt-enabled"
                        />
                        <label htmlFor="field-pt-enabled" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                          Enable Professional Tax
                        </label>
                      </div>
                      {(() => {
                        const loc = formData.location || "";
                        const isLocPfEsic = loc ? !!locationCompliance[loc] : false;
                        const isLocPt = loc ? !!locationPtEnabled[loc] : false;
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-[9px] font-black uppercase tracking-wider ${isLocPfEsic ? "text-emerald-600" : "text-rose-500"}`}>
                              Loc PF/ESIC: {isLocPfEsic ? "ON" : "OFF"}
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-wider ${isLocPt ? "text-emerald-600" : "text-rose-500"}`}>
                              Loc PT: {isLocPt ? "ON" : "OFF"}
                            </span>
                          </div>
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
                    const isCompliant = isPfEsicCompliant(formData, locationCompliance);
                    const isPtEnabled = isProfessionalTaxApplicable(formData, locationPtEnabled);
                    const previewGross = Number(formData.grossSalary) || 0;
                    const previewBasic = Number(formData.basicSalary) || 0;
                    const { pfWage, employeePf, employerPf } = calculatePfAmounts(previewGross, {
                      mode: formData.pfCalculationMode,
                      monthlyBasic: previewBasic,
                      isCompliant,
                    });
                    const ptPreview = calculateProfessionalTax(previewGross, {
                      isPtEnabled,
                      gender: formData.gender,
                    });
                    const modeLabel =
                      resolvePfCalculationMode(formData.pfCalculationMode) === "gross"
                        ? "PF wage = this month's gross salary"
                        : "PF wage = basic if below ₹15,000, else ₹15,000";
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
                        {isPtEnabled && previewGross > 0 ? (
                          <>
                            {" "}
                            Professional Tax (PT) ₹{ptPreview.toLocaleString("en-IN")} based on {formData.gender || "gender"} slab.
                          </>
                        ) : null}
                      </p>
                    );
                  })()}
                </div>

                <p className="text-[10px] text-slate-400 mt-2.5">
                  💡 <strong>Indian Payroll Rule Check:</strong> ESIC eligibility is auto-enabled for monthly salaries of Rs. 21,000 or below, and you can now manually apply ESIC above Rs. 21,000 from the dropdown when needed. Basic Salary is mapped as 50% of gross as default. PF uses gross for the active salary month (prorated by attendance on the salary sheet). PF/ESIC applies when enabled on the employee or office location. PT applies when enabled on the employee or a PT-levying office location.
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
            <div className="rounded-xl border border-slate-100 bg-white p-4 sm:p-5 shadow-xs space-y-4 animate-fade-in" id="identity-fields-group">
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
            <div className="rounded-xl border border-slate-100 bg-white p-4 sm:p-5 shadow-xs space-y-4 animate-fade-in" id="bank-fields-group">
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
            <div className="rounded-xl border border-slate-100 bg-white p-4 sm:p-5 shadow-xs space-y-5 animate-fade-in" id="family-fields-group">
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

          {/* TAB: EMPLOYEE DOCUMENTS */}
          {activeTab === "documents" && (
            <div className="rounded-xl border border-slate-100 bg-white p-4 sm:p-5 shadow-xs animate-fade-in">
              {documentsEmployee ? (
                <>
                  {createdEmployee && !isEdit && (
                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      Employee saved. Upload PAN, Aadhaar, passbook, or other proofs below.
                    </div>
                  )}
                  <EmployeeDocumentsPanel employeeId={documentsEmployee.id} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#ff791a]">
                    <FolderOpen size={28} />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-800">Upload employee documents</h3>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">
                    Attach PAN, Aadhaar, bank passbook, appointment letter, and other proofs after the employee
                    record is saved. Save the form first, then return here to upload files.
                  </p>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#ff791a] px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#e56a12] disabled:opacity-50"
                    id="btn-save-and-upload-docs"
                  >
                    {isSubmitting ? (
                      "Saving..."
                    ) : (
                      <>
                        <Check size={14} />
                        Save Employee & Upload Documents
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DYNAMIC CUSTOM FIELDS */}
          {activeTab === "custom" && (
            <div className="rounded-xl border border-slate-100 bg-white p-4 sm:p-5 shadow-xs space-y-6 animate-fade-in" id="custom-fields-group">
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

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="hidden text-[11px] font-medium text-slate-400 sm:block">
            {createdEmployee && !isEdit ? (
              <span className="inline-flex items-center gap-1.5">
                <FolderOpen size={12} className="text-[#ff791a]" />
                Upload documents for {createdEmployee.employeeCode}
              </span>
            ) : isEdit ? (
              <span className="inline-flex items-center gap-1.5">
                <Edit3 size={12} className="text-[#ff791a]" />
                Editing {formData.employeeCode || employee?.employeeCode}
              </span>
            ) : (
              "Complete all tabs before saving — use Documents to attach proofs after save"
            )}
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => {
                if (createdEmployee && !isEdit && activeTab === "documents") {
                  onClose();
                  return;
                }
                void requestClose();
              }}
              type="button"
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              id="btn-cancel-onboard"
            >
              {createdEmployee && !isEdit && activeTab === "documents" ? "Finish" : "Cancel"}
            </button>
            {!(createdEmployee && !isEdit && activeTab === "documents") && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#ff791a] px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#e56a12] disabled:opacity-50"
              id="btn-save-onboard"
            >
              {isSubmitting ? (
                "Saving..."
              ) : (
                <>
                  <Check size={14} />
                  {isEdit ? "Update Employee" : "Save Employee"}
                </>
              )}
            </button>
            )}
          </div>
        </div>

        </div>
      </div>

      {showAddLocationInput && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={resetQuickAddLocationForm}
            aria-hidden
          />
          <div
            className="relative w-full max-w-md rounded-2xl border border-orange-200 bg-white p-5 shadow-2xl animate-fade-in"
            id="quick-add-location-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <MapPin size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Add branch office</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Register a new location with compliance and PT settings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetQuickAddLocationForm}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                id="btn-cancel-new-location"
              >
                <X size={18} />
              </button>
            </div>

            <label
              htmlFor="new-location-name-input-field"
              className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-slate-500"
            >
              Office location name
            </label>
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
              className="mt-1.5 w-full rounded-lg border border-slate-250 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              id="new-location-name-input-field"
              autoFocus
            />

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2.5">
              <label htmlFor="inline-new-loc-compliance" className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="inline-new-loc-compliance"
                  checked={newLocationCompliance}
                  onChange={(e) => setNewLocationCompliance(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer shrink-0"
                />
                <span className="text-[11px] font-bold text-slate-650 leading-snug">
                  Enable PF/ESIC compliance
                </span>
              </label>
              <label htmlFor="inline-new-loc-pt" className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="inline-new-loc-pt"
                  checked={newLocationPtEnabled}
                  onChange={(e) => setNewLocationPtEnabled(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer shrink-0"
                />
                <span className="text-[11px] font-bold text-slate-650 leading-snug">
                  Enable Professional Tax (state-specific)
                </span>
              </label>
              <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 leading-relaxed space-y-1.5">
                <p className="font-bold text-slate-600">Professional Tax slabs</p>
                <p><span className="font-semibold text-slate-600">Male:</span> {PROFESSIONAL_TAX_SLAB_SUMMARY.male.map((row) => `${row.range} → ${row.amount}`).join("; ")}</p>
                <p><span className="font-semibold text-slate-600">Female:</span> {PROFESSIONAL_TAX_SLAB_SUMMARY.female.map((row) => `${row.range} → ${row.amount}`).join("; ")}</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  resetQuickAddLocationForm();
                }}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
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
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#f57416] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#e4640c] disabled:opacity-40"
                id="btn-confirm-new-location"
              >
                <Check size={14} className="stroke-[3]" /> Add Branch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
