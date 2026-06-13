/**
 * Core HRMS application state and handlers (extracted from App.tsx).
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Users, 
  UserPlus, 
  TrendingUp, 
  IndianRupee, 
  HelpCircle, 
  FileSpreadsheet, 
  Heart, 
  RotateCw,
  Plus,
  Search,
  Shield,
  CalendarOff,
  Calendar,
  CheckCircle,
  Clock,
  Briefcase,
  UserCircle,
  Target,
  LayoutDashboard,
  Contact,
  Wrench,
  Coins,
  Calculator,
  Megaphone,
  LogOut,
  ChevronDown,
  ChevronUp,
  Menu,
  Settings,
  Bell,
  Lock,
  User,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  Building,
  CheckCircle2,
  FileText,
  BarChart4,
  Edit2,
  Check,
  X,
  Trash2,
  Gift,
  Cake,
  Phone,
  Mail,
  Globe,
  Filter,
  CheckSquare,
  Square,
  Archive,
  Download,
  Eye,
  School,
} from "lucide-react";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Employee, EmployeeChangeRequest, EXCEL_ROW_HEADERS, SchoolWork, SCHOOL_EXCEL_ROW_HEADERS } from "../types";
import {
  BULK_EDIT_FIELDS,
  buildCustomFieldsAfterEdit,
  buildMergedEmployee,
  buildSubmissionPayload,
  getEmployeeFieldValue,
  getOriginalCustomFieldValue,
  resolveEmployeeRecordId,
} from "../lib/employee-bulk-edit-fields";
import {
  applySalaryFieldChange,
  isSalaryCascadeField,
  toSalaryFieldValues,
  type SalaryAnchor,
} from "../lib/salary-calc";
import PasswordInput from "../components/PasswordInput";
import {
  generateCSV,
  getEmployeeHeaderValue,
  normalizeSkillCategory,
  employeeMatchesSkillFilters,
  prorateSalaryByAttendance,
  isEmployeeEsicCovered,
  parseLocationPtInput,
  calculatePfAmounts,
  calculateProfessionalTax,
  resolveLocationPtAmount,
  DEFAULT_LOCATION_PT_AMOUNT,
  quoteCSVValue,
  downloadAxisBulkPayXls,
  saveAxisBulkPayArchive,
  getAxisDebitAccountNo,
  buildAxisBulkPayFilename,
  parseMonthYear,
  parseBulkPayXlsWorkbook,
  getBulkPayPreviewHeaderRowCount,
} from "../utils";
import { formatAuditLogDetails } from "../utils/formatAuditLogDetails";
import CsvImporter from "../components/CsvImporter";
import EmployeeTable from "../components/EmployeeTable";
import EmployeeFormModal from "../components/EmployeeFormModal";
import SchoolWorkImporter from "../components/SchoolWorkImporter";
import SchoolWorkTable from "../components/SchoolWorkTable";
import SchoolWorkFormModal from "../components/SchoolWorkFormModal";
import BlockMonthlyExpensePanel from "../components/BlockMonthlyExpensePanel";
import SchoolExpensesSalaryTab, {
  buildSchoolExpenseSalaryCsv,
  SCHOOL_EXPENSE_SALARY_HEADERS,
  getSchoolExpenseSalaryRow,
} from "../components/SchoolExpensesSalaryTab";
import { getSchoolHeaderValue } from "../lib/school-work-helpers";
import { parseApiError } from "../api";
import {
  loadPayrollConfig,
  savePayrollConfig,
  validatePayrollConfig,
  type PayrollConfig,
} from "../lib/hrms-config";
import {
  getCurrentFY, getFinancialYears, MONTH_NAME_LIST, getMonthsForFY,
  getCalendarYearFromFYRange, normalizeMonthKey, safeNumber, getDaysInMonthStatic,
  getCurrentMonthName, getTodayBirthdayLabel, getOrdinalDay, parseDateOfBirth,
  formatEmployeeBirthDate,
} from "../lib/date-helpers";
import { isEmployeeExitedGeneral, isEmployeeExitedOnDayStatic, isEmployeeExitedForMonth } from "../lib/employee-helpers";
import { getSalaryColumnValue } from "../lib/salary-columns";
import { getModuleKey, PERMISSION_MODULES, SidebarItemDef } from "../lib/permissions";
import { tabToPath, pathToTab, DEFAULT_PATH } from "../routes";
import PercentIcon from "../components/ui/PercentIcon";
import DialerOverlay from "../components/ui/DialerOverlay";
import DirectoryContactCard from "../components/DirectoryContactCard";
import { formatPhoneDisplay, phoneToDialString } from "../lib/phone-helpers";
import ConfettiRain from "../components/ui/ConfettiRain";
import ExcelPreviewGrid from "../components/ExcelPreviewGrid";
import BirthdaysTab from "../components/BirthdaysTab";

function applyBulkEditDraftUpdate(
  prev: Record<string, Partial<Employee>>,
  anchors: Record<string, SalaryAnchor | null>,
  employees: Employee[],
  employeeId: string,
  field: keyof Employee,
  value: string,
  basicSalaryPercent: number,
  esicEligibilityLimit: number,
): {
  drafts: Record<string, Partial<Employee>>;
  anchors: Record<string, SalaryAnchor | null>;
} {
  const emp = employees.find((e) => resolveEmployeeRecordId(e) === employeeId);
  if (!emp) return { drafts: prev, anchors };

  const fieldDef = BULK_EDIT_FIELDS.find((f) => f.key === field);
  const currentDraft = { ...(prev[employeeId] || {}) };
  const nextDraft: Partial<Employee> = { ...currentDraft };
  const nextAnchors = { ...anchors };

  if (isSalaryCascadeField(field)) {
    const merged = buildMergedEmployee(emp, currentDraft);
    const currentSalary = toSalaryFieldValues(merged);
    const currentAnchor = anchors[employeeId] ?? null;
    const { values, anchor } = applySalaryFieldChange(
      currentSalary,
      currentAnchor,
      field,
      value,
      basicSalaryPercent,
      esicEligibilityLimit,
    );
    nextAnchors[employeeId] = anchor;

    for (const salaryField of [
      "grossSalary",
      "dailyWage",
      "basicSalary",
      "workingDaysType",
      "esic",
    ] as const) {
      const originalVal = getEmployeeFieldValue(emp, salaryField);
      const newVal =
        salaryField === "workingDaysType"
          ? values.workingDaysType
          : salaryField === "esic"
            ? values.esic
            : String(values[salaryField]);

      if (newVal === originalVal || (newVal === "0" && originalVal === "")) {
        delete (nextDraft as Record<string, unknown>)[salaryField];
      } else if (salaryField === "esic" || salaryField === "workingDaysType") {
        (nextDraft as Record<string, unknown>)[salaryField] = newVal;
      } else {
        (nextDraft as Record<string, unknown>)[salaryField] = Number(newVal) || 0;
      }
    }
  } else {
    const originalVal = getEmployeeFieldValue(emp, field);
    let comparableNew = value;
    if (fieldDef?.type === "boolean") {
      comparableNew = value;
      (nextDraft as Record<string, unknown>)[field] = value === "Yes";
    } else if (fieldDef?.type === "number") {
      comparableNew = String(Number(value) || 0);
      (nextDraft as Record<string, unknown>)[field] = Number(value) || 0;
    } else {
      (nextDraft as Record<string, unknown>)[field] = value;
    }

    if (comparableNew === originalVal || (value === "" && originalVal === "")) {
      delete (nextDraft as Record<string, unknown>)[field];
    }
  }

  if (Object.keys(nextDraft).length === 0) {
    const { [employeeId]: _, ...rest } = prev;
    const { [employeeId]: __, ...restAnchors } = nextAnchors;
    return { drafts: rest, anchors: restAnchors };
  }
  return { drafts: { ...prev, [employeeId]: nextDraft }, anchors: nextAnchors };
}

function applyBulkEditCustomFieldUpdate(
  prev: Record<string, Partial<Employee>>,
  employees: Employee[],
  employeeId: string,
  fieldName: string,
  value: string,
): Record<string, Partial<Employee>> {
  const emp = employees.find((e) => resolveEmployeeRecordId(e) === employeeId);
  if (!emp) return prev;

  const currentDraft = prev[employeeId] || {};
  const originalVal = getOriginalCustomFieldValue(emp, fieldName);
  const nextDraft: Partial<Employee> = { ...currentDraft };

  if (value === originalVal) {
    const mergedCustom = buildCustomFieldsAfterEdit(emp, currentDraft, fieldName, value);
    const stillDirty = mergedCustom.some(
      (f) => getOriginalCustomFieldValue(emp, f.name) !== (f.value ?? ""),
    );
    if (stillDirty) nextDraft.customFields = mergedCustom;
    else delete nextDraft.customFields;
  } else {
    nextDraft.customFields = buildCustomFieldsAfterEdit(emp, currentDraft, fieldName, value);
  }

  if (Object.keys(nextDraft).length === 0) {
    const { [employeeId]: _, ...rest } = prev;
    return rest;
  }
  return { ...prev, [employeeId]: nextDraft };
}

export function useHRMSApp() {
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication & Session
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("hrms_logged_in") === "true" && !!localStorage.getItem("hrms_session_token");
  });
  const [sessionUser, setSessionUser] = useState<string>(() => {
    return localStorage.getItem("hrms_username") || "admin";
  });
  const [sessionRole, setSessionRole] = useState<string>(() => {
    return localStorage.getItem("hrms_role") || "admin";
  });
  const [sessionLocations, setSessionLocations] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("hrms_locations");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [sessionPermissions, setSessionPermissions] = useState<Record<string, { view: boolean; edit: boolean }> | null>(null);
  
  // Custom Roles & Permissions States
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [isFetchingRoles, setIsFetchingRoles] = useState(false);
  
  // Login Form States
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginView, setLoginView] = useState<"signin" | "forgot" | "reset">("signin");
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [issuedResetToken, setIssuedResetToken] = useState<string | null>(null);
  const [resetTokenInput, setResetTokenInput] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Admin module invitation states
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteLocations, setInviteLocations] = useState<string[]>([]);
  const [editingAdminUsername, setEditingAdminUsername] = useState<string | null>(null);
  const [editAdminRole, setEditAdminRole] = useState<string>("");
  const [editAdminLocations, setEditAdminLocations] = useState<string[]>([]);
  const [editAdminDisabled, setEditAdminDisabled] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isFetchingAdmins, setIsFetchingAdmins] = useState(false);

  // Custom Roles Editor States
  const [roleNameInput, setRoleNameInput] = useState("");
  const [roleDescInput, setRoleDescInput] = useState("");
  const [rolePermsInput, setRolePermsInput] = useState<Record<string, { view: boolean; edit: boolean }>>({
    employees: { view: true, edit: true },
    schoolWork: { view: true, edit: true },
    salary: { view: false, edit: false },
    ledger: { view: false, edit: false },
    attendance: { view: true, edit: true },
    leave: { view: true, edit: true },
    birthdays: { view: true, edit: false },
    directory: { view: true, edit: false },
    admin: { view: false, edit: false }
  });
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null);



  const PERMISSION_MODULES = ["employees", "schoolWork", "salary", "ledger", "attendance", "leave", "birthdays", "directory", "admin"] as const;

  const applySessionFromAuthMe = (data: {
    username?: string;
    role?: string;
    locations?: string[];
    permissions?: Record<string, { view?: boolean; edit?: boolean }>;
  }) => {
    if (data.username) {
      setSessionUser(data.username);
      localStorage.setItem("hrms_username", data.username);
    }
    if (data.role) {
      setSessionRole(data.role);
      localStorage.setItem("hrms_role", data.role);
    }
    if (data.locations) {
      setSessionLocations(data.locations);
      localStorage.setItem("hrms_locations", JSON.stringify(data.locations));
    }
    if (data.permissions) {
      const normalized: Record<string, { view: boolean; edit: boolean }> = {};
      PERMISSION_MODULES.forEach((m) => {
        const perm = data.permissions?.[m];
        normalized[m] = { view: !!perm?.view, edit: !!perm?.edit };
      });
      setSessionPermissions(normalized);
    }
  };

  // Parse permissions dynamically — prefer server session from /api/auth/me
  const userPermissions = useMemo(() => {
    const isSuperAdmin = String(sessionRole || "").toLowerCase() === "admin" || String(sessionUser || "").toLowerCase() === "admin";
    const result: Record<string, { view: boolean; edit: boolean }> = {};

    PERMISSION_MODULES.forEach(m => {
      if (isSuperAdmin) {
        result[m] = { view: true, edit: true };
      } else if (sessionPermissions?.[m]) {
        result[m] = sessionPermissions[m];
      } else {
        const matchedRole = rolesList.find(r => String(r.name || "").toLowerCase() === String(sessionRole || "").toLowerCase());
        const perm = matchedRole?.permissions?.[m];
        result[m] = {
          view: !!perm?.view,
          edit: !!perm?.edit,
        };
      }
    });
    return result;
  }, [sessionRole, sessionUser, rolesList, sessionPermissions]);

  // Fetch Roles list
  const fetchRoles = async () => {
    setIsFetchingRoles(true);
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        setRolesList(data);
      }
    } catch (err) {
      console.error("Error fetching roles list: ", err);
    } finally {
      setIsFetchingRoles(false);
    }
  };



  // Application Layout States
  const activeSidebarTab = pathToTab(location.pathname);
  const setActiveSidebarTab = (tab: string) => navigate(tabToPath(tab));
  const [activePimSubTab, setActivePimSubTab] = useState("Employee List");
  const [activeSchoolSubTab, setActiveSchoolSubTab] = useState("School Salary");
  const [expandedSidebarGroups, setExpandedSidebarGroups] = useState<Record<string, boolean>>({
    "School Work": false,
  });
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth < 768 : true;
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const mobileProfileDropdownRef = useRef<HTMLDivElement>(null);

  // My Info & Change Password States
  const [adminProfileInfo, setAdminProfileInfo] = useState<any | null>(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [profileLoadingError, setProfileLoadingError] = useState<string | null>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState("");
  const [profileEmailError, setProfileEmailError] = useState<string | null>(null);
  const [profileEmailSuccess, setProfileEmailSuccess] = useState<string | null>(null);
  const [isSavingProfileEmail, setIsSavingProfileEmail] = useState(false);

  // School Work Registry States
  const [rawSchoolWorks, setRawSchoolWorks] = useState<SchoolWork[]>([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [isSchoolFormOpen, setIsSchoolFormOpen] = useState(false);
  const [currentSchool, setCurrentSchool] = useState<SchoolWork | null>(null);
  const [isSchoolLoading, setIsSchoolLoading] = useState(false);

  // Employee Registry Core States
  const [rawEmployees, setRawEmployees] = useState<Employee[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Configuration States (Fully interactive!)
  const [savedPayrollConfig, setSavedPayrollConfig] = useState(() => loadPayrollConfig());
  const [esicEligibilityLimit, setEsicEligibilityLimit] = useState(savedPayrollConfig.esicEligibilityLimit);
  const [basicSalaryPercentage, setBasicSalaryPercentage] = useState(savedPayrollConfig.basicSalaryPercentage);
  const [companyBranch, setCompanyBranch] = useState(savedPayrollConfig.companyBranch);
  const [configValidationError, setConfigValidationError] = useState<string | null>(null);
  const [isSavingPayrollConfig, setIsSavingPayrollConfig] = useState(false);

  // Custom locations list with sync and edit capabilities
  const [rawCustomLocations, setRawCustomLocations] = useState<string[]>([]);
  const [registeredLocations, setRegisteredLocations] = useState<string[]>([]);
  const [locationCompliance, setLocationCompliance] = useState<Record<string, boolean>>({});
  const [locationPtAmounts, setLocationPtAmounts] = useState<Record<string, number>>({});
  const [isFetchingLocations, setIsFetchingLocations] = useState(false);
  const [newLocCompliance, setNewLocCompliance] = useState(true);
  const [newLocPtAmount, setNewLocPtAmount] = useState(String(DEFAULT_LOCATION_PT_AMOUNT));

  const persistLocationPtAmounts = (updated: Record<string, number>) => {
    setLocationPtAmounts(updated);
  };

  const updateLocationPtAmount = async (loc: string, rawValue: string) => {
    const fallback = resolveLocationPtAmount(loc, locationPtAmounts);
    const amount = parseLocationPtInput(rawValue, fallback);
    persistLocationPtAmounts({ ...locationPtAmounts, [loc]: amount });
    try {
      const res = await fetch(`/api/locations/${encodeURIComponent(loc)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ptAmount: amount }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to update location PT amount.");
      await fetchLocations();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update location PT amount.");
    }
  };

  const updateLocationCompliance = async (loc: string, enabled: boolean) => {
    setLocationCompliance((prev) => ({ ...prev, [loc]: enabled }));
    try {
      const res = await fetch(`/api/locations/${encodeURIComponent(loc)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complianceEnabled: enabled }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to update location compliance.");
      await fetchLocations();
      triggerSuccess(`Compliance calculations ${enabled ? "enabled" : "disabled"} for location "${loc}"`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update location compliance.");
    }
  };

  // Computed employees and customLocations to implement Location-Based Access Control (LBAC)
  const employees = useMemo(() => {
    const isLocationRestricted = isLoggedIn && sessionUser !== "admin" && Array.isArray(sessionLocations) && sessionLocations.length > 0;
    if (isLocationRestricted) {
      return rawEmployees.filter(
        (e) =>
          e.location &&
          sessionLocations.some((sl) => sl.toLowerCase() === e.location!.toLowerCase())
      );
    }
    return rawEmployees;
  }, [rawEmployees, isLoggedIn, sessionUser, sessionLocations]);

  const customLocations = useMemo(() => {
    const isLocationRestricted = isLoggedIn && sessionUser !== "admin" && Array.isArray(sessionLocations) && sessionLocations.length > 0;
    if (isLocationRestricted) {
      return rawCustomLocations.filter((loc) =>
        sessionLocations.some((sl) => sl.toLowerCase() === loc.toLowerCase())
      );
    }
    return rawCustomLocations;
  }, [rawCustomLocations, isLoggedIn, sessionUser, sessionLocations]);

  const registryLocations = useMemo(() => {
    const isLocationRestricted = isLoggedIn && sessionUser !== "admin" && Array.isArray(sessionLocations) && sessionLocations.length > 0;
    if (isLocationRestricted) {
      return registeredLocations.filter((loc) =>
        sessionLocations.some((sl) => sl.toLowerCase() === loc.toLowerCase())
      );
    }
    return registeredLocations;
  }, [registeredLocations, isLoggedIn, sessionUser, sessionLocations]);

  const fetchLocations = useCallback(async () => {
    setIsFetchingLocations(true);
    try {
      const res = await fetch("/api/locations");
      if (!res.ok) throw await parseApiError(res, "Failed to fetch locations.");
      const data = await res.json();
      const locationRecords = Array.isArray(data) ? data : [];
      const apiLocations = locationRecords.map((loc: any) => loc.name).filter(Boolean);
      const empLocations = rawEmployees.map((e) => e.location).filter(Boolean) as string[];
      setRegisteredLocations(apiLocations);
      setRawCustomLocations(Array.from(new Set([...apiLocations, ...empLocations])));

      const complianceMap: Record<string, boolean> = {};
      const ptMap: Record<string, number> = {};
      locationRecords.forEach((loc: any) => {
        if (!loc.name) return;
        complianceMap[loc.name] = !!loc.complianceEnabled;
        ptMap[loc.name] = Number(loc.ptAmount || 0);
      });
      setLocationCompliance(complianceMap);
      setLocationPtAmounts(ptMap);
    } catch (err: any) {
      setErrorMessage(err.message || "Could not load locations.");
    } finally {
      setIsFetchingLocations(false);
    }
  }, [rawEmployees]);

  // Custom roles list with sync and edit capabilities
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [registeredJobRoles, setRegisteredJobRoles] = useState<string[]>([]);
  const [isFetchingJobRoles, setIsFetchingJobRoles] = useState(false);

  const fetchJobRoles = useCallback(async () => {
    setIsFetchingJobRoles(true);
    try {
      const res = await fetch("/api/job-roles");
      if (!res.ok) throw await parseApiError(res, "Failed to fetch job roles.");
      const data = await res.json();
      const apiRoles = Array.isArray(data) ? data.map((role: any) => role.name).filter(Boolean) : [];
      const empRoles = rawEmployees.map(e => e.role).filter(Boolean) as string[];
      setRegisteredJobRoles(apiRoles);
      setCustomRoles(Array.from(new Set([...apiRoles, ...empRoles])));
    } catch (err: any) {
      setErrorMessage(err.message || "Could not load job roles.");
    } finally {
      setIsFetchingJobRoles(false);
    }
  }, [rawEmployees]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchLocations();
      fetchJobRoles();
    }
  }, [isLoggedIn, fetchLocations, fetchJobRoles]);

  // ==========================================
  // ENTERPRISE SECURITY AUDIT TRAIL & EVENT LOGS ENGINE
  // ==========================================

  // Security Audit Trail States
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [isFetchingAuditLogs, setIsFetchingAuditLogs] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilterAdmin, setAuditFilterAdmin] = useState("");
  const [auditFilterAction, setAuditFilterAction] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showFlushAuditModal, setShowFlushAuditModal] = useState(false);
  const [flushAuditPassword, setFlushAuditPassword] = useState("");
  const [flushAuditError, setFlushAuditError] = useState<string | null>(null);
  const [isFlushingAuditLogs, setIsFlushingAuditLogs] = useState(false);

  const [bulkPayArchives, setBulkPayArchives] = useState<any[]>([]);
  const [isFetchingBulkPayArchives, setIsFetchingBulkPayArchives] = useState(false);
  const [isExportingBulkPay, setIsExportingBulkPay] = useState(false);
  const [lastSavedBulkPay, setLastSavedBulkPay] = useState<any | null>(null);
  const [highlightedBulkPayId, setHighlightedBulkPayId] = useState<string | null>(null);
  const [bulkPayArchiveYearFilter, setBulkPayArchiveYearFilter] = useState("");
  const [bulkPayPreview, setBulkPayPreview] = useState<{
    id: string;
    filename: string;
    sheetNames: string[];
    activeSheet: string;
    sheets: Record<string, string[][]>;
    loading: boolean;
  } | null>(null);
  const bulkPayJustSavedRef = useRef(false);

  const updateBulkPayDownloadCount = (id: string, downloadCount: number) => {
    setBulkPayArchives((prev) =>
      prev.map((item: any) =>
        item.id === id ? { ...item, downloadCount } : item
      )
    );
    setLastSavedBulkPay((prev: any) =>
      prev?.id === id ? { ...prev, downloadCount } : prev
    );
  };

  const fetchBulkPayArchives = async (yearFilter?: string) => {
    setIsFetchingBulkPayArchives(true);
    try {
      const params = new URLSearchParams();
      const year = yearFilter ?? bulkPayArchiveYearFilter;
      if (year) params.set("year", year);
      const query = params.toString();
      const res = await fetch(`/api/bulk-pay-exports${query ? `?${query}` : ""}`);
      if (!res.ok) throw new Error("Failed to load saved bulk pay files.");
      const data = await res.json();
      setBulkPayArchives(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Bulk pay archive fetch error:", err);
    } finally {
      setIsFetchingBulkPayArchives(false);
    }
  };

  const handleDownloadBulkPayArchive = async (id: string, filename: string) => {
    try {
      const res = await fetch(`/api/bulk-pay-exports/${id}/download`);
      if (!res.ok) throw await parseApiError(res, "Could not download archived bulk pay file.");
      const downloadCountHeader = res.headers.get("X-Download-Count");
      if (downloadCountHeader) {
        updateBulkPayDownloadCount(id, Number(downloadCountHeader));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage(err.message || "Could not download archived bulk pay file.");
    }
  };

  const handleViewBulkPayArchive = async (id: string, filename: string) => {
    setBulkPayPreview({
      id,
      filename,
      sheetNames: [],
      activeSheet: "",
      sheets: {},
      loading: true,
    });
    try {
      const res = await fetch(`/api/bulk-pay-exports/${id}/preview`);
      if (!res.ok) throw await parseApiError(res, "Could not load file for preview.");
      const buffer = await res.arrayBuffer();
      const workbook = parseBulkPayXlsWorkbook(buffer);
      setBulkPayPreview({
        id,
        filename,
        sheetNames: workbook.sheetNames,
        activeSheet: workbook.defaultSheet,
        sheets: workbook.sheets,
        loading: false,
      });
    } catch (err: any) {
      setBulkPayPreview(null);
      setErrorMessage(err.message || "Could not preview archived bulk pay file.");
    }
  };

  const handleDeleteBulkPayArchive = async (id: string) => {
    const confirmed = await confirmAction({
      title: "Delete archived file",
      message: "Delete this archived bulk pay file from the server? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/bulk-pay-exports/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      if (lastSavedBulkPay?.id === id) setLastSavedBulkPay(null);
      if (highlightedBulkPayId === id) setHighlightedBulkPayId(null);
      await fetchBulkPayArchives();
      triggerSuccess("Archived bulk pay file removed.");
    } catch (err: any) {
      setErrorMessage(err.message || "Could not delete archived bulk pay file.");
    }
  };

  const bulkPayArchiveYears = useMemo(() => {
    const years = new Set<string>();
    bulkPayArchives.forEach((item: any) => {
      if (item.year) {
        years.add(String(item.year));
      } else if (item.month) {
        const parsed = parseMonthYear(item.month);
        if (parsed.year) years.add(parsed.year);
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [bulkPayArchives]);

  const filteredBulkPayArchives = useMemo(() => {
    let list = bulkPayArchives;
    if (bulkPayArchiveYearFilter) {
      list = list.filter((item: any) => {
        const year = item.year || parseMonthYear(item.month).year;
        return year === bulkPayArchiveYearFilter;
      });
    }
    if (lastSavedBulkPay?.id && !list.some((item: any) => item.id === lastSavedBulkPay.id)) {
      list = [lastSavedBulkPay, ...list];
    }
    return list;
  }, [bulkPayArchives, bulkPayArchiveYearFilter, lastSavedBulkPay]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogsList
      .filter((log: any) => {
        if (!log) return false;
        if (auditSearch.trim()) {
          const query = auditSearch.toLowerCase();
          const matchesId = String(log.id || "").toLowerCase().includes(query);
          const matchesUser = String(log.username || "").toLowerCase().includes(query);
          const matchesAction = String(log.action || "").toLowerCase().includes(query);
          const matchesTarget = String(log.target || "").toLowerCase().includes(query);
          const detailsStr = typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details);
          const matchesDetails = detailsStr.toLowerCase().includes(query);
          if (!matchesId && !matchesUser && !matchesAction && !matchesTarget && !matchesDetails) {
            return false;
          }
        }
        if (auditFilterAdmin && log.username !== auditFilterAdmin) {
          return false;
        }
        if (auditFilterAction && log.action !== auditFilterAction) {
          return false;
        }
        return true;
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
  }, [auditLogsList, auditSearch, auditFilterAdmin, auditFilterAction]);

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    setIsFetchingAuditLogs(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/audit-logs");
      if (!res.ok) {
        throw new Error("Failed to fetch audit logs from the server.");
      }
      const data = await res.json();
      const sorted = Array.isArray(data)
        ? [...data].sort(
            (a: any, b: any) =>
              new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          )
        : [];
      setAuditLogsList(sorted);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Could not load security audit trail.");
    } finally {
      setIsFetchingAuditLogs(false);
    }
  };

  const openFlushAuditModal = () => {
    setFlushAuditPassword("");
    setFlushAuditError(null);
    setShowFlushAuditModal(true);
  };

  const closeFlushAuditModal = () => {
    setShowFlushAuditModal(false);
    setFlushAuditPassword("");
    setFlushAuditError(null);
  };

  // Flush / Clear Audit Logs (Root admin only — password verified server-side)
  const handleFlushAuditLogs = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!flushAuditPassword.trim()) {
      setFlushAuditError("Enter password to flush trail.");
      return;
    }
    setFlushAuditError(null);
    setIsFlushingAuditLogs(true);
    try {
      const res = await fetch("/api/audit-logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: flushAuditPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to flush audit logs");
      }
      closeFlushAuditModal();
      triggerSuccess("Security audit trail flushed successfully!");
      fetchAuditLogs();
    } catch (err: any) {
      setFlushAuditError(err.message || "Failed to clear logs.");
    } finally {
      setIsFlushingAuditLogs(false);
    }
  };

  // Export Audit Trail to PDF
  const handleExportAuditPDF = () => {
    try {
      const doc = new jsPDF("landscape", "mm", "a4");
      
      doc.setFillColor(255, 121, 26); // flex orange
      doc.rect(0, 0, 297, 25, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("FLEX HRM - ENTERPRISE SECURITY AUDIT TRAIL", 15, 16);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleString()} | Administrator: ${sessionUser}`, 200, 16);
      
      const bodyData = auditLogsList.map((log: any) => [
        log.id || "",
        new Date(log.timestamp).toLocaleString(),
        log.username || "System",
        log.action || "",
        log.target || "",
        typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details)
      ]);
      
      autoTable(doc, {
        startY: 32,
        head: [["LOG ID", "TIMESTAMP", "PERFORMER", "ACTION CATEGORY", "TARGET ENTITY", "FORENSIC PAYLOAD DETAILS"]],
        body: bodyData,
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 8,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { cellWidth: 40 },
          4: { cellWidth: 50 },
          5: { cellWidth: "auto" }
        },
        margin: { left: 10, right: 10 }
      });
      
      doc.save(`security_audit_trail_${new Date().toISOString().split("T")[0]}.pdf`);
      triggerSuccess("PDF Audit report generated successfully!");

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXPORT_AUDIT_PDF",
          target: `Security PDF Document: Downloaded compliance security audit trail report (A4 landscape orientation) containing all ${auditLogsList.length} active system event logs.`,
          details: { format: "PDF", recordCount: auditLogsList.length }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Failed to export PDF: " + err.message);
    }
  };

  // Export Audit Trail to Excel
  const handleExportAuditExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Security Audit Trail");
      
      ws.pageSetup = { orientation: "landscape" };
      
      ws.addRow(["Flex HRM Security Audit Trail & Event Logs"]);
      ws.addRow([`Report Generated: ${new Date().toLocaleString()} | Performed by: ${sessionUser}`]);
      ws.addRow([`Active Log Trail Events: ${auditLogsList.length}`]);
      ws.addRow([]);
      
      ws.getRow(1).font = { bold: true, size: 14, color: { argb: "FFF57416" }, name: "Calibri" };
      ws.getRow(2).font = { bold: true, size: 10, color: { argb: "FF334155" }, name: "Calibri" };
      ws.getRow(3).font = { italic: true, size: 9, color: { argb: "FF475569" }, name: "Calibri" };
      
      const cols = ["LOG ID", "TIMESTAMP", "PERFORMER", "ACTION CATEGORY", "TARGET ENTITY", "FORENSIC PAYLOAD DETAILS"];
      ws.addRow(cols);
      
      const headerRow = ws.getRow(5);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF791A" }
      };
      headerRow.alignment = { vertical: "middle", wrapText: true };
      headerRow.height = 24;
      
      auditLogsList.forEach((log: any) => {
        const detailsStr = typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details);
        ws.addRow([
          log.id || "",
          new Date(log.timestamp).toLocaleString(),
          log.username || "System",
          log.action || "",
          log.target || "",
          detailsStr
        ]);
      });
      
      ws.columns.forEach((col, cIdx) => {
        let maxTextLen = 0;
        col.eachCell({ includeEmpty: true }, (cell, rowNum) => {
          if (rowNum < 5) return;
          const strVal = cell.value ? cell.value.toString() : "";
          if (strVal.length > maxTextLen) {
            maxTextLen = strVal.length;
          }
        });
        col.width = Math.min(Math.max(maxTextLen + 4, 15), 50);
      });
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `security_audit_trail_${new Date().toISOString().split("T")[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      triggerSuccess("Excel Audit report exported successfully!");

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXPORT_AUDIT_EXCEL",
          target: `Security Excel Sheet: Downloaded compliance security audit trail report (custom green spreadsheet layout) containing all ${auditLogsList.length} active system event logs.`,
          details: { format: "Excel", recordCount: auditLogsList.length }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Failed to export Excel: " + err.message);
    }
  };

  // Validate server session on startup and after login (prevents stale localStorage-only auth)
  useEffect(() => {
    if (!isLoggedIn) return;
    const token = localStorage.getItem("hrms_session_token");
    if (!token) {
      handleLogout();
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error("Session invalid");
        return res.json();
      })
      .then((data) => {
        applySessionFromAuthMe(data);
      })
      .catch(() => {
        handleLogout();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // Fetch security audit logs when active tab is switched to Audit Logs
  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Audit Logs") {
      fetchAuditLogs();
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Saved Bulk Pay" && userPermissions.salary?.view) {
      if (bulkPayJustSavedRef.current) {
        bulkPayJustSavedRef.current = false;
        return;
      }
      fetchBulkPayArchives();
    }
  }, [isLoggedIn, activeSidebarTab, userPermissions.salary?.view]);

  // Handler to add a new custom location from the configuration tab
  const handleAddLocationFromConfig = async (locName: string, complianceVal: boolean = true, ptAmount?: number) => {
    const cleanName = locName.trim();
    if (!cleanName) return;
    
    if (rawCustomLocations.some(l => l.toLowerCase() === cleanName.toLowerCase())) {
      setErrorMessage(`Location "${cleanName}" already exists.`);
      return;
    }

    const parsedPt = ptAmount !== undefined ? ptAmount : parseFloat(newLocPtAmount);
    const ptVal = Number.isFinite(parsedPt) && parsedPt >= 0 ? Math.round(parsedPt) : DEFAULT_LOCATION_PT_AMOUNT;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName, complianceEnabled: complianceVal, ptAmount: ptVal }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to register location.");
      await fetchLocations();
      setNewLocNameInput("");
      setNewLocCompliance(true);
      setNewLocPtAmount(String(DEFAULT_LOCATION_PT_AMOUNT));
      triggerSuccess(`Successfully registered new location: "${cleanName}"`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to register location.");
    }
  };

  // Handler to edit/rename a custom location in bulk
  const handleEditLocationFromConfig = async (oldName: string, newName: string) => {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanOld || !cleanNew) return;
    if (cleanOld.toLowerCase() === cleanNew.toLowerCase()) return;

    try {
      setErrorMessage(null);
      const res = await fetch("/api/employees/rename-location", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ oldLocation: cleanOld, newLocation: cleanNew })
      });

      if (!res.ok) {
        throw new Error("Bulk location rename request rejected by server.");
      }

      const report = await res.json();
      
      await fetch(`/api/locations/${encodeURIComponent(cleanOld)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanNew }),
      });

      const updatedCompliance = { ...locationCompliance };
      if (updatedCompliance[cleanOld] !== undefined) {
        updatedCompliance[cleanNew] = updatedCompliance[cleanOld];
        delete updatedCompliance[cleanOld];
        setLocationCompliance(updatedCompliance);
      }

      const updatedPt = { ...locationPtAmounts };
      if (updatedPt[cleanOld] !== undefined) {
        updatedPt[cleanNew] = updatedPt[cleanOld];
        delete updatedPt[cleanOld];
        persistLocationPtAmounts(updatedPt);
      }

      // Refresh employees from the server to reflect location rename instantly
      await fetchEmployees();
      await fetchLocations();
      triggerSuccess(`Location renamed from "${cleanOld}" to "${cleanNew}" successfully! Updated ${report.count} employee record(s).`);
    } catch (err: any) {
      setErrorMessage("Failed to rename location: " + err.message);
    }
  };

  // Inline location editing support
  const [editingLocIndex, setEditingLocIndex] = useState<number | null>(null);
  const [editingLocValue, setEditingLocValue] = useState<string>("");
  const [newLocNameInput, setNewLocNameInput] = useState<string>("");
  const [selectedLocs, setSelectedLocs] = useState<string[]>([]);

  // Advance & Penalty Recording States
  const [ledgerEmployeeId, setLedgerEmployeeId] = useState("");
  const [ledgerType, setLedgerType] = useState<"advance" | "penalty" | "foodPerk" | "accommodationPerk" | "conveyancePerk">("advance");
  const [ledgerAmount, setLedgerAmount] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const saved = localStorage.getItem("hrms_selected_month");
    return normalizeMonthKey(saved);
  });

  const activeMonthName = useMemo(() => {
    return selectedMonth ? selectedMonth.split(" ")[0] : "January";
  }, [selectedMonth]);

  const activeCalendarYear = useMemo(() => {
    return selectedMonth ? selectedMonth.split(" ")[1] : String(new Date().getFullYear());
  }, [selectedMonth]);

  const activeFYRange = useMemo(() => {
    if (!selectedMonth) return "2025-2026";
    const parts = selectedMonth.split(" ");
    const monthName = parts[0];
    const calendarYearStr = parts[1] || String(new Date().getFullYear());
    const year = parseInt(calendarYearStr);
    const endMonthNames = ["January", "February", "March"];
    if (endMonthNames.includes(monthName)) {
      return `${year - 1}-${year}`;
    }
    return `${year}-${year + 1}`;
  }, [selectedMonth]);

  const MONTHS_LIST = useMemo(() => getMonthsForFY(activeFYRange), [activeFYRange]);

  // Advance & Penalty Month-wise Batch states
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState("");
  const [ledgerSelectedEmployeeIds, setLedgerSelectedEmployeeIds] = useState<string[]>([]);
  const [ledgerLocationFilters, setLedgerLocationFilters] = useState<string[]>([]);
  const [ledgerSkillFilters, setLedgerSkillFilters] = useState<string[]>([]);
  const [ledgerRoleFilters, setLedgerRoleFilters] = useState<string[]>([]);
  
  const [isLedgerLocationDropdownOpen, setIsLedgerLocationDropdownOpen] = useState(false);
  const [isLedgerSkillDropdownOpen, setIsLedgerSkillDropdownOpen] = useState(false);
  const [isLedgerRoleDropdownOpen, setIsLedgerRoleDropdownOpen] = useState(false);

  const ledgerUniqueLocations = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.location).filter(Boolean)));
  }, [employees]);

  const ledgerUniqueSkills = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.skillCategory).filter(Boolean)));
  }, [employees]);

  const ledgerUniqueRoles = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.role).filter(Boolean)));
  }, [employees]);
  const [tempLedgerEntries, setTempLedgerEntries] = useState<Record<string, {
    advance: string;
    penalty: string;
    uniform: string;
    foodPerk: string;
    accommodationPerk: string;
    conveyancePerk: string;
    penaltyReason: string;
  }>>({});

  const [bulkEditDrafts, setBulkEditDrafts] = useState<Record<string, Partial<Employee>>>({});
  const [bulkEditSalaryAnchors, setBulkEditSalaryAnchors] = useState<
    Record<string, SalaryAnchor | null>
  >({});
  const bulkEditSalaryAnchorsRef = useRef<Record<string, SalaryAnchor | null>>({});
  const [employeeChangeRequests, setEmployeeChangeRequests] = useState<EmployeeChangeRequest[]>([]);
  const [pendingChangeCount, setPendingChangeCount] = useState(0);
  const [isFetchingChangeRequests, setIsFetchingChangeRequests] = useState(false);
  const [isSubmittingBulkEdit, setIsSubmittingBulkEdit] = useState(false);
  // Salary Advanced Filtering states
  const [salarySearchQuery, setSalarySearchQuery] = useState("");
  const [salaryLocationFilter, setSalaryLocationFilter] = useState("");
  const [salaryFilterType, setSalaryFilterType] = useState<"all" | "advances" | "penalties" | "perks">("all");
  const [salaryJoinStartFilter, setSalaryJoinStartFilter] = useState<string>("");
  const [salaryJoinEndFilter, setSalaryJoinEndFilter] = useState<string>("");
  const [salaryExitStartFilter, setSalaryExitStartFilter] = useState<string>("");
  const [salaryExitEndFilter, setSalaryExitEndFilter] = useState<string>("");
  const [salaryMinSalaryFilter, setSalaryMinSalaryFilter] = useState<string>("");
  const [salaryMaxSalaryFilter, setSalaryMaxSalaryFilter] = useState<string>("");
  const [salaryGenderFilter, setSalaryGenderFilter] = useState<string>("All");
  const [salaryMaritalFilter, setSalaryMaritalFilter] = useState<string>("All");
  const [salaryEsicFilter, setSalaryEsicFilter] = useState<string>("All");
  const [salarySkillFilters, setSalarySkillFilters] = useState<string[]>([]);
  const [salaryRoleFilters, setSalaryRoleFilters] = useState<string[]>([]);
  const [salaryPaymentStatusFilter, setSalaryPaymentStatusFilter] = useState<"All" | "Unpaid" | "Paid" | "Hold">("All");
  const [isSalarySkillDropdownOpen, setIsSalarySkillDropdownOpen] = useState(false);
  const [isSalaryRoleDropdownOpen, setIsSalaryRoleDropdownOpen] = useState(false);
  const [selectedSalaryEmployeeIds, setSelectedSalaryEmployeeIds] = useState<string[]>([]);

  // Birthdays filtering
  const [birthdaySearchMonth, setBirthdaySearchMonth] = useState(() => getCurrentMonthName());
  const [birthdayTodayList, setBirthdayTodayList] = useState<Employee[]>([]);
  const [birthdayMonthList, setBirthdayMonthList] = useState<Array<Employee & { birthdayDay?: number; age?: number }>>([]);
  const [birthdayTodayLabel, setBirthdayTodayLabel] = useState(() => getTodayBirthdayLabel());
  const [isFetchingBirthdays, setIsFetchingBirthdays] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [simulatedBirthdayEmpIds, setSimulatedBirthdayEmpIds] = useState<string[]>([]);

  const [helplines, setHelplines] = useState<any[]>([]);
  const [isFetchingHelplines, setIsFetchingHelplines] = useState(false);

  const [newHelplineName, setNewHelplineName] = useState("");
  const [newHelplinePhone, setNewHelplinePhone] = useState("");
  const [newHelplineRole, setNewHelplineRole] = useState("");
  const [newHelplineCategory, setNewHelplineCategory] = useState("Corporate Support");
  const [newHelplineLocation, setNewHelplineLocation] = useState("All Locations");
  const [helplineSearchQuery, setHelplineSearchQuery] = useState("");
  const [helplineLocationFilter, setHelplineLocationFilter] = useState("All Locations");

  const fetchHelplines = useCallback(async () => {
    setIsFetchingHelplines(true);
    try {
      const res = await fetch("/api/helplines");
      if (!res.ok) throw await parseApiError(res, "Failed to fetch helplines.");
      const data = await res.json();
      setHelplines(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setErrorMessage(err.message || "Could not load helplines.");
    } finally {
      setIsFetchingHelplines(false);
    }
  }, []);

  const buildBirthdaySummaryLocally = useCallback((monthName: string) => {
    const now = new Date();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();
    const currentYear = now.getFullYear();
    const targetMonthNum = MONTH_NAME_LIST.indexOf(monthName) + 1;

    const today: Employee[] = [];
    const monthList: Array<Employee & { birthdayDay?: number; age?: number }> = [];

    for (const emp of employees) {
      const dob = parseDateOfBirth(emp.dateOfBirth);
      if (!dob) continue;
      const entry = { ...emp, birthdayDay: dob.day, age: currentYear - dob.year };
      if (dob.month === todayMonth && dob.day === todayDay) today.push(entry);
      if (dob.month === targetMonthNum) monthList.push(entry);
    }

    monthList.sort((a, b) => (a.birthdayDay || 0) - (b.birthdayDay || 0));
    setBirthdayTodayList(today);
    setBirthdayMonthList(monthList);
    setBirthdayTodayLabel(getTodayBirthdayLabel());
  }, [employees]);

  const fetchBirthdays = useCallback(async (monthName?: string) => {
    const month = monthName || birthdaySearchMonth;
    const monthNum = MONTH_NAME_LIST.indexOf(month) + 1;
    if (monthNum < 1) return;

    setIsFetchingBirthdays(true);
    try {
      const res = await fetch(`/api/employees/birthdays?month=${monthNum}`);
      if (!res.ok) throw await parseApiError(res, "Failed to fetch birthdays.");
      const data = await res.json();
      setBirthdayTodayList(Array.isArray(data.today) ? data.today : []);
      setBirthdayMonthList(Array.isArray(data.month) ? data.month : []);
      setBirthdayTodayLabel(data.todayLabel || getTodayBirthdayLabel());
    } catch {
      buildBirthdaySummaryLocally(month);
    } finally {
      setIsFetchingBirthdays(false);
    }
  }, [birthdaySearchMonth, buildBirthdaySummaryLocally]);

  const handleAddHelpline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHelplineName.trim() || !newHelplinePhone.trim()) {
      alert("Name and phone are required for a helpline.");
      return;
    }
    const newCard = {
      name: newHelplineName.trim(),
      phone: newHelplinePhone.trim(),
      role: newHelplineRole.trim() || "General query support & helpline coordination",
      category: newHelplineCategory,
      location: newHelplineLocation
    };
    try {
      const res = await fetch("/api/helplines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCard.name,
          phone: newCard.phone,
          location: newCard.location,
          category: newCard.category,
        }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to add helpline.");
      await fetchHelplines();
      triggerSuccess(`Successfully added helpline: "${newCard.name}"`);
      setNewHelplineName("");
      setNewHelplinePhone("");
      setNewHelplineRole("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add helpline.");
    }
  };

  const handleDeleteHelpline = async (nameToDelete: string) => {
    const confirmed = await confirmAction({
      title: "Delete helpline",
      message: `Are you sure you want to delete the helpline "${nameToDelete}"?`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    const target = helplines.find(h => h.name === nameToDelete);
    if (!target?._id) {
      setErrorMessage("Cannot delete helpline because the API id is missing.");
      return;
    }
    try {
      const res = await fetch(`/api/helplines/${encodeURIComponent(target._id)}`, { method: "DELETE" });
      if (!res.ok) throw await parseApiError(res, "Failed to delete helpline.");
      await fetchHelplines();
      triggerSuccess(`Successfully deleted helpline: "${nameToDelete}"`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete helpline.");
    }
  };

  // Attendance database map: month_string -> employee_id -> day_number -> status
  const [attendanceDb, setAttendanceDb] = useState<Record<string, Record<string, Record<number, string>>>>({});
  const [isFetchingAttendance, setIsFetchingAttendance] = useState(false);

  const [attendanceLocationFilter, setAttendanceLocationFilter] = useState("All");
  const [attendanceRoleFilters, setAttendanceRoleFilters] = useState<string[]>([]);
  const [attendanceSkillFilters, setAttendanceSkillFilters] = useState<string[]>([]);
  const [isAttendanceRoleDropdownOpen, setIsAttendanceRoleDropdownOpen] = useState(false);
  const [isAttendanceSkillDropdownOpen, setIsAttendanceSkillDropdownOpen] = useState(false);
  const [bulkWizardRoleFilters, setBulkWizardRoleFilters] = useState<string[]>([]);
  const [bulkWizardSkillFilters, setBulkWizardSkillFilters] = useState<string[]>([]);
  const [isBulkWizardRoleDropdownOpen, setIsBulkWizardRoleDropdownOpen] = useState(false);
  const [isBulkWizardSkillDropdownOpen, setIsBulkWizardSkillDropdownOpen] = useState(false);
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");

  // Bulk marking form states
  const [bulkStartDay, setBulkStartDay] = useState(1);
  const [bulkEndDay, setBulkEndDay] = useState(30);
  const [bulkStatus, setBulkStatus] = useState("P");

  // Bulk marking wizard state
  const [bulkWizardStep, setBulkWizardStep] = useState<"employees" | "dates" | "review">("employees");
  const [isBulkWizardOpen, setIsBulkWizardOpen] = useState(false);
  const [attendanceSubView, setAttendanceSubView] = useState<"grid" | "wizard">("grid");
  const [bulkSelLocations, setBulkSelLocations] = useState<string[]>([]);
  const [bulkSelEmployees, setBulkSelEmployees] = useState<string[]>([]);
  const [bulkSelMonths, setBulkSelMonths] = useState<string[]>([]);
  const [bulkCalendarMonth, setBulkCalendarMonth] = useState<string>("");
  const [bulkSelDates, setBulkSelDates] = useState<number[]>([]);
  const [bulkConfirm1, setBulkConfirm1] = useState(false);
  const [bulkConfirm2, setBulkConfirm2] = useState(false);

  type ConfirmDialogVariant = "danger" | "warning" | "default";
  type ConfirmDialogOptions = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmDialogVariant;
  };
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<(ConfirmDialogOptions & { open: true }) | null>(null);

  const closeConfirmDialog = useCallback((result: boolean) => {
    confirmResolverRef.current?.(result);
    confirmResolverRef.current = null;
    setConfirmDialog(null);
  }, []);

  const confirmAction = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmDialog({ ...options, open: true });
    });
  }, []);

  const handleConfirmDialogConfirm = useCallback(() => {
    closeConfirmDialog(true);
  }, [closeConfirmDialog]);

  const handleConfirmDialogCancel = useCallback(() => {
    closeConfirmDialog(false);
  }, [closeConfirmDialog]);

  const fetchAttendanceForMonth = useCallback(async (monthKey: string) => {
    if (!monthKey) return;
    setIsFetchingAttendance(true);
    try {
      const res = await fetch(`/api/attendance?monthKey=${encodeURIComponent(monthKey)}`);
      if (!res.ok) throw await parseApiError(res, "Failed to fetch attendance.");
      const data = await res.json();
      setAttendanceDb((prev) => ({ ...prev, [monthKey]: data || {} }));
    } catch (err: any) {
      setErrorMessage(err.message || "Could not load attendance records.");
    } finally {
      setIsFetchingAttendance(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      localStorage.setItem("hrms_selected_month", selectedMonth);
      setBulkSelMonths([selectedMonth]);
      setBulkCalendarMonth(selectedMonth);
      if (isLoggedIn) {
        fetchAttendanceForMonth(selectedMonth);
      }
    }
  }, [selectedMonth, isLoggedIn, fetchAttendanceForMonth]);

  useEffect(() => {
    if (!MONTHS_LIST.length) return;
    if (!MONTHS_LIST.includes(selectedMonth)) {
      setSelectedMonth(MONTHS_LIST[0]);
    }
  }, [MONTHS_LIST, selectedMonth]);

  useEffect(() => {
    if (bulkSelMonths.length > 0) {
      if (!bulkCalendarMonth || !bulkSelMonths.includes(bulkCalendarMonth)) {
        setBulkCalendarMonth(bulkSelMonths[0]);
      }
    }
  }, [bulkSelMonths, bulkCalendarMonth]);

  const getDaysInSelectedMonth = (monthStr: string) => {
    const parts = monthStr.split(" ");
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthIndex = monthNames.indexOf(parts[0]);
    const year = parseInt(parts[1]) || 2026;
    if (monthIndex === -1) return 30;
    return new Date(year, monthIndex + 1, 0).getDate();
  };

  // Mark single cell attendance
  const handleCellAttendanceChange = async (empId: string, day: number, status: string) => {
    if (!userPermissions.attendance?.edit) {
      alert("Action locked: You do not have write permissions for Attendance.");
      return;
    }

    const emp = employees.find(e => e.id === empId);
    const empName = emp ? `${emp.employeeCode} (${emp.nameAsPerAadhar})` : empId;

    try {
      const res = await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: empId,
          employeeCode: emp?.employeeCode,
          location: emp?.location,
          monthKey: selectedMonth,
          day,
          status,
        }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to save attendance.");
      setAttendanceDb(prev => {
        const monthData = prev[selectedMonth] || {};
        const empData = monthData[empId] || {};
        return {
          ...prev,
          [selectedMonth]: {
            ...monthData,
            [empId]: {
              ...empData,
              [day]: status
            }
          }
        };
      });
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to mark attendance for ${empName}.`);
    }
  };

  // Bulk marker trigger
  const handleApplyBulkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPermissions.attendance?.edit) {
      alert("Action locked: You do not have write permissions for Attendance.");
      return;
    }
    const daysInMonth = getDaysInSelectedMonth(selectedMonth);
    const start = Math.max(1, Math.min(daysInMonth, bulkStartDay));
    const end = Math.max(start, Math.min(daysInMonth, bulkEndDay));

    const filtered = employees.filter(emp => {
      const locMatch = attendanceLocationFilter === "All" || emp.location === attendanceLocationFilter;
      const q = attendanceSearchQuery.toLowerCase().trim();
      const searchMatch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadhar || "").toLowerCase().includes(q);
      return locMatch && searchMatch;
    });

    if (filtered.length === 0) {
      alert("No employees match the current filters for bulk attendance marking.");
      return;
    }

    const namesList = filtered.map(emp => `${emp.employeeCode} (${emp.nameAsPerAadhar})`).join(', ');
    const datesList = Array.from({ length: end - start + 1 }, (_, i) => start + i).join(', ');

    const entries = filtered.flatMap((emp) =>
      Array.from({ length: end - start + 1 }, (_, i) => ({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        location: emp.location,
        monthKey: selectedMonth,
        day: start + i,
        status: bulkStatus,
      }))
    );

    try {
      const res = await fetch("/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to save bulk attendance.");

      setAttendanceDb(prev => {
        const updatedMonth = { ...(prev[selectedMonth] || {}) };
        filtered.forEach(emp => {
          const empData = { ...(updatedMonth[emp.id] || {}) };
          for (let d = start; d <= end; d++) {
            empData[d] = bulkStatus;
          }
          updatedMonth[emp.id] = empData;
        });

        return {
          ...prev,
          [selectedMonth]: updatedMonth
        };
      });

      triggerSuccess(`Bulk marked ${filtered.length} employees as "${bulkStatus}" from Day ${start} to ${end} for ${selectedMonth}.`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to apply bulk attendance.");
    }
  };

  const handleApplyBulkWizardAttendance = async () => {
    if (!userPermissions.attendance?.edit) {
      alert("Action locked: You do not have write permissions for Attendance.");
      return;
    }
    if (bulkSelEmployees.length === 0) {
      alert("Please select at least one employee.");
      return;
    }
    if (bulkSelMonths.length === 0) {
      alert("Please select at least one month.");
      return;
    }
    if (bulkSelDates.length === 0) {
      alert("Please select at least one date.");
      return;
    }

    const sortedDates = [...bulkSelDates].sort((a, b) => a - b);
    const entries = bulkSelMonths.flatMap((monthKey) =>
      bulkSelEmployees.flatMap((empId) => {
        const emp = employees.find(e => e.id === empId);
        const daysInMonth = getDaysInMonthStatic(monthKey);
        return Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          return {
            employeeId: empId,
            employeeCode: emp?.employeeCode,
            location: emp?.location,
            monthKey,
            day,
            status: sortedDates.includes(day) ? "P" : "A",
          };
        });
      })
    );

    try {
      const res = await fetch("/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to save wizard attendance.");

      setAttendanceDb(prev => {
        const nextDb = { ...prev };
      
        bulkSelMonths.forEach(m => {
          const monthData = { ...(nextDb[m] || {}) };
          const daysInMonth = getDaysInMonthStatic(m);

          bulkSelEmployees.forEach(empId => {
            const empData = { ...(monthData[empId] || {}) };
            for (let d = 1; d <= daysInMonth; d++) {
              if (sortedDates.includes(d)) {
                empData[d] = "P"; // Selected date -> Present
              } else {
                empData[d] = "A"; // Unselected date -> Absent
              }
            }
            monthData[empId] = empData;
          });
          nextDb[m] = monthData;
        });
      
        return nextDb;
      });

      triggerSuccess(`Successfully bulk marked ${bulkSelEmployees.length} employees as Present on selected dates for ${bulkSelMonths.join(", ")}!`);
    
      // Reset wizard
      setBulkWizardStep("employees");
      setBulkSelEmployees([]);
      setBulkSelDates([]);
      setBulkConfirm1(false);
      setBulkConfirm2(false);
      setIsBulkWizardOpen(false);
      setAttendanceSubView("grid"); // Go back to daily grid sheet screen!
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to apply wizard attendance.");
    }
  };

  // Landscape branded CSV/Excel download
  const downloadAttendanceExcel = () => {
    const daysInMonth = getDaysInSelectedMonth(selectedMonth);
    const filtered = employees.filter(emp => {
      const locMatch = attendanceLocationFilter === "All" || emp.location === attendanceLocationFilter;
      const roleMatch = attendanceRoleFilters.length === 0 || attendanceRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase());
      const skillMatch = employeeMatchesSkillFilters(emp, attendanceSkillFilters);
      const q = attendanceSearchQuery.toLowerCase().trim();
      const searchMatch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadhar || "").toLowerCase().includes(q);
      return locMatch && searchMatch && roleMatch && skillMatch;
    });

    const daysHeaders = Array.from({ length: daysInMonth }, (_, i) => `Day ${i + 1}`);
    const headers = ["SR NO", "Employee Code", "Employee Name", "Worksite Location", ...daysHeaders, "Presents", "Absents"];

    const rows = filtered.map((emp, index) => {
      const monthData = attendanceDb[selectedMonth] || {};
      const empData = monthData[emp.id] || {};
      
      let presents = 0;
      let absents = 0;
      const daysCells = Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const isExited = isEmployeeExitedOnDayStatic(emp, selectedMonth, dayNum);
        if (isExited) return "—";
        const status = empData[dayNum] || "";
        if (status === "P") presents++;
        else if (status === "A") absents++;
        return status || "—";
      });

      return [
        index + 1,
        emp.employeeCode,
        emp.nameAsPerAadhar,
        emp.location || "Unassigned",
        ...daysCells,
        presents,
        absents
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + `HRMS ENTERPRISE ATTENDANCE SHEET - ${selectedMonth}\n`
      + `Report Location: ${attendanceLocationFilter === "All" ? "All Locations" : attendanceLocationFilter}\n`
      + `Generated on: ${new Date().toLocaleString()}\n\n`
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Sheet_${selectedMonth.replace(" ", "_")}_${attendanceLocationFilter.replace(" ", "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerSuccess("Successfully generated and downloaded Landscape attendance sheet.");

    fetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "DOWNLOAD_ATTENDANCE_CSV",
        target: `Attendance CSV Sheet: Downloaded attendance register sheet for ${selectedMonth} (Location: ${attendanceLocationFilter === "All" ? "All Locations" : attendanceLocationFilter}) containing attendance tracking records for ${filtered.length} employees.`,
        details: { month: selectedMonth, location: attendanceLocationFilter, recordCount: filtered.length, format: "CSV" }
      })
    }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
  };

  // Landscape branded PDF download
  const downloadAttendancePDF = () => {
    try {
      const daysInMonth = getDaysInSelectedMonth(selectedMonth);
      const filtered = employees.filter(emp => {
        const locMatch = attendanceLocationFilter === "All" || emp.location === attendanceLocationFilter;
        const roleMatch = attendanceRoleFilters.length === 0 || attendanceRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase());
        const skillMatch = employeeMatchesSkillFilters(emp, attendanceSkillFilters);
        const q = attendanceSearchQuery.toLowerCase().trim();
        const searchMatch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadhar || "").toLowerCase().includes(q);
        return locMatch && searchMatch && roleMatch && skillMatch;
      });

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      doc.setFontSize(14);
      doc.setTextColor(245, 116, 22);
      doc.text(`FLEXHRM ENTERPRISE ATTENDANCE REGISTRY - ${selectedMonth.toUpperCase()}`, 14, 12);

      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Worksite Location Designation: ${attendanceLocationFilter === "All" ? "All Corporate Branches" : attendanceLocationFilter}`, 14, 17);
      doc.text(`Total Staff Enrolled: ${filtered.length} | Generated: ${new Date().toLocaleString()}`, 14, 22);

      const daysHeaders = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
      const headers = ["SR", "Emp Code", "Name", "Location", ...daysHeaders, "P", "A"];

      const rows = filtered.map((emp, index) => {
        const monthData = attendanceDb[selectedMonth] || {};
        const empData = monthData[emp.id] || {};
        
        let presents = 0;
        let absents = 0;
        const daysCells = Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const isExited = isEmployeeExitedOnDayStatic(emp, selectedMonth, dayNum);
          if (isExited) return "—";
          const status = empData[dayNum] || "";
          if (status === "P") presents++;
          else if (status === "A") absents++;
          return status || "—";
        });

        return [
          index + 1,
          emp.employeeCode,
          emp.nameAsPerAadhar.substring(0, 16),
          (emp.location || "Unassigned").substring(0, 12),
          ...daysCells,
          presents,
          absents
        ];
      });

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 26,
        theme: "grid",
        styles: {
          fontSize: daysInMonth > 28 ? 5.5 : 6.5,
          cellPadding: 0.8,
          valign: "middle",
          halign: "center",
          font: "courier"
        },
        headStyles: {
          fillColor: [245, 116, 22],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 15, halign: "left" },
          2: { cellWidth: 30, halign: "left" },
          3: { cellWidth: 20, halign: "left" }
        }
      });

      doc.save(`Attendance_Sheet_${selectedMonth.replace(" ", "_")}_${attendanceLocationFilter.replace(" ", "_")}.pdf`);
      triggerSuccess("Landscape Attendance PDF generated and saved successfully!");

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DOWNLOAD_ATTENDANCE_PDF",
          target: `Attendance PDF Report: Downloaded attendance register PDF (landscape format) for ${selectedMonth} (Location: ${attendanceLocationFilter === "All" ? "All Locations" : attendanceLocationFilter}) containing records for ${filtered.length} employees.`,
          details: { month: selectedMonth, location: attendanceLocationFilter, recordCount: filtered.length, format: "PDF" }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
    } catch (err: any) {
      setErrorMessage("Attendance PDF creation failed: " + err.message);
    }
  };

  // Directory Sub-navigation & dialing overlays
  const [activeDirectorySubTab, setActiveDirectorySubTab] = useState<"employees" | "contacts">("employees");
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryLocation, setDirectoryLocation] = useState("");
  const [directoryGender, setDirectoryGender] = useState("");
  const [activeDialerContact, setActiveDialerContact] = useState<{ name: string; phone: string; role?: string } | null>(null);
  const [activeDialerStatus, setActiveDialerStatus] = useState<"ringing" | "connected" | "ended">("ringing");

  // Custom Salary Column selector states
  const SALARY_HEADERS = [
    "Employee Code",
    "Employee Name",
    "Skill Category",
    "Job Role",
    "Present Days",
    "Total Salary",
    "Gross Salary (Monthly)",
    "Basic Salary",
    "Employer PF (13%)",
    "Employer ESIC (3.25%)",
    "Employee PF (12%)",
    "Employee ESIC (0.75%)",
    "Professional Tax (PT)",
    "Advance Balance",
    "Uniform Deductions",
    "Penalty Balance",
    "Net Salary",
    "Total Deductions",
    "Food Perk",
    "Accommodation Perk",
    "Conveyance Perk",
    "Net Payable",
    "Payment Status"
  ];
  const [selectedSalaryColumns, setSelectedSalaryColumns] = useState<string[]>([...SALARY_HEADERS]);

  const [savedReportTemplates, setSavedReportTemplates] = useState<any[]>([]);
  const [savedSalaryTemplates, setSavedSalaryTemplates] = useState<any[]>([]);
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);
  const [newReportTemplateName, setNewReportTemplateName] = useState("");
  const [newSalaryTemplateName, setNewSalaryTemplateName] = useState("");
  const [activeReportTemplateName, setActiveReportTemplateName] = useState("");
  const [activeSalaryTemplateName, setActiveSalaryTemplateName] = useState("");

  const normalizeTemplates = (templates: any[]) =>
    templates.map((template) => ({
      ...template,
      filters: template.filters || {},
    }));

  const fetchExportTemplates = useCallback(async () => {
    setIsFetchingTemplates(true);
    try {
      const [reportRes, salaryRes] = await Promise.all([
        fetch("/api/export-templates?type=report"),
        fetch("/api/export-templates?type=salary"),
      ]);
      if (!reportRes.ok) throw await parseApiError(reportRes, "Failed to fetch report templates.");
      if (!salaryRes.ok) throw await parseApiError(salaryRes, "Failed to fetch salary templates.");
      setSavedReportTemplates(normalizeTemplates(await reportRes.json()));
      setSavedSalaryTemplates(normalizeTemplates(await salaryRes.json()));
    } catch (err: any) {
      setErrorMessage(err.message || "Could not load export templates.");
    } finally {
      setIsFetchingTemplates(false);
    }
  }, []);

  const handleSaveReportTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReportTemplateName.trim()) return;
    const name = newReportTemplateName.trim();
    if (savedReportTemplates.some((t: any) => t.name.toLowerCase() === name.toLowerCase())) {
      setErrorMessage("A report template with this name already exists.");
      return;
    }
    const newTemplate = {
      name,
      columns: [...selectedReportColumns],
      filters: {
        locations: reportLocFilters,
        gender: reportGenderFilter,
        marital: reportMaritalFilter,
        esic: reportEsicFilter,
        minSalary: reportMinSalaryFilter,
        maxSalary: reportMaxSalaryFilter,
        joinStart: reportJoinStartFilter,
        joinEnd: reportJoinEndFilter,
        exitStart: reportExitStartFilter,
        exitEnd: reportExitEndFilter,
        skills: reportSkillFilters,
        roles: reportRoleFilters,
        employment: reportEmploymentFilter,
      }
    };
    try {
      const res = await fetch("/api/export-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "report", name, columns: newTemplate.columns, filters: newTemplate.filters }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to save report template.");
      await fetchExportTemplates();
      setActiveReportTemplateName(name);
      setNewReportTemplateName("");
      triggerSuccess(`Successfully saved report template: "${name}"`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save report template.");
    }
  };

  const handleLoadReportTemplate = (name: string) => {
    if (!name) {
      setActiveReportTemplateName("");
      return;
    }
    const template = savedReportTemplates.find((t: any) => t.name === name);
    if (template) {
      setSelectedReportColumns(template.columns);
      if (template.filters.locations !== undefined) {
        setReportLocFilters(Array.isArray(template.filters.locations) ? template.filters.locations : []);
      } else if (template.filters.location !== undefined) {
        const loc = template.filters.location;
        if (Array.isArray(loc)) setReportLocFilters(loc);
        else if (!loc || loc === "All") setReportLocFilters([]);
        else setReportLocFilters([loc]);
      }
      if (template.filters.gender !== undefined) setReportGenderFilter(template.filters.gender);
      if (template.filters.marital !== undefined) setReportMaritalFilter(template.filters.marital);
      if (template.filters.esic !== undefined) setReportEsicFilter(template.filters.esic);
      if (template.filters.minSalary !== undefined) setReportMinSalaryFilter(template.filters.minSalary);
      if (template.filters.maxSalary !== undefined) setReportMaxSalaryFilter(template.filters.maxSalary);
      if (template.filters.joinStart !== undefined) setReportJoinStartFilter(template.filters.joinStart);
      if (template.filters.joinEnd !== undefined) setReportJoinEndFilter(template.filters.joinEnd);
      if (template.filters.exitStart !== undefined) setReportExitStartFilter(template.filters.exitStart);
      if (template.filters.exitEnd !== undefined) setReportExitEndFilter(template.filters.exitEnd);
      if (template.filters.skills !== undefined) setReportSkillFilters(template.filters.skills);
      if (template.filters.roles !== undefined) setReportRoleFilters(template.filters.roles);
      if (template.filters.employment !== undefined) {
        const employment = template.filters.employment;
        if (employment === "active" || employment === "exited" || employment === "all") {
          setReportEmploymentFilter(employment);
        }
      }
      
      setActiveReportTemplateName(name);
      triggerSuccess(`Loaded report template layout: "${name}"`);
    }
  };

  const handleDeleteReportTemplate = async (name: string) => {
    const confirmed = await confirmAction({
      title: "Delete report template",
      message: `Delete the report template "${name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/export-templates?type=report&name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw await parseApiError(res, "Failed to delete report template.");
      await fetchExportTemplates();
      if (activeReportTemplateName === name) {
        setActiveReportTemplateName("");
      }
      triggerSuccess(`Deleted template layout: "${name}"`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete report template.");
    }
  };

  const handleSaveSalaryTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSalaryTemplateName.trim()) return;
    const name = newSalaryTemplateName.trim();
    if (savedSalaryTemplates.some((t: any) => t.name.toLowerCase() === name.toLowerCase())) {
      setErrorMessage("A salary template with this name already exists.");
      return;
    }
    const newTemplate = {
      name,
      columns: [...selectedSalaryColumns],
      filters: {
        location: salaryLocationFilter,
        month: selectedMonth,
        searchQuery: salarySearchQuery,
        filterType: salaryFilterType,
        joinStart: salaryJoinStartFilter,
        joinEnd: salaryJoinEndFilter,
        exitStart: salaryExitStartFilter,
        exitEnd: salaryExitEndFilter,
        minSalary: salaryMinSalaryFilter,
        maxSalary: salaryMaxSalaryFilter,
        gender: salaryGenderFilter,
        marital: salaryMaritalFilter,
        esic: salaryEsicFilter,
        skills: salarySkillFilters,
        roles: salaryRoleFilters,
        paymentStatus: salaryPaymentStatusFilter
      }
    };
    try {
      const res = await fetch("/api/export-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "salary", name, columns: newTemplate.columns, filters: newTemplate.filters }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to save salary template.");
      await fetchExportTemplates();
      setActiveSalaryTemplateName(name);
      setNewSalaryTemplateName("");
      triggerSuccess(`Successfully saved salary template layout: "${name}"`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save salary template.");
    }
  };

  const handleLoadSalaryTemplate = (name: string) => {
    if (!name) {
      setActiveSalaryTemplateName("");
      return;
    }
    const template = savedSalaryTemplates.find((t: any) => t.name === name);
    if (template) {
      setSelectedSalaryColumns(
        Array.isArray(template.columns) && template.columns.length > 0
          ? template.columns
          : [...SALARY_HEADERS]
      );
      if (template.filters.location !== undefined) setSalaryLocationFilter(template.filters.location);
      if (template.filters.month !== undefined) setSelectedMonth(template.filters.month);
      if (template.filters.searchQuery !== undefined) setSalarySearchQuery(template.filters.searchQuery);
      if (template.filters.filterType !== undefined) setSalaryFilterType(template.filters.filterType);
      if (template.filters.joinStart !== undefined) setSalaryJoinStartFilter(template.filters.joinStart);
      if (template.filters.joinEnd !== undefined) setSalaryJoinEndFilter(template.filters.joinEnd);
      if (template.filters.exitStart !== undefined) setSalaryExitStartFilter(template.filters.exitStart);
      if (template.filters.exitEnd !== undefined) setSalaryExitEndFilter(template.filters.exitEnd);
      if (template.filters.minSalary !== undefined) setSalaryMinSalaryFilter(template.filters.minSalary);
      if (template.filters.maxSalary !== undefined) setSalaryMaxSalaryFilter(template.filters.maxSalary);
      if (template.filters.gender !== undefined) setSalaryGenderFilter(template.filters.gender);
      if (template.filters.marital !== undefined) setSalaryMaritalFilter(template.filters.marital);
      if (template.filters.esic !== undefined) setSalaryEsicFilter(template.filters.esic);
      
      if (template.filters.skills !== undefined) {
        setSalarySkillFilters(template.filters.skills);
      } else if (template.filters.skill !== undefined) {
        setSalarySkillFilters(template.filters.skill === "All" ? [] : [template.filters.skill]);
      }
      
      if (template.filters.roles !== undefined) {
        setSalaryRoleFilters(template.filters.roles);
      } else if (template.filters.role !== undefined) {
        setSalaryRoleFilters(template.filters.role === "All" ? [] : [template.filters.role]);
      }

      if (template.filters.paymentStatus !== undefined) {
        setSalaryPaymentStatusFilter(template.filters.paymentStatus);
      } else {
        setSalaryPaymentStatusFilter("All");
      }
      
      setActiveSalaryTemplateName(name);
      triggerSuccess(`Loaded salary template layout: "${name}"`);
    }
  };

  const handleDeleteSalaryTemplate = async (name: string) => {
    const confirmed = await confirmAction({
      title: "Delete salary template",
      message: `Delete the salary template "${name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/export-templates?type=salary&name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw await parseApiError(res, "Failed to delete salary template.");
      await fetchExportTemplates();
      if (activeSalaryTemplateName === name) {
        setActiveSalaryTemplateName("");
      }
      triggerSuccess(`Deleted template layout: "${name}"`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete salary template.");
    }
  };

  // Handler to delete locations (single or bulk)
  const handleDeleteLocations = async (locsToDelete: string[]) => {
    if (!locsToDelete || locsToDelete.length === 0) return;
    
    const confirmMsg = locsToDelete.length === 1 
      ? `Are you sure you want to delete "${locsToDelete[0]}"? Active employees with this location will have their location unassigned.`
      : `Are you sure you want to delete ${locsToDelete.length} selected locations? Active employees with these locations will have their location unassigned.`;
      
    const confirmed = await confirmAction({
      title: locsToDelete.length === 1 ? "Delete location" : "Delete locations",
      message: confirmMsg,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      setErrorMessage(null);
      const res = await fetch("/api/employees/delete-locations", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ locations: locsToDelete })
      });

      if (!res.ok) {
        throw new Error("Bulk location deletion request rejected by server.");
      }

      const report = await res.json();
      
      await fetch("/api/locations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: locsToDelete }),
      });

      // Update compliance mapping
      const updatedCompliance = { ...locationCompliance };
      const updatedPt = { ...locationPtAmounts };
      locsToDelete.forEach(l => {
        delete updatedCompliance[l];
        delete updatedPt[l];
        Object.keys(updatedPt).forEach((key) => {
          if (key.toLowerCase() === l.toLowerCase()) delete updatedPt[key];
        });
      });
      setLocationCompliance(updatedCompliance);
      persistLocationPtAmounts(updatedPt);

      // Clear selection
      setSelectedLocs(prev => prev.filter(l => !locsToDelete.some(dl => dl.toLowerCase() === l.toLowerCase())));

      // Refresh employees from the server
      await fetchEmployees();
      await fetchLocations();
      triggerSuccess(`Successfully deleted ${locsToDelete.length} location(s). Cleared ${report.count} employee record(s).`);
    } catch (err: any) {
      setErrorMessage("Failed to delete locations: " + err.message);
    }
  };

  // Inline role editing support
  const [editingRoleIndex, setEditingRoleIndex] = useState<number | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState<string>("");
  const [newRoleNameInput, setNewRoleNameInput] = useState<string>("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Handler to add a new custom role from the configuration tab
  const handleAddRoleFromConfig = async (roleName: string) => {
    const cleanName = roleName.trim();
    if (!cleanName) return;
    
    if (customRoles.some(r => r.toLowerCase() === cleanName.toLowerCase())) {
      setErrorMessage(`Role "${cleanName}" already exists.`);
      return;
    }

    try {
      const res = await fetch("/api/job-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to register job role.");
      await fetchJobRoles();
      setNewRoleNameInput("");
      triggerSuccess(`Successfully registered new role: "${cleanName}"`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to register job role.");
    }
  };

  // Handler to edit/rename a custom role in bulk
  const handleEditRoleFromConfig = async (oldName: string, newName: string) => {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanOld || !cleanNew) return;
    if (cleanOld.toLowerCase() === cleanNew.toLowerCase()) return;

    try {
      setErrorMessage(null);
      const res = await fetch("/api/employees/rename-role", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ oldRole: cleanOld, newRole: cleanNew })
      });

      if (!res.ok) {
        throw new Error("Bulk role rename request rejected by server.");
      }

      const report = await res.json();
      
      await fetch("/api/job-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanNew }),
      });
      await fetch("/api/job-roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: [cleanOld] }),
      });

      await fetchEmployees();
      await fetchJobRoles();
      triggerSuccess(`Role renamed from "${cleanOld}" to "${cleanNew}" successfully! Updated ${report.count} employee record(s).`);
    } catch (err: any) {
      setErrorMessage("Failed to rename role: " + err.message);
    }
  };

  // Handler to delete roles (single or bulk)
  const handleDeleteRoles = async (rolesToDelete: string[]) => {
    if (!rolesToDelete || rolesToDelete.length === 0) return;
    
    const confirmMsg = rolesToDelete.length === 1 
      ? `Are you sure you want to delete the role "${rolesToDelete[0]}"? Active employees with this role will have their role unassigned.`
      : `Are you sure you want to delete ${rolesToDelete.length} selected roles? Active employees with these roles will have their role unassigned.`;
      
    const confirmed = await confirmAction({
      title: rolesToDelete.length === 1 ? "Delete role" : "Delete roles",
      message: confirmMsg,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      setErrorMessage(null);
      const res = await fetch("/api/employees/delete-roles", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ roles: rolesToDelete })
      });

      if (!res.ok) {
        throw new Error("Bulk role deletion request rejected by server.");
      }

      const report = await res.json();
      
      await fetch("/api/job-roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: rolesToDelete }),
      });

      setSelectedRoles(prev => prev.filter(r => !rolesToDelete.some(dr => dr.toLowerCase() === r.toLowerCase())));

      await fetchEmployees();
      await fetchJobRoles();
      triggerSuccess(`Successfully deleted ${rolesToDelete.length} role(s). Cleared ${report.count} employee record(s).`);
    } catch (err: any) {
      setErrorMessage("Failed to delete roles: " + err.message);
    }
  };

  // Effect to automatically synchronize local text boxes with the database whenever selected month or employees list changes
  useEffect(() => {
    setTempLedgerEntries(prev => {
      const updated = { ...prev };
      ledgerSelectedEmployeeIds.forEach(empId => {
        const emp = employees.find(e => e.id === empId);
        if (emp) {
          const monthLedger = emp.monthlyLedger?.[selectedMonth];
          updated[empId] = {
            advance: monthLedger ? String(monthLedger.advance) : String(emp.advance || 0),
            penalty: monthLedger ? String(monthLedger.penalty) : String(emp.penalty || 0),
            uniform: monthLedger ? String(monthLedger.uniform || 0) : String(emp.uniform || 0),
            foodPerk: monthLedger ? String(monthLedger.foodPerk) : String(emp.foodPerk || 0),
            accommodationPerk: monthLedger ? String(monthLedger.accommodationPerk) : String(emp.accommodationPerk || 0),
            conveyancePerk: monthLedger ? String(monthLedger.conveyancePerk) : String(emp.conveyancePerk || 0),
            penaltyReason: monthLedger ? monthLedger.penaltyReason : ""
          };
        }
      });
      return updated;
    });
  }, [ledgerSelectedEmployeeIds, selectedMonth, employees]);

  // Handler to save batch monthly entries in Advance & Penalty tab
  const handleSaveBatchLedgerRecords = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPermissions.ledger?.edit) {
      alert("Action locked: You do not have write permissions for Ledgers.");
      return;
    }
    if (ledgerSelectedEmployeeIds.length === 0) {
      setErrorMessage("Please select at least one employee to record entries.");
      return;
    }

    try {
      setErrorMessage(null);
      let successCount = 0;

      for (const empId of ledgerSelectedEmployeeIds) {
        const emp = employees.find(e => e.id === empId);
        if (!emp) continue;

        const entries = tempLedgerEntries[empId] || {
          advance: "0",
          penalty: "0",
          uniform: "0",
          foodPerk: "0",
          accommodationPerk: "0",
          conveyancePerk: "0",
          penaltyReason: ""
        };

        const updatedEmp = {
          ...emp,
          monthlyLedger: {
            ...(emp.monthlyLedger || {}),
            [selectedMonth]: {
              advance: parseFloat(entries.advance) || 0,
              penalty: parseFloat(entries.penalty) || 0,
              uniform: parseFloat(entries.uniform) || 0,
              foodPerk: parseFloat(entries.foodPerk) || 0,
              accommodationPerk: parseFloat(entries.accommodationPerk) || 0,
              conveyancePerk: parseFloat(entries.conveyancePerk) || 0,
              penaltyReason: entries.penaltyReason || ""
            }
          }
        };

        const res = await fetch(`/api/employees/${empId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedEmp)
        });

        if (res.ok) {
          successCount++;
        }
      }

      await fetchEmployees();
      triggerSuccess(`Successfully recorded and synced monthly entries for ${successCount} employee(s) for ${selectedMonth}.`);
    } catch (err: any) {
      setErrorMessage("Failed to save batch entries: " + err.message);
    }
  };

  // Handler to record single employee advance/penalty/perks (Legacy / Fallback support)
  const handleSaveLedgerRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmpId = ledgerEmployeeId;
    const amountNum = parseFloat(ledgerAmount);
    
    if (!cleanEmpId) {
      setErrorMessage("Please select an employee to record transaction.");
      return;
    }
    if (isNaN(amountNum) || amountNum < 0) {
      setErrorMessage("Please enter a valid, positive amount.");
      return;
    }

    const emp = employees.find(e => e.id === cleanEmpId);
    if (!emp) {
      setErrorMessage("Selected employee was not found in database.");
      return;
    }

    const updatedEmp = {
      ...emp,
      monthlyLedger: {
        ...(emp.monthlyLedger || {}),
        [selectedMonth]: {
          ...(emp.monthlyLedger?.[selectedMonth] || {
            advance: Number(emp.advance || 0),
            penalty: Number(emp.penalty || 0),
            foodPerk: Number(emp.foodPerk || 0),
            accommodationPerk: Number(emp.accommodationPerk || 0),
            conveyancePerk: Number(emp.conveyancePerk || 0),
            penaltyReason: ""
          }),
          [ledgerType]: (Number(emp.monthlyLedger?.[selectedMonth]?.[ledgerType] || emp[ledgerType] || 0) + amountNum)
        }
      }
    };

    try {
      setErrorMessage(null);
      const res = await fetch(`/api/employees/${cleanEmpId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedEmp)
      });

      if (!res.ok) {
        throw new Error("Server rejected the update.");
      }

      await fetchEmployees();
      setLedgerAmount("");
      const typeLabel = ledgerType === "foodPerk" ? "Food Perk" 
                      : ledgerType === "accommodationPerk" ? "Accommodation Perk" 
                      : ledgerType === "conveyancePerk" ? "Conveyance Perk" 
                      : ledgerType;
      triggerSuccess(`Successfully recorded ₹${amountNum.toLocaleString("en-IN")} ${typeLabel} for ${emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || emp.employeeCode}.`);
    } catch (err: any) {
      setErrorMessage("Failed to record transaction: " + err.message);
    }
  };

  // Handler to clear advance/penalty/perks completely (Modified to support monthly ledgers)
  const handleClearLedgerValue = async (empId: string, type: "advance" | "penalty" | "uniform" | "foodPerk" | "accommodationPerk" | "conveyancePerk") => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const updatedEmp = {
      ...emp,
      monthlyLedger: {
        ...(emp.monthlyLedger || {}),
        [selectedMonth]: {
          ...(emp.monthlyLedger?.[selectedMonth] || {
            advance: Number(emp.advance || 0),
            penalty: Number(emp.penalty || 0),
            uniform: Number(emp.uniform || 0),
            foodPerk: Number(emp.foodPerk || 0),
            accommodationPerk: Number(emp.accommodationPerk || 0),
            conveyancePerk: Number(emp.conveyancePerk || 0),
            penaltyReason: ""
          }),
          [type]: 0
        }
      }
    };

    try {
      setErrorMessage(null);
      const res = await fetch(`/api/employees/${empId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedEmp)
      });

      if (!res.ok) {
        throw new Error("Server rejected the update.");
      }

      await fetchEmployees();
      const typeLabel = type === "foodPerk" ? "Food Perk" 
                      : type === "accommodationPerk" ? "Accommodation Perk" 
                      : type === "conveyancePerk" ? "Conveyance Perk" 
                      : type === "advance" ? "Advance" 
                      : type === "uniform" ? "Uniform" : "Penalty";
      triggerSuccess(`Cleared outstanding ${typeLabel} for ${emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || emp.employeeCode} for ${selectedMonth}.`);
    } catch (err: any) {
      setErrorMessage("Failed to clear balance: " + err.message);
    }
  };

  const renderClearButtonOrConfirm = (empId: string, type: "advance" | "penalty" | "foodPerk" | "accommodationPerk" | "conveyancePerk" | "uniform", currentVal: number, colorClass: string) => {
    const typeLabel =
      type === "advance" ? "Advance"
      : type === "foodPerk" ? "Food Perk"
      : type === "accommodationPerk" ? "Accommodation Perk"
      : type === "conveyancePerk" ? "Conveyance Perk"
      : type === "uniform" ? "Uniform"
      : "Penalty";
    const emp = employees.find((e) => e.id === empId);
    const empName = emp?.nameAsPerAadharColumn || emp?.nameAsPerAadhar || emp?.employeeCode || empId;

    return (
      <div className="flex flex-col items-start">
        <span className={`font-semibold ${colorClass}`}>₹{currentVal.toLocaleString("en-IN")}</span>
        <button
          type="button"
          onClick={async () => {
            const confirmed = await confirmAction({
              title: `Clear ${typeLabel}`,
              message: `Clear outstanding ${typeLabel} of ₹${currentVal.toLocaleString("en-IN")} for ${empName} in ${selectedMonth}?`,
              confirmLabel: "Clear",
              variant: "danger",
            });
            if (confirmed) {
              await handleClearLedgerValue(empId, type);
            }
          }}
          className="text-[9px] text-slate-400 hover:text-red-500 cursor-pointer uppercase tracking-wider font-extrabold"
        >
          [Clear]
        </button>
      </div>
    );
  };

  // Handler to update extra perks directly (Modified to support monthly ledgers)
  const handleUpdatePerkValue = async (empId: string, perkName: "foodPerk" | "accommodationPerk" | "conveyancePerk", valueStr: string) => {
    if (!userPermissions.salary?.edit) {
      alert("Action locked: You do not have write permissions for Salary.");
      return;
    }
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const numericVal = parseFloat(valueStr) || 0;
    const currentVal = emp.monthlyLedger?.[selectedMonth]?.[perkName] ?? emp[perkName] ?? 0;
    if (Number(currentVal) === numericVal) return; // No change

    const updatedEmp = {
      ...emp,
      monthlyLedger: {
        ...(emp.monthlyLedger || {}),
        [selectedMonth]: {
          ...(emp.monthlyLedger?.[selectedMonth] || {
            advance: Number(emp.advance || 0),
            penalty: Number(emp.penalty || 0),
            foodPerk: Number(emp.foodPerk || 0),
            accommodationPerk: Number(emp.accommodationPerk || 0),
            conveyancePerk: Number(emp.conveyancePerk || 0),
            penaltyReason: ""
          }),
          [perkName]: numericVal
        }
      }
    };

    try {
      setErrorMessage(null);
      const res = await fetch(`/api/employees/${empId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedEmp)
      });

      if (!res.ok) {
        throw new Error("Server rejected the update.");
      }

      await fetchEmployees();
    } catch (err: any) {
      setErrorMessage("Failed to update perk value: " + err.message);
    }
  };

  // Handler to update payment status (unpaid/paid/hold) inside monthly ledger
  const handleUpdatePaymentStatus = async (empId: string, status: "Unpaid" | "Paid" | "Hold") => {
    if (!userPermissions.salary?.edit) {
      alert("Action locked: You do not have write permissions for Salary.");
      return;
    }
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const currentStatus = emp.monthlyLedger?.[selectedMonth]?.paymentStatus || "Unpaid";
    if (currentStatus === status) return; // No change

    const updatedEmp = {
      ...emp,
      monthlyLedger: {
        ...(emp.monthlyLedger || {}),
        [selectedMonth]: {
          ...(emp.monthlyLedger?.[selectedMonth] || {
            advance: Number(emp.advance || 0),
            penalty: Number(emp.penalty || 0),
            foodPerk: Number(emp.foodPerk || 0),
            accommodationPerk: Number(emp.accommodationPerk || 0),
            conveyancePerk: Number(emp.conveyancePerk || 0),
            penaltyReason: ""
          }),
          paymentStatus: status
        }
      }
    };

    try {
      setErrorMessage(null);
      const res = await fetch(`/api/employees/${empId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedEmp)
      });

      if (!res.ok) {
        throw new Error("Server rejected the update.");
      }

      await fetchEmployees();
      triggerSuccess(`Salary payment status for ${emp.nameAsPerAadhar} updated to "${status}" for ${selectedMonth}.`);
    } catch (err: any) {
      setErrorMessage("Failed to update payment status: " + err.message);
    }
  };

  // Handler to bulk update payment status for checked employees
  const handleBulkUpdatePaymentStatus = async (status: "Unpaid" | "Paid" | "Hold") => {
    if (!userPermissions.salary?.edit) {
      alert("Action locked: You do not have write permissions for Salary.");
      return;
    }
    if (selectedSalaryEmployeeIds.length === 0) return;
    const confirmed = await confirmAction({
      title: "Update payment status",
      message: `Mark salary status as "${status}" for ${selectedSalaryEmployeeIds.length} selected employee(s)?`,
      confirmLabel: "Update",
      variant: "warning",
    });
    if (!confirmed) return;

    try {
      setErrorMessage(null);
      let successCount = 0;

      for (const empId of selectedSalaryEmployeeIds) {
        const emp = employees.find(e => e.id === empId);
        if (!emp) continue;

        const updatedEmp = {
          ...emp,
          monthlyLedger: {
            ...(emp.monthlyLedger || {}),
            [selectedMonth]: {
              ...(emp.monthlyLedger?.[selectedMonth] || {
                advance: Number(emp.advance || 0),
                penalty: Number(emp.penalty || 0),
                foodPerk: Number(emp.foodPerk || 0),
                accommodationPerk: Number(emp.accommodationPerk || 0),
                conveyancePerk: Number(emp.conveyancePerk || 0),
                penaltyReason: ""
              }),
              paymentStatus: status
            }
          }
        };

        const res = await fetch(`/api/employees/${empId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedEmp)
        });

        if (res.ok) {
          successCount++;
        }
      }

      await fetchEmployees();
      setSelectedSalaryEmployeeIds([]);
      triggerSuccess(`Successfully marked payment status as "${status}" for ${successCount} employee(s) in ${selectedMonth}.`);
    } catch (err: any) {
      setErrorMessage("Failed to bulk update payment status: " + err.message);
    }
  };

  const handleCallInitiate = (name: string, phone: string, role?: string) => {
    const formattedPhone = formatPhoneDisplay(phone);
    const dialPhone = phoneToDialString(phone);
    setActiveDialerContact({ name, phone: formattedPhone, role });
    setActiveDialerStatus("ringing");
    if (dialPhone) {
      try {
        window.location.href = `tel:+${dialPhone}`;
      } catch (e) {}
    }
  };

  const resolveEmployeePhone = (emp: Employee): string => {
    return (
      emp.employeeMobile ||
      emp.aadharLinkMobNo ||
      (emp as Employee & { mobileNumberColumn?: string; mobileNumber?: string }).mobileNumberColumn ||
      (emp as Employee & { mobileNumberColumn?: string; mobileNumber?: string }).mobileNumber ||
      ""
    );
  };

  // Enhanced Dynamic On-Demand Reports State Config
  const [selectedReportColumns, setSelectedReportColumns] = useState<string[]>(EXCEL_ROW_HEADERS);
  const [reportLocFilters, setReportLocFilters] = useState<string[]>([]);
  const [reportJoinStartFilter, setReportJoinStartFilter] = useState<string>("");
  const [reportJoinEndFilter, setReportJoinEndFilter] = useState<string>("");
  const [reportExitStartFilter, setReportExitStartFilter] = useState<string>("");
  const [reportExitEndFilter, setReportExitEndFilter] = useState<string>("");
  const [reportMinSalaryFilter, setReportMinSalaryFilter] = useState<string>("");
  const [reportMaxSalaryFilter, setReportMaxSalaryFilter] = useState<string>("");
  const [reportGenderFilter, setReportGenderFilter] = useState<string>("All");
  const [reportMaritalFilter, setReportMaritalFilter] = useState<string>("All");
  const [reportEsicFilter, setReportEsicFilter] = useState<string>("All");
  const [reportEmploymentFilter, setReportEmploymentFilter] = useState<"active" | "exited" | "all">("active");
  const [reportSkillFilters, setReportSkillFilters] = useState<string[]>([]);
  const [reportRoleFilters, setReportRoleFilters] = useState<string[]>([]);
  const [isReportLocDropdownOpen, setIsReportLocDropdownOpen] = useState(false);
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const reportLocationExportLabel =
    reportLocFilters.length === 0 ? "All Locations" : reportLocFilters.join(", ");
  const [reportSearchQuery, setReportSearchQuery] = useState<string>("");
  const [selectedReportEmployeeIds, setSelectedReportEmployeeIds] = useState<string[]>([]);

  const reportActiveFilterCount = useMemo(() => {
    let count = 0;
    if (reportLocFilters.length > 0) count += 1;
    if (reportJoinStartFilter || reportJoinEndFilter) count += 1;
    if (reportExitStartFilter || reportExitEndFilter) count += 1;
    if (reportMinSalaryFilter || reportMaxSalaryFilter) count += 1;
    if (reportGenderFilter !== "All") count += 1;
    if (reportMaritalFilter !== "All") count += 1;
    if (reportEsicFilter !== "All") count += 1;
    if (reportEmploymentFilter !== "active") count += 1;
    if (reportSkillFilters.length > 0) count += 1;
    if (reportRoleFilters.length > 0) count += 1;
    if (reportSearchQuery.trim()) count += 1;
    return count;
  }, [
    reportLocFilters,
    reportJoinStartFilter,
    reportJoinEndFilter,
    reportExitStartFilter,
    reportExitEndFilter,
    reportMinSalaryFilter,
    reportMaxSalaryFilter,
    reportGenderFilter,
    reportMaritalFilter,
    reportEsicFilter,
    reportEmploymentFilter,
    reportSkillFilters,
    reportRoleFilters,
    reportSearchQuery,
  ]);

  const clearReportFilters = useCallback(() => {
    setReportLocFilters([]);
    setReportJoinStartFilter("");
    setReportJoinEndFilter("");
    setReportExitStartFilter("");
    setReportExitEndFilter("");
    setReportMinSalaryFilter("");
    setReportMaxSalaryFilter("");
    setReportGenderFilter("All");
    setReportMaritalFilter("All");
    setReportEsicFilter("All");
    setReportEmploymentFilter("active");
    setReportSkillFilters([]);
    setReportRoleFilters([]);
    setReportSearchQuery("");
    setSelectedReportEmployeeIds([]);
    setIsReportLocDropdownOpen(false);
    setIsSkillDropdownOpen(false);
    setIsRoleDropdownOpen(false);
  }, []);

  const reportOverviewStats = useMemo(() => {
    const activeEmployees = employees.filter((emp) => !isEmployeeExitedGeneral(emp));
    const totalActive = activeEmployees.length;
    const totalGross = activeEmployees.reduce((acc, emp) => acc + (emp.grossSalary || 0), 0);
    const esicCovered = activeEmployees.filter((emp) => {
      const isCompliant = locationCompliance[emp.location || ""] !== false;
      return isEmployeeEsicCovered(
        emp.grossSalary || 0,
        esicEligibilityLimit,
        isCompliant,
        emp.esic,
      );
    }).length;

    const locationMap = new Map<string, number>();
    activeEmployees.forEach((emp) => {
      const loc = emp.location?.trim() || "Unassigned";
      locationMap.set(loc, (locationMap.get(loc) || 0) + 1);
    });
    const locationBreakdown = Array.from(locationMap.entries())
      .map(([label, count]) => ({
        label,
        count,
        pct: totalActive ? Math.round((count / totalActive) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const genderBuckets = [
      { label: "Male", count: 0 },
      { label: "Female", count: 0 },
      { label: "Other", count: 0 },
      { label: "Not specified", count: 0 },
    ];
    activeEmployees.forEach((emp) => {
      const gender = (emp.gender || "").trim().toLowerCase();
      if (gender === "male") genderBuckets[0].count += 1;
      else if (gender === "female") genderBuckets[1].count += 1;
      else if (gender === "other") genderBuckets[2].count += 1;
      else genderBuckets[3].count += 1;
    });
    const genderBreakdown = genderBuckets
      .map((bucket) => ({
        ...bucket,
        pct: totalActive ? Math.round((bucket.count / totalActive) * 100) : 0,
      }))
      .filter((bucket) => bucket.count > 0 || bucket.label !== "Not specified");

    return {
      totalActive,
      totalGross,
      averageSalary: totalActive ? Math.round(totalGross / totalActive) : 0,
      esicCovered,
      esicCoveragePct: totalActive ? Math.round((esicCovered / totalActive) * 100) : 0,
      locationCount: locationMap.size,
      locationBreakdown,
      genderBreakdown,
    };
  }, [employees, esicEligibilityLimit, locationCompliance]);

  useEffect(() => {
    setSelectedReportEmployeeIds([]);
  }, [
    reportLocFilters,
    reportJoinStartFilter,
    reportJoinEndFilter,
    reportExitStartFilter,
    reportExitEndFilter,
    reportMinSalaryFilter,
    reportMaxSalaryFilter,
    reportGenderFilter,
    reportMaritalFilter,
    reportEsicFilter,
    reportEmploymentFilter,
    reportSkillFilters,
    reportRoleFilters,
    reportSearchQuery,
  ]);

  // Dynamic report matching resolver
  const filteredReportEmployees = useMemo(() => {
    return employees.filter(emp => {
      const isExited = isEmployeeExitedGeneral(emp);
      if (reportEmploymentFilter === "active" && isExited) {
        return false;
      }
      if (reportEmploymentFilter === "exited" && !isExited) {
        return false;
      }

      // 1. Location Filter (multi-select)
      if (reportLocFilters.length > 0) {
        const empLoc = (emp.location || "").toLowerCase();
        if (!reportLocFilters.some((loc) => loc.toLowerCase() === empLoc)) {
          return false;
        }
      }

      // 2. Joining Date Filter (PF Joining Date)
      if (reportJoinStartFilter) {
        if (!emp.pfJoiningDate || emp.pfJoiningDate < reportJoinStartFilter) {
          return false;
        }
      }
      if (reportJoinEndFilter) {
        if (!emp.pfJoiningDate || emp.pfJoiningDate > reportJoinEndFilter) {
          return false;
        }
      }

      // 3. Exit Date Filter
      let exitDateVal = "";
      if ((emp as any).exitDate) {
        exitDateVal = (emp as any).exitDate;
      } else if (emp.customFields && Array.isArray(emp.customFields)) {
        const exitField = emp.customFields.find(f => 
          f.name.toLowerCase().includes("exit") || 
          f.name.toLowerCase().includes("resignation") || 
          f.name.toLowerCase().includes("leaving_date") ||
          f.name.toLowerCase().includes("leaving date")
        );
        if (exitField) {
          exitDateVal = exitField.value || "";
        }
      }
      if (reportExitStartFilter) {
        if (!exitDateVal || exitDateVal < reportExitStartFilter) {
          return false;
        }
      }
      if (reportExitEndFilter) {
        if (!exitDateVal || exitDateVal > reportExitEndFilter) {
          return false;
        }
      }

      // 4. Gross Salary Filter
      const gross = emp.grossSalary || 0;
      if (reportMinSalaryFilter) {
        const minS = parseFloat(reportMinSalaryFilter);
        if (!isNaN(minS) && gross < minS) {
          return false;
        }
      }
      if (reportMaxSalaryFilter) {
        const maxS = parseFloat(reportMaxSalaryFilter);
        if (!isNaN(maxS) && gross > maxS) {
          return false;
        }
      }

      // 5. Gender Filter
      if (reportGenderFilter !== "All") {
        if ((emp.gender || "").toLowerCase() !== reportGenderFilter.toLowerCase()) {
          return false;
        }
      }

      // 6. Marital Status Filter
      if (reportMaritalFilter !== "All") {
        if ((emp.maritalStatus || "").toLowerCase() !== reportMaritalFilter.toLowerCase()) {
          return false;
        }
      }

      // 7. ESIC Coverage Filter
      if (reportEsicFilter !== "All") {
        const isCompliant = locationCompliance[emp.location || ""] !== false;
        const covered = isEmployeeEsicCovered(
          emp.grossSalary || 0,
          esicEligibilityLimit,
          isCompliant,
          emp.esic,
        );
        const wantsYes = reportEsicFilter.toLowerCase() === "yes";
        if (covered !== wantsYes) {
          return false;
        }
      }

      // 8. Skill Category Filter
      if (reportSkillFilters.length > 0) {
        if (!employeeMatchesSkillFilters(emp, reportSkillFilters)) {
          return false;
        }
      }

      // 9. Job Role Filter
      if (reportRoleFilters.length > 0) {
        if (!reportRoleFilters.map(r => r.toLowerCase()).includes((emp.role || "").toLowerCase())) {
          return false;
        }
      }

      // 10. Search Query Filter
      if (reportSearchQuery) {
        const q = reportSearchQuery.toLowerCase().trim();
        const codeMatch = (emp.employeeCode || "").toLowerCase().includes(q);
        const nameMatch1 = (emp.nameAsPerAadhar || "").toLowerCase().includes(q);
        const nameMatch2 = (emp.nameAsPerAadharColumn || "").toLowerCase().includes(q);
        const nameMatch3 = (emp.nameAsPerBank || "").toLowerCase().includes(q);
        if (!codeMatch && !nameMatch1 && !nameMatch2 && !nameMatch3) {
          return false;
        }
      }

      return true;
    });
  }, [
    employees,
    reportLocFilters,
    reportJoinStartFilter,
    reportJoinEndFilter,
    reportExitStartFilter,
    reportExitEndFilter,
    reportMinSalaryFilter,
    reportMaxSalaryFilter,
    reportGenderFilter,
    reportMaritalFilter,
    reportEsicFilter,
    reportEmploymentFilter,
    reportSkillFilters,
    reportRoleFilters,
    reportSearchQuery,
    esicEligibilityLimit,
    locationCompliance,
  ]);

  // Download custom CSV report
  const downloadReportsCSV = (data: Employee[], cols: string[]) => {
    try {
      const csvContent = [
        cols.join(","),
        ...data.map((emp, idx) => 
          cols.map(c => {
            const val = String(getEmployeeHeaderValue(emp, c, idx));
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(",")
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `custom_report_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      triggerSuccess(`Successfully generated CSV with ${cols.length} columns and ${data.length} records!`);

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DOWNLOAD_REPORT_CSV",
          target: `Custom Onboarding CSV Report: Downloaded custom employee report in CSV format containing ${cols.length} columns and ${data.length} records.`,
          details: { format: "CSV", recordCount: data.length, columns: cols }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
    } catch (err: any) {
      setErrorMessage("CSV download error: " + err.message);
    }
  };

  // Download custom Excel report using ExcelJS
  const downloadReportsExcel = async (data: Employee[], cols: string[], activeLocation: string) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Corporate Onboarding Customs");

      // Configure Page Setup for Landscape orientation
      ws.pageSetup = { orientation: "landscape" };

      // Set nicely styled titles
      ws.addRow([`Dynamic Segmented Onboarding Report`]);
      ws.addRow([`Worksite / Branch Location: ${activeLocation || "All Locations"}`]);
      ws.addRow([`Generated on: ${new Date().toLocaleString()} | Filtered records: ${data.length}`]);
      ws.addRow([]); // Grid buffer space

      ws.getRow(1).font = { bold: true, size: 14, color: { argb: "FFF57416" }, name: "Calibri" };
      ws.getRow(2).font = { bold: true, size: 10, color: { argb: "FF334155" }, name: "Calibri" };
      ws.getRow(3).font = { italic: true, size: 9, color: { argb: "FF475569" }, name: "Calibri" };

      // Set table headers
      ws.addRow(cols);
      const headerRow = ws.getRow(5);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF791A" } // Corporate orange branding header
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      headerRow.height = 24;

      // Add actual data
      data.forEach((emp, rIdx) => {
        const rowData = cols.map(c => getEmployeeHeaderValue(emp, c, rIdx));
        ws.addRow(rowData);
      });

      // Auto-scale column widths
      ws.columns.forEach((col, cIdx) => {
        let maxTextLen = 0;
        col.eachCell({ includeEmpty: true }, (cell, rowNum) => {
          if (rowNum < 5) return; // Skip titles
          const strVal = cell.value ? cell.value.toString() : "";
          if (strVal.length > maxTextLen) {
            maxTextLen = strVal.length;
          }
        });
        col.width = Math.max(maxTextLen + 4, 15);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `custom_onboarding_report_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      triggerSuccess(`Successfully generated Excel report with ${cols.length} columns!`);

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DOWNLOAD_REPORT_EXCEL",
          target: `Custom Onboarding Excel Report: Downloaded custom employee report in Excel format (Location: ${activeLocation || "All Locations"}) containing ${cols.length} columns and ${data.length} records.`,
          details: { format: "Excel", location: activeLocation, recordCount: data.length, columns: cols }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
    } catch (err: any) {
      setErrorMessage("Excel download error: " + err.message);
    }
  };

  // Download PDF report
  const downloadReportsPDF = (data: Employee[], cols: string[], activeLocation: string) => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      doc.setFontSize(14);
      doc.setTextColor(245, 116, 22);
      doc.text("DYNAMIC SEGMENTED ONBOARDING SUMMARY", 14, 12);

      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Worksite / Branch Location: ${activeLocation || "All Locations"} | Generated on: ${new Date().toLocaleString()}`, 14, 18);
      doc.text(`Filtered Count: ${data.length} Onboardings`, 14, 23);

      const tableHeaders = [cols];
      const tableData = data.map((emp, idx) => 
        cols.map(c => {
          const val = getEmployeeHeaderValue(emp, c, idx);
          if (typeof val === "number") return val.toLocaleString("en-IN");
          return String(val);
        })
      );

      // Auto-scales font size down depending on number of chosen columns (so that up to 38 columns still fit neatly!)
      let calculatedFontSize = 8;
      if (cols.length > 25) {
        calculatedFontSize = 4;
      } else if (cols.length > 15) {
        calculatedFontSize = 5.5;
      } else if (cols.length > 8) {
        calculatedFontSize = 7;
      }

      autoTable(doc, {
        startY: 27,
        head: tableHeaders,
        body: tableData,
        theme: "grid",
        styles: {
          fontSize: calculatedFontSize,
          cellPadding: 1,
          valign: "middle"
        },
        headStyles: {
          fillColor: [245, 116, 22],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: 8, right: 8 }
      });

      doc.save(`custom_onboarding_report_${new Date().toISOString().slice(0,10)}.pdf`);
      triggerSuccess("Successfully generated PDF custom scale onboarding report!");

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DOWNLOAD_REPORT_PDF",
          target: `Custom Onboarding PDF Report: Downloaded custom employee report in PDF format (Location: ${activeLocation || "All Locations"}) containing ${cols.length} columns and ${data.length} records.`,
          details: { format: "PDF", location: activeLocation, recordCount: data.length, columns: cols }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
    } catch (err: any) {
      setErrorMessage("PDF generation error: " + err.message);
    }
  };

  // Download custom Salary Excel sheet using ExcelJS in landscape orientation with active Location stamp
  const downloadSalaryExcel = async (data: Employee[], cols: string[], activeLocation: string, month: string) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Salary Calculations Sheet");

      // Configure Page Setup for Landscape orientation
      ws.pageSetup = { orientation: "landscape" };

      // Set nicely styled titles
      ws.addRow([`Dynamic Custom Payroll Calculations Sheet — ${month}`]);
      ws.addRow([`Worksite / Branch Location: ${activeLocation || "All Locations"}`]);
      ws.addRow([`Generated on: ${new Date().toLocaleString()} | Filtered records: ${data.length}`]);
      ws.addRow([]); // Grid buffer space

      ws.getRow(1).font = { bold: true, size: 14, color: { argb: "FFF57416" }, name: "Calibri" };
      ws.getRow(2).font = { bold: true, size: 10, color: { argb: "FF334155" }, name: "Calibri" };
      ws.getRow(3).font = { italic: true, size: 9, color: { argb: "FF475569" }, name: "Calibri" };

      // Set table headers
      ws.addRow(cols);
      const headerRow = ws.getRow(5);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF791A" } // Corporate orange branding header
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      headerRow.height = 24;

      // Add actual data
      data.forEach((emp) => {
        const rowData = cols.map(c => getSalaryColumnValue(emp, c, month, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtAmounts));
        ws.addRow(rowData);
      });

      // Auto-scale column widths
      ws.columns.forEach((col, cIdx) => {
        let maxTextLen = 0;
        col.eachCell({ includeEmpty: true }, (cell, rowNum) => {
          if (rowNum < 5) return; // Skip titles
          const strVal = cell.value ? cell.value.toString() : "";
          if (strVal.length > maxTextLen) {
            maxTextLen = strVal.length;
          }
        });
        col.width = Math.max(maxTextLen + 4, 16);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `custom_salary_sheet_${month.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      triggerSuccess(`Successfully generated Excel Salary report with ${cols.length} columns!`);

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DOWNLOAD_SALARY_EXCEL",
          target: `Custom Salary Excel Report: Downloaded custom salary calculation sheet in Excel format for ${month} (Location: ${activeLocation || "All Locations"}) containing ${cols.length} columns and ${data.length} records.`,
          details: { format: "Excel", month, location: activeLocation, recordCount: data.length, columns: cols }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
    } catch (err: any) {
      setErrorMessage("Excel Salary download error: " + err.message);
    }
  };

  // Download custom Salary PDF sheet in landscape orientation with active Location stamp
  const downloadSalaryPDF = (data: Employee[], cols: string[], activeLocation: string, month: string) => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      doc.setFontSize(14);
      doc.setTextColor(245, 116, 22);
      doc.text(`DYNAMIC CUSTOM PAYROLL SUMMARY — ${month.toUpperCase()}`, 14, 12);

      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Worksite / Branch Location: ${activeLocation || "All Locations"} | Generated on: ${new Date().toLocaleString()}`, 14, 18);
      doc.text(`Filtered Count: ${data.length} Employees Mapped`, 14, 23);

      const tableHeaders = [cols];
      const tableData = data.map((emp) => 
        cols.map(c => {
          const val = getSalaryColumnValue(emp, c, month, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtAmounts);
          if (typeof val === "number") return val.toLocaleString("en-IN");
          return String(val);
        })
      );

      // Auto-scale font sizes dynamically based on chosen column counts to always fit A4 Landscape neatly
      let calculatedFontSize = 8;
      if (cols.length > 12) {
        calculatedFontSize = 6.5;
      } else if (cols.length > 8) {
        calculatedFontSize = 7.5;
      }

      autoTable(doc, {
        startY: 27,
        head: tableHeaders,
        body: tableData,
        theme: "grid",
        styles: {
          fontSize: calculatedFontSize,
          cellPadding: 1.5,
          valign: "middle"
        },
        headStyles: {
          fillColor: [245, 116, 22],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: 8, right: 8 }
      });

      doc.save(`custom_salary_sheet_${month.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
      triggerSuccess("Successfully generated PDF landscape custom scale salary sheet!");

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DOWNLOAD_SALARY_PDF",
          target: `Custom Salary PDF Report: Downloaded custom salary calculation PDF for ${month} (Location: ${activeLocation || "All Locations"}) containing ${cols.length} columns and ${data.length} records.`,
          details: { format: "PDF", month, location: activeLocation, recordCount: data.length, columns: cols }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
    } catch (err: any) {
      setErrorMessage("PDF Salary generation error: " + err.message);
    }
  };

  // Fetch employees on component mount
  const fetchEmployees = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/employees");
      if (!res.ok) {
        throw new Error(`Failed to load employee list (${res.status})`);
      }
      const data = await res.json();
      setRawEmployees(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Could not connect to HRMS server: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchoolWorks = async () => {
    setIsSchoolLoading(true);
    try {
      const res = await fetch("/api/school-works");
      if (res.status === 404) {
        setRawSchoolWorks([]);
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load school work list (${res.status})`);
      }
      const data = await res.json();
      setRawSchoolWorks(data);
    } catch (err: any) {
      console.warn("Could not load school work records:", err.message);
      setRawSchoolWorks([]);
    } finally {
      setIsSchoolLoading(false);
    }
  };

  // Fetch administrator accounts from server
  const fetchAdmins = async () => {
    setIsFetchingAdmins(true);
    try {
      const res = await fetch("/api/admins");
      if (res.ok) {
        const data = await res.json();
        setAdminsList(data);
      }
    } catch (err) {
      console.error("Error fetching admin list: ", err);
    } finally {
      setIsFetchingAdmins(false);
    }
  };

  // Fetch currently logged in admin details
  const fetchAdminProfile = async () => {
    if (!sessionUser) return;
    setIsFetchingProfile(true);
    setProfileLoadingError(null);
    try {
      const res = await fetch(`/api/admins/profile?username=${encodeURIComponent(sessionUser)}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to load administrator's profile.");
      }
      const data = await res.json();
      setAdminProfileInfo(data);
      setProfileEmail(data.email || "");
      if (data.disabled) {
        handleLogout();
        setLoginError("Your administrator account is restricted. Session terminated.");
        triggerSuccess("Session restricted by Super-Admin.");
        return;
      }
      if (data.role) {
        localStorage.setItem("hrms_role", data.role);
        setSessionRole(data.role);
      }
      if (data.locations) {
        localStorage.setItem("hrms_locations", JSON.stringify(data.locations));
        setSessionLocations(data.locations);
      }
    } catch (err: any) {
      console.error(err);
      setProfileLoadingError(err.message);
    } finally {
      setIsFetchingProfile(false);
    }
  };

  // Handle password change form submission
  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);

    const oldP = oldPassword.trim();
    const newP = newPassword.trim();
    const confirmP = confirmNewPassword.trim();

    if (!oldP || !newP || !confirmP) {
      setChangePasswordError("Please fill in all directory password fields.");
      return;
    }

    if (newP !== confirmP) {
      setChangePasswordError("Your new passwords do not match. Please verify.");
      return;
    }

    if (newP.length < 4) {
      setChangePasswordError("For robustness, security credentials must be at least 8 characters long.");
      return;
    }

    try {
      const res = await fetch("/api/admins/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: sessionUser,
          oldPassword: oldP,
          newPassword: newP
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to edit user credentials.");
      }

      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setChangePasswordSuccess("✓ Your system administrator password has been updated successfully.");
      triggerSuccess("Administrator password changed.");
    } catch (err: any) {
      setChangePasswordError(err.message);
    }
  };

  const handleProfileEmailSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileEmailError(null);
    setProfileEmailSuccess(null);

    const email = profileEmail.trim();
    if (!email) {
      setProfileEmailError("Please enter a valid email address.");
      return;
    }

    setIsSavingProfileEmail(true);
    try {
      const res = await fetch("/api/admins/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save recovery email.");
      }

      const data = await res.json();
      setProfileEmail(data.email || email);
      setAdminProfileInfo((prev: any) => (prev ? { ...prev, email: data.email || email } : prev));
      setProfileEmailSuccess("✓ Recovery email saved. You can use it on the login page if you forget your password.");
      triggerSuccess("Recovery email updated.");
    } catch (err: any) {
      setProfileEmailError(err.message);
    } finally {
      setIsSavingProfileEmail(false);
    }
  };


  useEffect(() => {
    if (isLoggedIn) {
      fetchEmployees();
      fetchRoles();
      fetchExportTemplates();
      fetchPendingChangeCount();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (
      isLoggedIn &&
      (activeSidebarTab === "School Work" ||
        activeSidebarTab === "School Salary" ||
        activeSidebarTab === "Expenses")
    ) {
      fetchSchoolWorks();
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Employee Management") {
      fetchEmployeeChangeRequests();
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (activeSidebarTab === "Expenses" || activeSidebarTab === "School Salary") {
      setExpandedSidebarGroups((prev) => ({ ...prev, "School Work": true }));
      if (activeSidebarTab === "School Salary") {
        setActiveSchoolSubTab("School Salary");
      }
    }
  }, [activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && sessionUser) {
      fetchAdminProfile();
    }
  }, [isLoggedIn, sessionUser]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Admin") {
      fetchAdmins();
      fetchRoles();
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Directory") {
      fetchHelplines();
    }
  }, [isLoggedIn, activeSidebarTab, fetchHelplines]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Birthdays" && userPermissions.birthdays?.view) {
      fetchBirthdays(birthdaySearchMonth);
    }
  }, [isLoggedIn, activeSidebarTab, birthdaySearchMonth, userPermissions.birthdays?.view, fetchBirthdays]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "My Info") {
      fetchAdminProfile();
    }
  }, [isLoggedIn, activeSidebarTab, sessionUser]);

  // Click outside to close profile dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    if (isProfileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileOpen]);

  // Click outside to close mobile profile dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileProfileDropdownRef.current && !mobileProfileDropdownRef.current.contains(event.target as Node)) {
        setIsMobileProfileOpen(false);
      }
    }
    if (isMobileProfileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileProfileOpen]);

  // Click outside to close multi-select filter dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (isSkillDropdownOpen && !target.closest("#skill-multiselect-container")) {
        setIsSkillDropdownOpen(false);
      }
      if (isRoleDropdownOpen && !target.closest("#role-multiselect-container")) {
        setIsRoleDropdownOpen(false);
      }
      if (isSalarySkillDropdownOpen && !target.closest("#salary-skill-multiselect-container")) {
        setIsSalarySkillDropdownOpen(false);
      }
      if (isSalaryRoleDropdownOpen && !target.closest("#salary-role-multiselect-container")) {
        setIsSalaryRoleDropdownOpen(false);
      }
      if (isAttendanceRoleDropdownOpen && !target.closest("#attendance-role-multiselect-container")) {
        setIsAttendanceRoleDropdownOpen(false);
      }
      if (isAttendanceSkillDropdownOpen && !target.closest("#attendance-skill-multiselect-container")) {
        setIsAttendanceSkillDropdownOpen(false);
      }
      if (isBulkWizardRoleDropdownOpen && !target.closest("#bulk-wizard-role-multiselect-container")) {
        setIsBulkWizardRoleDropdownOpen(false);
      }
      if (isBulkWizardSkillDropdownOpen && !target.closest("#bulk-wizard-skill-multiselect-container")) {
        setIsBulkWizardSkillDropdownOpen(false);
      }
      if (isLedgerLocationDropdownOpen && !target.closest("#ledger-location-multiselect-container")) {
        setIsLedgerLocationDropdownOpen(false);
      }
      if (isLedgerSkillDropdownOpen && !target.closest("#ledger-skill-multiselect-container")) {
        setIsLedgerSkillDropdownOpen(false);
      }
      if (isLedgerRoleDropdownOpen && !target.closest("#ledger-role-multiselect-container")) {
        setIsLedgerRoleDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    isSkillDropdownOpen, 
    isRoleDropdownOpen, 
    isSalarySkillDropdownOpen, 
    isSalaryRoleDropdownOpen,
    isAttendanceRoleDropdownOpen,
    isAttendanceSkillDropdownOpen,
    isBulkWizardRoleDropdownOpen,
    isBulkWizardSkillDropdownOpen,
    isLedgerLocationDropdownOpen,
    isLedgerSkillDropdownOpen,
    isLedgerRoleDropdownOpen,
  ]);

  // Show auto-expiring success indicator
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = usernameInput.trim();
    if (!cleanUser) {
      setLoginError("Please enter a username.");
      return;
    }
    try {
      setLoginError(null);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUser, password: passwordInput }),
      });
      if (!res.ok) {
        throw await parseApiError(res, "Incorrect administrator username or password.");
      }
      const data = await res.json();
      localStorage.setItem("hrms_logged_in", "true");
      localStorage.setItem("hrms_session_token", data.token);
      localStorage.setItem("hrms_username", data.username);
      localStorage.setItem("hrms_role", data.role || "admin");
      localStorage.setItem("hrms_locations", JSON.stringify(data.locations || []));
      setSessionUser(data.username);
      setSessionRole(data.role || "admin");
      setSessionLocations(data.locations || []);
      setIsLoggedIn(true);
      navigate(DEFAULT_PATH);
      triggerSuccess(`Successfully authenticated. Welcome back, ${data.username}!`);
      // Permissions loaded via /api/auth/me effect when isLoggedIn becomes true
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = forgotUsername.trim();
    if (!cleanUser) {
      setForgotError("Please enter your username or recovery email.");
      return;
    }
    try {
      setForgotError(null);
      setForgotMessage(null);
      setIssuedResetToken(null);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUser }),
      });
      if (!res.ok) {
        throw await parseApiError(res, "Unable to process password reset request.");
      }
      const data = await res.json();
      setForgotMessage(data.message);
      if (data.resetToken) {
        setIssuedResetToken(data.resetToken);
        setResetTokenInput(data.resetToken);
        setUsernameInput(data.username || cleanUser);
        setLoginView("reset");
      } else if (data.username) {
        setForgotUsername(data.username);
        setUsernameInput(data.username);
        setResetTokenInput("");
        setIssuedResetToken(null);
        setLoginView("reset");
      }
    } catch (err: any) {
      setForgotError(err.message);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    const username = (forgotUsername || usernameInput).trim();
    const token = resetTokenInput.trim();
    const newP = resetNewPassword.trim();
    const confirmP = resetConfirmPassword.trim();

    if (!username || !token || !newP || !confirmP) {
      setResetError("Please fill in all fields.");
      return;
    }
    if (newP !== confirmP) {
      setResetError("New passwords do not match.");
      return;
    }
    if (newP.length < 8) {
      setResetError("Password must be at least 8 characters long.");
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          resetToken: token,
          newPassword: newP,
        }),
      });
      if (!res.ok) {
        throw await parseApiError(res, "Unable to reset password.");
      }
      const data = await res.json();
      setResetSuccess(data.message || "Password updated successfully.");
      setPasswordInput("");
      setResetNewPassword("");
      setResetConfirmPassword("");
      setResetTokenInput("");
      setIssuedResetToken(null);
      setForgotUsername("");
      setTimeout(() => {
        setLoginView("signin");
        setResetSuccess(null);
        setForgotMessage(null);
      }, 2500);
    } catch (err: any) {
      setResetError(err.message);
    }
  };

  const openForgotPassword = () => {
    setLoginView("forgot");
    setLoginError(null);
    setForgotError(null);
    setForgotMessage(null);
    setIssuedResetToken(null);
    setForgotUsername(usernameInput);
  };

  const backToSignIn = () => {
    setLoginView("signin");
    setForgotError(null);
    setForgotMessage(null);
    setResetError(null);
    setResetSuccess(null);
    setIssuedResetToken(null);
  };

  // Handler for Admin inviting Admin
  const handleInviteAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = inviteUsername.trim();
    const p = invitePassword.trim();
    if (!u || !p) {
      setInviteError("Both new username and password are required.");
      return;
    }
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetch("/api/admins/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: u,
          password: p,
          invitedBy: sessionUser,
          role: inviteRole,
          locations: inviteLocations
        })
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to invite the new administrator.");
      }
      setInviteUsername("");
      setInvitePassword("");
      setInviteRole("");
      setInviteLocations([]);
      await fetchAdmins();
      triggerSuccess(`Successfully invited "${u}" as a new system administrator.`);
      setInviteSuccess(`Onboarding successful: "${u}" has been registered and can now login!`);
    } catch (err: any) {
      setInviteError(err.message);
    }
  };

  // Handler to update an existing admin profile (role, status toggle, locations)
  const handleUpdateAdminSubmit = async (username: string) => {
    try {
      const res = await fetch("/api/admins/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          role: editAdminRole,
          locations: editAdminLocations,
          disabled: editAdminDisabled
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update administrator settings.");
      }

      triggerSuccess(`Successfully updated settings for "${username}".`);
      setEditingAdminUsername(null);
      await fetchAdmins();

      // If they edited their own profile, sync immediately!
      if (username.toLowerCase() === sessionUser.toLowerCase()) {
        await fetchAdminProfile();
      }
    } catch (err: any) {
      triggerSuccess(`Error updating admin: ${err.message}`);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    const token = localStorage.getItem("hrms_session_token");
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore network errors during logout
      }
    }
    localStorage.removeItem("hrms_logged_in");
    localStorage.removeItem("hrms_session_token");
    localStorage.removeItem("hrms_username");
    localStorage.removeItem("hrms_role");
    localStorage.removeItem("hrms_locations");
    setIsLoggedIn(false);
    setIsProfileOpen(false);
    setUsernameInput("");
    setPasswordInput("");
    setSessionRole("admin");
    setSessionLocations([]);
    setSessionPermissions(null);
    navigate("/login");
  };

  // Save / Update a custom role
  const handleSaveRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = roleNameInput.trim();
    if (!name) {
      setRoleError("Role name is required.");
      return;
    }
    if (name.toLowerCase() === "admin") {
      setRoleError("Cannot override reserved 'admin' role.");
      return;
    }
    setRoleError(null);
    setRoleSuccess(null);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: roleDescInput,
          permissions: rolePermsInput
        })
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save the custom role.");
      }
      setRoleNameInput("");
      setRoleDescInput("");
      setRolePermsInput({
        employees: { view: true, edit: true },
        schoolWork: { view: true, edit: true },
        salary: { view: false, edit: false },
        ledger: { view: false, edit: false },
        attendance: { view: true, edit: true },
        leave: { view: true, edit: true },
        birthdays: { view: true, edit: false },
        directory: { view: true, edit: false },
        admin: { view: false, edit: false }
      });
      await fetchRoles();
      triggerSuccess(`Successfully saved custom role "${name}".`);
      setRoleSuccess(`Custom role "${name}" has been created/updated!`);
    } catch (err: any) {
      setRoleError(err.message);
    }
  };

  // Delete a custom role
  const handleDeleteRole = async (name: string) => {
    const confirmed = await confirmAction({
      title: "Delete custom role",
      message: `Are you sure you want to delete the custom role "${name}"?`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/roles/${encodeURIComponent(name)}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        throw new Error("Failed to delete custom role.");
      }
      await fetchRoles();
      triggerSuccess(`Successfully deleted custom role "${name}".`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add or Edit Employee Save Trigger
  const handleSaveEmployee = async (empData: Partial<Employee>): Promise<Employee | null> => {
    try {
      setErrorMessage(null);
      const isEdit = !!empData.id && rawEmployees.some((e) => e.id === empData.id);

      const payload = {
        ...empData,
        ...(empData.skillCategory !== undefined && empData.skillCategory !== null
          ? { skillCategory: normalizeSkillCategory(empData.skillCategory) || empData.skillCategory }
          : {}),
      };
      
      const url = isEdit ? `/api/employees/${empData.id}` : "/api/employees";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error || "Server rejected save request.");
      }

      const savedEmployee = (await res.json()) as Employee;
      await fetchEmployees();
      triggerSuccess(
        isEdit 
          ? `Successfully saved changes for employee "${empData.employeeCode}". ID card updated.` 
          : `Successfully onboarded employee "${empData.employeeCode}". You can now upload documents.`
      );
      return savedEmployee;
    } catch (err: any) {
      setErrorMessage("Onboarding Save Refused: " + err.message);
      return null;
    }
  };

  // Bulk Import handler from CSV component
  const handleBulkImport = async (importedList: any[]) => {
    if (importedList.length === 0) return;
    try {
      setErrorMessage(null);
      const normalizedList = importedList.map((row) => ({
        ...row,
        ...(row.skillCategory !== undefined && row.skillCategory !== null
          ? { skillCategory: normalizeSkillCategory(row.skillCategory) || row.skillCategory }
          : {}),
      }));
      const res = await fetch("/api/employees/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedList),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Server bulk creation endpoint failed.");
      }

      const report = await res.json();
      await fetchEmployees();
      
      let summary = `Bulk import complete! Onboarded ${report.added} employees successfully.`;
      if (report.skipped > 0) {
        summary += ` ${report.skipped} duplicate or blank records skipped.`;
      }
      triggerSuccess(summary);
    } catch (err: any) {
      setErrorMessage("Failed to perform bulk upload ingestion: " + err.message);
    }
  };

  const fetchEmployeeChangeRequests = async (status?: string) => {
    setIsFetchingChangeRequests(true);
    try {
      const url = status
        ? `/api/employees/change-requests?status=${encodeURIComponent(status)}`
        : "/api/employees/change-requests";
      const res = await fetch(url);
      if (!res.ok) throw await parseApiError(res, "Failed to load change requests.");
      const data = await res.json();
      setEmployeeChangeRequests(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Could not load employee change requests: " + err.message);
    } finally {
      setIsFetchingChangeRequests(false);
    }
  };

  const fetchPendingChangeCount = async () => {
    try {
      const res = await fetch("/api/employees/change-requests/pending-count");
      if (res.ok) {
        const count = await res.json();
        setPendingChangeCount(typeof count === "number" ? count : 0);
      }
    } catch {
      /* non-critical */
    }
  };

  const handleBulkEditDraftChange = (employeeId: string, field: keyof Employee, value: string) => {
    setBulkEditDrafts((prev) => {
      const { drafts, anchors } = applyBulkEditDraftUpdate(
        prev,
        bulkEditSalaryAnchorsRef.current,
        rawEmployees,
        employeeId,
        field,
        value,
        basicSalaryPercentage,
        esicEligibilityLimit,
      );
      bulkEditSalaryAnchorsRef.current = anchors;
      setBulkEditSalaryAnchors(anchors);
      return drafts;
    });
  };

  const handleBulkEditDraftChangeMany = (
    updates: Array<{ employeeId: string; field: keyof Employee; value: string }>,
  ) => {
    if (updates.length === 0) return;
    if (updates.length === 1) {
      handleBulkEditDraftChange(updates[0].employeeId, updates[0].field, updates[0].value);
      return;
    }
    setBulkEditDrafts((prev) => {
      let nextDrafts = prev;
      let nextAnchors = bulkEditSalaryAnchorsRef.current;
      for (const update of updates) {
        const result = applyBulkEditDraftUpdate(
          nextDrafts,
          nextAnchors,
          rawEmployees,
          update.employeeId,
          update.field,
          update.value,
          basicSalaryPercentage,
          esicEligibilityLimit,
        );
        nextDrafts = result.drafts;
        nextAnchors = result.anchors;
      }
      bulkEditSalaryAnchorsRef.current = nextAnchors;
      setBulkEditSalaryAnchors(nextAnchors);
      return nextDrafts;
    });
  };

  const handleBulkEditCustomFieldChange = (
    employeeId: string,
    fieldName: string,
    value: string,
  ) => {
    setBulkEditDrafts((prev) =>
      applyBulkEditCustomFieldUpdate(prev, rawEmployees, employeeId, fieldName, value),
    );
  };

  const handleBulkEditCustomFieldChangeMany = (
    updates: Array<{ employeeId: string; fieldName: string; value: string }>,
  ) => {
    if (updates.length === 0) return;
    if (updates.length === 1) {
      handleBulkEditCustomFieldChange(
        updates[0].employeeId,
        updates[0].fieldName,
        updates[0].value,
      );
      return;
    }
    setBulkEditDrafts((prev) => {
      let next = prev;
      for (const update of updates) {
        next = applyBulkEditCustomFieldUpdate(
          next,
          rawEmployees,
          update.employeeId,
          update.fieldName,
          update.value,
        );
      }
      return next;
    });
  };

  const handleDiscardBulkEditDrafts = async () => {
    if (Object.keys(bulkEditDrafts).length === 0) return;
    const confirmed = await confirmAction({
      title: "Discard changes",
      message: "Discard all unsaved bulk edit changes?",
      confirmLabel: "Discard",
      variant: "warning",
    });
    if (!confirmed) return;
    setBulkEditDrafts({});
    bulkEditSalaryAnchorsRef.current = {};
    setBulkEditSalaryAnchors({});
  };

  const handleApplyBulkEmployeeChanges = async () => {
    if (!userPermissions.employees?.edit) {
      alert("Action locked: You do not have write permissions for Employees.");
      return;
    }

    const updates = buildSubmissionPayload(rawEmployees, bulkEditDrafts);
    if (updates.length === 0) {
      alert("No changes to apply.");
      return;
    }

    setIsSubmittingBulkEdit(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/employees/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to apply bulk employee changes.");

      const result = await res.json();
      setBulkEditDrafts({});
      bulkEditSalaryAnchorsRef.current = {};
      setBulkEditSalaryAnchors({});
      await fetchEmployees();
      triggerSuccess(
        `Applied bulk edit for ${result.applied ?? result.employeeCount ?? updates.length} employee(s).`,
      );
    } catch (err: any) {
      setErrorMessage("Bulk edit apply failed: " + err.message);
      throw err;
    } finally {
      setIsSubmittingBulkEdit(false);
    }
  };

  const handleApproveEmployeeChanges = async (requestId: string, reviewNotes: string) => {
    if (!userPermissions.admin?.edit) {
      alert("Only administrators with admin edit permission can approve changes.");
      return;
    }
    try {
      const res = await fetch(`/api/employees/change-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to approve change request.");

      const result = await res.json();
      await fetchEmployees();
      await fetchEmployeeChangeRequests();
      await fetchPendingChangeCount();
      triggerSuccess(`Approved and published ${result.applied} employee update(s).`);
    } catch (err: any) {
      alert(err.message);
      throw err;
    }
  };

  const handleRejectEmployeeChanges = async (requestId: string, reviewNotes: string) => {
    if (!userPermissions.admin?.edit) {
      alert("Only administrators with admin edit permission can reject changes.");
      return;
    }
    try {
      const res = await fetch(`/api/employees/change-requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to reject change request.");

      await fetchEmployeeChangeRequests();
      await fetchPendingChangeCount();
      triggerSuccess("Change request rejected. No updates were published.");
    } catch (err: any) {
      alert(err.message);
      throw err;
    }
  };

  const handleMarkEmployeeExit = async (
    id: string,
    exitDate: string,
    exitReason: string,
  ): Promise<boolean> => {
    const trimmedDate = exitDate.trim();
    const trimmedReason = exitReason.trim();
    if (!trimmedDate) {
      alert("Please select an exit / leaving date.");
      return false;
    }
    if (!trimmedReason) {
      alert("Please provide a reason for exit.");
      return false;
    }

    try {
      setErrorMessage(null);
      const res = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exitDate: trimmedDate, exitReason: trimmedReason }),
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error || "Failed to mark employee as exited.");
      }

      await fetchEmployees();
      triggerSuccess(`Employee marked as exited effective ${trimmedDate}.`);
      return true;
    } catch (err: any) {
      setErrorMessage("Mark Exit Failed: " + err.message);
      return false;
    }
  };

  const handleBulkMarkExit = async (ids: string[], exitDate: string, exitReason: string) => {
    const trimmedDate = exitDate.trim();
    const trimmedReason = exitReason.trim();
    if (ids.length === 0) return;
    if (!trimmedDate) {
      alert("Please select an exit / leaving date.");
      return;
    }
    if (!trimmedReason) {
      alert("Please provide a reason for exit.");
      return;
    }

    try {
      setErrorMessage(null);
      const res = await fetch("/api/employees/mark-exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, exitDate: trimmedDate, exitReason: trimmedReason }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Bulk mark exit request failed.");
      }

      const report = await res.json();
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      await fetchEmployees();
      triggerSuccess(
        `Marked ${report.count ?? ids.length} employee(s) as exited effective ${trimmedDate}.`,
      );
    } catch (err: any) {
      setErrorMessage("Bulk Mark Exit Failed: " + err.message);
    }
  };

  // Single Delete Tracker
  const handleDeleteEmployee = async (id: string) => {
    const confirmed = await confirmAction({
      title: "Delete employee",
      message: `Are you sure you want to permanently remove employee "${id}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/employees/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });

      if (!res.ok) throw new Error("Delete request refused by backend.");

      setSelectedIds((prev) => prev.filter((item) => item !== id));
      await fetchEmployees();
      triggerSuccess("Employee record removed successfully.");
    } catch (err: any) {
      setErrorMessage("Deletion Failed: " + err.message);
    }
  };

  const handleSaveSchoolWork = async (data: Partial<SchoolWork>): Promise<boolean> => {
    try {
      setErrorMessage(null);
      const isEdit = !!data.id && rawSchoolWorks.some((s) => s.id === data.id);
      const url = isEdit ? `/api/school-works/${data.id}` : "/api/school-works";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error || "Server rejected save request.");
      }
      await fetchSchoolWorks();
      triggerSuccess(
        isEdit
          ? `Successfully saved changes for school "${data.schoolName}"`
          : `Successfully added school "${data.schoolName}"`,
      );
      return true;
    } catch (err: any) {
      setErrorMessage("School save failed: " + err.message);
      return false;
    }
  };

  const handleBulkSchoolImport = async (importedList: Partial<SchoolWork>[]) => {
    if (importedList.length === 0) return;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-works/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importedList),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Server bulk creation endpoint failed.");
      }
      const report = await res.json();
      await fetchSchoolWorks();
      let summary = `Bulk import complete! Added ${report.added} school(s).`;
      if (report.skipped > 0) summary += ` ${report.skipped} duplicate UDISE(s) skipped.`;
      triggerSuccess(summary);
    } catch (err: any) {
      setErrorMessage("Failed to perform school bulk upload: " + err.message);
    }
  };

  const handleDeleteSchoolWork = async (id: string) => {
    const confirmed = await confirmAction({
      title: "Delete school record",
      message: "Are you sure you want to permanently remove this school record? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-works/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error("Delete request refused by backend.");
      setSelectedSchoolIds((prev) => prev.filter((item) => item !== id));
      await fetchSchoolWorks();
      triggerSuccess("School record removed successfully.");
    } catch (err: any) {
      setErrorMessage("Deletion Failed: " + err.message);
    }
  };

  const handleBulkDeleteSchools = async (ids: string[]) => {
    const confirmed = await confirmAction({
      title: "Delete school records",
      message: `You are about to permanently delete ${ids.length} selected school record(s). This cannot be undone.`,
      confirmLabel: "Delete all",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-works/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Bulk delete rejected.");
      setSelectedSchoolIds([]);
      await fetchSchoolWorks();
      triggerSuccess(`Successfully removed ${ids.length} school record(s).`);
    } catch (err: any) {
      setErrorMessage("Bulk Deletion Failed: " + err.message);
    }
  };

  const handleExportSchoolsSelected = async (type: "csv" | "excel", ids: string[]) => {
    const selected = rawSchoolWorks.filter((s) => ids.includes(s.id));
    if (selected.length === 0) return;
    if (type === "csv") {
      const lines = [SCHOOL_EXCEL_ROW_HEADERS.join(",")];
      selected.forEach((school, index) => {
        lines.push(
          SCHOOL_EXCEL_ROW_HEADERS.map((h) => quoteCSVValue(getSchoolHeaderValue(school, h, index))).join(","),
        );
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `school_work_export_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      triggerSuccess(`Exported ${selected.length} school record(s) as CSV.`);
    } else {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("School Work");
      ws.addRow(SCHOOL_EXCEL_ROW_HEADERS);
      selected.forEach((school, index) => {
        ws.addRow(SCHOOL_EXCEL_ROW_HEADERS.map((h) => getSchoolHeaderValue(school, h, index)));
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `school_work_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      triggerSuccess(`Exported ${selected.length} school record(s) as Excel.`);
    }
  };

  const handleExportSchoolExpenseSalary = async (type: "csv" | "excel", rows: SchoolWork[]) => {
    if (rows.length === 0) return;
    if (type === "csv") {
      const blob = new Blob([buildSchoolExpenseSalaryCsv(rows, selectedMonth)], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `school_expenses_salary_${selectedMonth.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      triggerSuccess(`Exported ${rows.length} school expense salary record(s) as CSV.`);
    } else {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("School Expenses Salary");
      ws.addRow(SCHOOL_EXPENSE_SALARY_HEADERS);
      rows.forEach((school, index) => {
        ws.addRow(getSchoolExpenseSalaryRow(school, index, selectedMonth));
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `school_expenses_salary_${selectedMonth.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      triggerSuccess(`Exported ${rows.length} school expense salary record(s) as Excel.`);
    }
  };

  const handleDistributeBlockExpense = async (payload: {
    block: string;
    monthKey: string;
    materialAmount: number;
    miscellaneousAmount: number;
    materialRemark: string;
    miscellaneousRemark: string;
  }): Promise<boolean> => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-works/distribute-block-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || errorJson.error || "Failed to distribute block expense.");
      }
      const result = await res.json();
      await fetchSchoolWorks();
      triggerSuccess(
        `Applied ${payload.monthKey} expenses to ${result.updatedCount} school(s) in block "${payload.block}". Material ₹${result.perSchoolMaterial}/school, Miscellaneous ₹${result.perSchoolMiscellaneous}/school.`,
      );
      return true;
    } catch (err: any) {
      setErrorMessage("Block expense distribution failed: " + err.message);
      return false;
    }
  };

  const existingSchoolUdiseCodes = useMemo(
    () => rawSchoolWorks.map((s) => s.udise).filter(Boolean),
    [rawSchoolWorks],
  );

  const schoolDashboardStats = useMemo(() => {
    const totalRates = rawSchoolWorks.reduce((sum, s) => sum + (Number(s.rates) || 0), 0);
    const totalToilets = rawSchoolWorks.reduce((sum, s) => sum + (Number(s.noOfToilets) || 0), 0);
    const districts = new Set(rawSchoolWorks.map((s) => s.district).filter(Boolean));
    return {
      totalCount: rawSchoolWorks.length,
      totalRates,
      totalToilets,
      uniqueDistricts: districts.size,
    };
  }, [rawSchoolWorks]);

  // Bulk Selection Delete Trigger
  const handleBulkDelete = async (ids: string[]) => {
    const confirmed = await confirmAction({
      title: "Delete employees",
      message: `You are about to permanently delete ${ids.length} selected employee(s). This cannot be undone.`,
      confirmLabel: "Delete all",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/employees/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) throw new Error("Bulk delete rejected.");

      setSelectedIds([]);
      await fetchEmployees();
      triggerSuccess(`Successfully scrubbed ${ids.length} records from HRMS registry.`);
    } catch (err: any) {
      setErrorMessage("Bulk Deletion Failed: " + err.message);
    }
  };

  const buildAxisBulkPayItems = (employeeList: Employee[]) =>
    employeeList.map((emp) => ({
      paymentAmount:
        Number(
          getSalaryColumnValue(
            emp,
            "Net Payable",
            selectedMonth,
            esicEligibilityLimit,
            attendanceDb,
            locationCompliance,
            locationPtAmounts
          )
        ) || 0,
      beneficiaryName: emp.nameAsPerBank || "",
      accountNo: emp.bankAccountNo || "",
      ifscCode: emp.ifscCode || "",
      phoneNo: emp.employeeMobile || emp.aadharLinkMobNo || "",
      remarks: `${emp.employeeCode} - ${selectedMonth}`,
    }));

  const handleExportAxisBulkPay = async (ids: string[]) => {
    if (!userPermissions.salary?.edit) {
      setErrorMessage(
        "You do not have permission to save bulk pay files. Contact an administrator for salary edit access."
      );
      return;
    }

    const debitAccountNo = getAxisDebitAccountNo();
    if (!debitAccountNo) {
      alert("Debit account number is required for Axis Bulk Pay export.");
      return;
    }

    const selectedEmployees = employees.filter((e) => ids.includes(e.id));
    if (selectedEmployees.length === 0) {
      alert("No rows selected to export.");
      return;
    }

    const missingBank = selectedEmployees.filter(
      (e) => !e.bankAccountNo?.trim() || !e.nameAsPerBank?.trim()
    );
    if (missingBank.length > 0) {
      const proceed = await confirmAction({
        title: "Missing bank details",
        message: `${missingBank.length} selected employee(s) are missing bank account or name-as-per-bank and will be skipped. Continue?`,
        confirmLabel: "Continue",
        variant: "warning",
      });
      if (!proceed) return;
    }

    const payMonth = activeMonthName;
    const payYear = activeCalendarYear;
    if (!/^\d{4}$/.test(payYear)) {
      setErrorMessage(
        `Invalid payroll year "${payYear}". Select a valid month before exporting bulk pay.`
      );
      return;
    }

    const cols =
      selectedSalaryColumns.length > 0 ? selectedSalaryColumns : [...SALARY_HEADERS];
    const salarySheet = {
      month: selectedMonth,
      location: salaryLocationFilter || "All Locations",
      columns: cols,
      employeeRows: selectedEmployees.map((emp) =>
        cols.map((c) =>
          getSalaryColumnValue(
            emp,
            c,
            selectedMonth,
            esicEligibilityLimit,
            attendanceDb,
            locationCompliance,
            locationPtAmounts
          )
        )
      ),
    };

    const filename = buildAxisBulkPayFilename(selectedMonth);
    const { exported, totalAmount, fileBase64 } = downloadAxisBulkPayXls(
      buildAxisBulkPayItems(selectedEmployees),
      { debitAccountNo },
      filename,
      salarySheet
    );

    if (exported === 0) {
      alert("No valid bank payment rows to export. Ensure employees have bank details and net payable > 0.");
      return;
    }

    if (!fileBase64?.trim()) {
      setErrorMessage("Bulk pay file was generated but could not be encoded for server storage. Try again.");
      return;
    }

    setIsExportingBulkPay(true);
    try {
      const saved = await saveAxisBulkPayArchive({
        filename,
        month: payMonth,
        year: payYear,
        recordCount: exported,
        totalAmount,
        employeeIds: ids,
        fileBase64,
      });
      if (!saved?.id) {
        throw new Error("Server did not return a saved archive record.");
      }

      setLastSavedBulkPay(saved);
      setHighlightedBulkPayId(saved.id);
      setBulkPayArchives((prev) => {
        const rest = prev.filter((item: any) => item.id !== saved.id);
        return [saved, ...rest];
      });
      setBulkPayArchiveYearFilter("");
      bulkPayJustSavedRef.current = true;
      await fetchBulkPayArchives("");
      setActiveSidebarTab("Saved Bulk Pay");
      triggerSuccess(
        `Bulk pay saved (${exported} payment${exported > 1 ? "s" : ""}, ₹${totalAmount.toLocaleString("en-IN")}). Saved file includes bank upload sheet and full salary rows/columns — use Re-download or View Excel below. Remove the header row from the BulkPay sheet before bank upload.`
      );

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXPORT_AXIS_BULKPAY",
          target: `Axis Bulk Pay: Exported bank disbursement file for ${selectedMonth} containing ${exported} employee payment records.`,
          details: {
            format: "XLS",
            month: selectedMonth,
            recordCount: exported,
            employeeIds: ids,
            totalAmount,
            archiveId: saved.id,
          },
        }),
      })
        .then(() => fetchAuditLogs())
        .catch((err) => console.error("Audit log error:", err));
    } catch (err: any) {
      setErrorMessage(
        `Bulk pay file downloaded but could not be saved on server: ${err.message}`
      );
    } finally {
      setIsExportingBulkPay(false);
    }
  };

  // Export selected row items back into matching formatted patterns (CSV, Excel, or PDF)
  const handleExportSelected = (exportType: "csv" | "excel" | "pdf", ids: string[]) => {
    const selectedEmployees = employees.filter((e) => ids.includes(e.id));
    if (selectedEmployees.length === 0) {
      alert("No rows selected to export.");
      return;
    }

    if (exportType === "csv") {
      const csvContent = generateCSV(selectedEmployees);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `hrms_employee_export_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerSuccess(`Successfully exported ${selectedEmployees.length} employee records in ESIC CSV pattern.`);

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXPORT_REGISTRY_CSV",
          target: `Employee Registry CSV: Exported active staff directory list in CSV format (ESIC pattern) containing ${selectedEmployees.length} employee records.`,
          details: { format: "CSV", recordCount: selectedEmployees.length, employeeIds: ids }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
      return;
    }

    if (exportType === "excel") {
      // Generate highly styled Excel-compatible HTML file
      let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
      html += `<head><meta charset="utf-8"/><style>
        table { border-collapse: collapse; font-family: sans-serif; font-size: 11px; }
        th { background-color: #ff791a; color: white; font-weight: bold; border: 1px solid #cbd5e1; padding: 6px; }
        td { border: 1px solid #cbd5e1; padding: 6px; }
        .title { font-size: 16px; font-weight: bold; color: #ff791a; padding: 10px 0; text-align: left; }
      </style></head><body>`;
      html += `<table>`;
      html += `<tr><td colspan="8" class="title">FLEX HRM - ACTIVE STAFF REGISTRY REPORT (${selectedEmployees.length} personnel)</td></tr>`;
      html += `<tr>
        <th>SR NO</th>
        <th>Employees Code</th>
        <th>Employee Name (Aadhar)</th>
        <th>Location</th>
        <th>Skill Category</th>
        <th>Job Role</th>
        <th>Mobile Number</th>
        <th>Gross Salary</th>
      </tr>`;
      
      selectedEmployees.forEach((emp, idx) => {
        html += `<tr>
          <td style="text-align: center;">${emp.srNo || (idx + 1)}</td>
          <td style="font-family: monospace;">${emp.employeeCode || "-"}</td>
          <td style="font-weight: bold;">${emp.nameAsPerAadhar || "-"}</td>
          <td>${emp.location || "-"}</td>
          <td>${emp.skillCategory || "-"}</td>
          <td>${emp.role || "-"}</td>
          <td>${emp.employeeMobile || emp.aadharLinkMobNo || "-"}</td>
          <td style="text-align: right; mso-number-format:'\\#\\,\\#\\#0';">${emp.grossSalary || 0}</td>
        </tr>`;
      });
      html += `</table></body></html>`;

      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `hrms_employee_export_${new Date().toISOString().split("T")[0]}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerSuccess(`Successfully exported ${selectedEmployees.length} employee records in Excel format.`);

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXPORT_REGISTRY_EXCEL",
          target: `Employee Registry Excel: Exported active staff directory list in Excel format containing ${selectedEmployees.length} employee records.`,
          details: { format: "Excel", recordCount: selectedEmployees.length, employeeIds: ids }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
      return;
    }

    if (exportType === "pdf") {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      // Add Header
      doc.setFillColor(255, 121, 26); // Brand Orange
      doc.rect(0, 0, 297, 24, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text("FLEX HRM - ACTIVE STAFF REGISTRY REPORT", 12, 11);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(245, 245, 245);
      doc.text(`Generated on: ${new Date().toLocaleString()} • Exported: ${selectedEmployees.length} personnel`, 12, 17);

      const tableBody = selectedEmployees.map((emp, idx) => [
        emp.srNo || (idx + 1),
        emp.employeeCode || "-",
        emp.nameAsPerAadhar || "-",
        emp.location || "-",
        emp.skillCategory || "-",
        emp.role || "-",
        emp.employeeMobile || emp.aadharLinkMobNo || "-",
        `Rs. ${(emp.grossSalary || 0).toLocaleString("en-IN")}`
      ]);

      autoTable(doc, {
        head: [["SR NO", "Emp Code", "Employee Name", "Location", "Skill Category", "Job Role", "Mobile No", "Gross Salary"]],
        body: tableBody,
        startY: 28,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59], // Dark Slate 800
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold"
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85] // Slate 700
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate 50
        },
        margin: { left: 10, right: 10, bottom: 15 }
      });

      // Save PDF
      doc.save(`hrms_employee_registry_${new Date().toISOString().split("T")[0]}.pdf`);
      triggerSuccess(`Successfully generated PDF registry report for ${selectedEmployees.length} personnel!`);

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXPORT_REGISTRY_PDF",
          target: `Employee Registry PDF: Exported active staff directory list in PDF landscape format containing ${selectedEmployees.length} employee records.`,
          details: { format: "PDF", recordCount: selectedEmployees.length, employeeIds: ids }
        })
      }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
      return;
    }
  };

  // --- Executive Dashboard Summary Calculations ---
  const dashboardStats = useMemo(() => {
    const totalCount = employees.length;
    const totalGrossPayroll = employees.reduce((acc, curr) => acc + (curr.grossSalary || 0), 0);
    const esicCoveredCount = employees.filter((e) => (e.grossSalary || 0) <= esicEligibilityLimit && (e.grossSalary || 0) > 0).length;
    const uniqueLocsCount = new Set(employees.map((e) => e.location).filter(Boolean)).size;

    return {
      totalCount,
      totalGrossPayroll,
      esicCoveredCount,
      uniqueLocsCount,
    };
  }, [employees, esicEligibilityLimit]);

  const configHasUnsavedChanges = useMemo(() => {
    return (
      esicEligibilityLimit !== savedPayrollConfig.esicEligibilityLimit ||
      basicSalaryPercentage !== savedPayrollConfig.basicSalaryPercentage ||
      companyBranch.trim() !== savedPayrollConfig.companyBranch.trim()
    );
  }, [esicEligibilityLimit, basicSalaryPercentage, companyBranch, savedPayrollConfig]);

  const configSummary = useMemo(() => {
    const locationCounts: Record<string, number> = {};
    const roleCounts: Record<string, number> = {};
    employees.forEach((emp) => {
      if (emp.location) {
        locationCounts[emp.location] = (locationCounts[emp.location] || 0) + 1;
      }
      if (emp.role) {
        roleCounts[emp.role] = (roleCounts[emp.role] || 0) + 1;
      }
    });
    const registeredLocationSet = new Set(registeredLocations.map((loc) => loc.toLowerCase()));
    const registeredRoleSet = new Set(registeredJobRoles.map((role) => role.toLowerCase()));
    return {
      locationCounts,
      roleCounts,
      registeredLocationSet,
      registeredRoleSet,
      esicCoveredCount: dashboardStats.esicCoveredCount,
      totalEmployees: dashboardStats.totalCount,
    };
  }, [employees, registeredLocations, registeredJobRoles, dashboardStats.esicCoveredCount, dashboardStats.totalCount]);

  const handleSavePayrollConfig = async () => {
    const draft: PayrollConfig = {
      esicEligibilityLimit,
      basicSalaryPercentage,
      companyBranch: companyBranch.trim(),
    };
    const validationError = validatePayrollConfig(draft);
    if (validationError) {
      setConfigValidationError(validationError);
      setErrorMessage(validationError);
      return;
    }

    setIsSavingPayrollConfig(true);
    setConfigValidationError(null);
    setErrorMessage(null);
    try {
      savePayrollConfig(draft);
      setSavedPayrollConfig(draft);
      setCompanyBranch(draft.companyBranch);
      triggerSuccess("Payroll rules saved. Salary calculations will use the updated settings.");
    } finally {
      setIsSavingPayrollConfig(false);
    }
  };

  const handleResetPayrollConfig = () => {
    setEsicEligibilityLimit(savedPayrollConfig.esicEligibilityLimit);
    setBasicSalaryPercentage(savedPayrollConfig.basicSalaryPercentage);
    setCompanyBranch(savedPayrollConfig.companyBranch);
    setConfigValidationError(null);
  };

  // List of all existing employee codes to prevent duplicates in front-end previewers
  const existingCodes = useMemo(() => employees.map((e) => e.employeeCode), [employees]);

  // Dynamic Month-wise and Location-wise Salary Sheet filter selector
  const salaryUniqueLocations = useMemo(() => {
    return customLocations;
  }, [customLocations]);

  const filteredSalaryEmployees = useMemo(() => {
    return employees.filter(emp => {
      // 0. Exited in Prior Month Match
      if (isEmployeeExitedForMonth(emp, selectedMonth)) {
        return false;
      }

      // 1. Search Query Match
      const q = salarySearchQuery.toLowerCase().trim();
      if (q) {
        const codeMatch = emp.employeeCode.toLowerCase().includes(q);
        const nameMatch = (emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "").toLowerCase().includes(q);
        if (!codeMatch && !nameMatch) return false;
      }

      // 2. Location Filter
      if (salaryLocationFilter && salaryLocationFilter !== "All") {
        if ((emp.location || "").toLowerCase() !== salaryLocationFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Joining Date Filter (PF Joining Date)
      if (salaryJoinStartFilter) {
        if (!emp.pfJoiningDate || emp.pfJoiningDate < salaryJoinStartFilter) {
          return false;
        }
      }
      if (salaryJoinEndFilter) {
        if (!emp.pfJoiningDate || emp.pfJoiningDate > salaryJoinEndFilter) {
          return false;
        }
      }

      // 4. Exit Date Filter
      let exitDateVal = "";
      if ((emp as any).exitDate) {
        exitDateVal = (emp as any).exitDate;
      } else if (emp.customFields && Array.isArray(emp.customFields)) {
        const exitField = emp.customFields.find(f => 
          f.name.toLowerCase().includes("exit") || 
          f.name.toLowerCase().includes("resignation") || 
          f.name.toLowerCase().includes("leaving_date") ||
          f.name.toLowerCase().includes("leaving date")
        );
        if (exitField) {
          exitDateVal = exitField.value || "";
        }
      }
      if (salaryExitStartFilter) {
        if (!exitDateVal || exitDateVal < salaryExitStartFilter) {
          return false;
        }
      }
      if (salaryExitEndFilter) {
        if (!exitDateVal || exitDateVal > salaryExitEndFilter) {
          return false;
        }
      }

      // 5. Gross Salary Filter
      const gross = emp.grossSalary || 0;
      if (salaryMinSalaryFilter) {
        const minS = parseFloat(salaryMinSalaryFilter);
        if (!isNaN(minS) && gross < minS) {
          return false;
        }
      }
      if (salaryMaxSalaryFilter) {
        const maxS = parseFloat(salaryMaxSalaryFilter);
        if (!isNaN(maxS) && gross > maxS) {
          return false;
        }
      }

      // 6. Gender Filter
      if (salaryGenderFilter && salaryGenderFilter !== "All") {
        if ((emp.gender || "").toLowerCase() !== salaryGenderFilter.toLowerCase()) {
          return false;
        }
      }

      // 7. Marital Status Filter
      if (salaryMaritalFilter && salaryMaritalFilter !== "All") {
        if ((emp.maritalStatus || "").toLowerCase() !== salaryMaritalFilter.toLowerCase()) {
          return false;
        }
      }

      // 8. ESIC Coverage Filter
      if (salaryEsicFilter && salaryEsicFilter !== "All") {
        if ((emp.esic || "").toLowerCase() !== salaryEsicFilter.toLowerCase()) {
          return false;
        }
      }

      // 9. Skill Category Filter
      if (salarySkillFilters && salarySkillFilters.length > 0) {
        const empSkill = normalizeSkillCategory(emp.skillCategory).toLowerCase();
        if (!salarySkillFilters.some(f => empSkill === f.toLowerCase())) {
          return false;
        }
      }

      // 10. Job Role Filter
      if (salaryRoleFilters && salaryRoleFilters.length > 0) {
        if (!salaryRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase())) {
          return false;
        }
      }

      // 11. Payment Status Filter (month-wise ledger)
      if (salaryPaymentStatusFilter && salaryPaymentStatusFilter !== "All") {
        const paymentStatus = emp.monthlyLedger?.[selectedMonth]?.paymentStatus || "Unpaid";
        if (paymentStatus !== salaryPaymentStatusFilter) {
          return false;
        }
      }

      // 12. Quick Balances Filter
      const ledger = emp.monthlyLedger?.[selectedMonth];
      const hasAdv = ledger ? (ledger.advance > 0) : false;
      const hasPen = ledger ? (ledger.penalty > 0) : false;
      const hasPerks = ledger ? (ledger.foodPerk > 0 || ledger.accommodationPerk > 0 || ledger.conveyancePerk > 0) : false;

      if (salaryFilterType === "advances" && !hasAdv) return false;
      if (salaryFilterType === "penalties" && !hasPen) return false;
      if (salaryFilterType === "perks" && !hasPerks) return false;

      return true;
    });
  }, [
    employees,
    salarySearchQuery,
    salaryLocationFilter,
    salaryFilterType,
    selectedMonth,
    salaryJoinStartFilter,
    salaryJoinEndFilter,
    salaryExitStartFilter,
    salaryExitEndFilter,
    salaryMinSalaryFilter,
    salaryMaxSalaryFilter,
    salaryGenderFilter,
    salaryMaritalFilter,
    salaryEsicFilter,
    salarySkillFilters,
    salaryRoleFilters,
    salaryPaymentStatusFilter
  ]);

  // Sidebar navigation options mimicking OrangeHRM layout
  const sidebarItems: SidebarItemDef[] = [
    { name: "Search", icon: Search, badge: "" },
    { name: "Admin", icon: Shield, badge: "" },
    { name: "Audit Logs", icon: FileText, badge: "Audit" },
    { name: "Employees", icon: Users, badge: "Active" },
    { name: "Salary", icon: Coins, badge: "New" },
    { name: "Saved Bulk Pay", icon: Archive, badge: "" },
    { name: "Advance & Penalty", icon: Calculator, badge: "New" },
    { name: "Leave", icon: CalendarOff, badge: "" },
    { name: "Attendance", icon: Clock, badge: "" },
    { name: "Directory", icon: Contact, badge: "" },
    { name: "Birthdays", icon: Cake, badge: "Gift" },
    {
      name: "School Work",
      icon: School,
      badge: "New",
      children: [
        { name: "School Salary", tab: "School Salary" },
        { name: "Expenses", tab: "Expenses" },
      ],
    },
  ];

  // Filtered sidebar items
  const filteredSidebarItems = useMemo(() => {
    let items = sidebarItems;
    if (!sidebarSearch.trim()) {
      items = items.filter(item => item.name !== "Search");
    } else {
      items = items.filter(item => 
        item.name.toLowerCase().includes(sidebarSearch.toLowerCase())
      );
    }
    // Filter by view permissions
    return items.filter(item => {
      const key = getModuleKey(item.name);
      if (!key && item.children?.length) {
        return item.children.some((child) => !!userPermissions[getModuleKey(child.tab)]?.view);
      }
      if (!key) return true;
      return !!userPermissions[key]?.view;
    });
  }, [sidebarSearch, sidebarItems, userPermissions]);

  const activeModuleKey = getModuleKey(activeSidebarTab);
  const isModuleAccessDenied =
    isLoggedIn &&
    sessionPermissions !== null &&
    !!activeModuleKey &&
    !userPermissions[activeModuleKey]?.view;

  // Handle Employees Menu Actions which map directly to flow items
  const handlePimSubTabClick = (tabName: string) => {
    if (tabName === "Add Employee") {
      setCurrentEmployee(null);
      setIsFormOpen(true);
    } else {
      setActivePimSubTab(tabName);
    }
  };

  const handleSchoolSubTabClick = (tabName: string) => {
    if (tabName === "Add School") {
      setCurrentSchool(null);
      setIsSchoolFormOpen(true);
    } else if (tabName === "School Salary") {
      setActiveSchoolSubTab(tabName);
      setActiveSidebarTab("School Salary");
    } else {
      setActiveSchoolSubTab(tabName);
    }
  };

  const toggleSidebarGroup = (groupName: string) => {
    setExpandedSidebarGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const navigateToTab = (tabName: string) => {
    setActiveSidebarTab(tabName);
    triggerSuccess(`Switched module view to: ${tabName}`);
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  };


  return {
    isLoggedIn,
    sessionUser,
    sessionRole,
    sessionLocations,
    sessionPermissions,
    rolesList,
    isFetchingRoles,
    usernameInput,
    passwordInput,
    loginError,
    loginView,
    forgotUsername,
    forgotError,
    forgotMessage,
    issuedResetToken,
    resetTokenInput,
    resetNewPassword,
    resetConfirmPassword,
    resetError,
    resetSuccess,
    adminsList,
    inviteUsername,
    invitePassword,
    inviteRole,
    inviteLocations,
    editingAdminUsername,
    editAdminRole,
    editAdminLocations,
    editAdminDisabled,
    inviteError,
    inviteSuccess,
    isFetchingAdmins,
    roleNameInput,
    roleDescInput,
    rolePermsInput,
    roleError,
    roleSuccess,
    activePimSubTab,
    sidebarSearch,
    isSidebarCollapsed,
    isProfileOpen,
    isMobileProfileOpen,
    adminProfileInfo,
    isFetchingProfile,
    profileLoadingError,
    oldPassword,
    newPassword,
    confirmNewPassword,
    changePasswordError,
    changePasswordSuccess,
    profileEmail,
    profileEmailError,
    profileEmailSuccess,
    isSavingProfileEmail,
    rawEmployees,
    selectedIds,
    isFormOpen,
    currentEmployee,
    isLoading,
    errorMessage,
    successMessage,
    esicEligibilityLimit,
    basicSalaryPercentage,
    companyBranch,
    savedPayrollConfig,
    configHasUnsavedChanges,
    configValidationError,
    isSavingPayrollConfig,
    configSummary,
    handleSavePayrollConfig,
    handleResetPayrollConfig,
    setConfigValidationError,
    rawCustomLocations,
    locationCompliance,
    locationPtAmounts,
    isFetchingLocations,
    newLocCompliance,
    newLocPtAmount,
    customRoles,
    isFetchingJobRoles,
    auditLogsList,
    isFetchingAuditLogs,
    auditSearch,
    auditFilterAdmin,
    auditFilterAction,
    expandedLogId,
    bulkPayArchives,
    isFetchingBulkPayArchives,
    isExportingBulkPay,
    lastSavedBulkPay,
    highlightedBulkPayId,
    bulkPayArchiveYearFilter,
    editingLocIndex,
    editingLocValue,
    newLocNameInput,
    selectedLocs,
    ledgerEmployeeId,
    ledgerType,
    ledgerAmount,
    selectedMonth,
    ledgerSearchQuery,
    ledgerSelectedEmployeeIds,
    ledgerLocationFilters,
    ledgerSkillFilters,
    ledgerRoleFilters,
    isLedgerLocationDropdownOpen,
    isLedgerSkillDropdownOpen,
    isLedgerRoleDropdownOpen,
    tempLedgerEntries,
    salarySearchQuery,
    salaryLocationFilter,
    salaryFilterType,
    salaryJoinStartFilter,
    salaryJoinEndFilter,
    salaryExitStartFilter,
    salaryExitEndFilter,
    salaryMinSalaryFilter,
    salaryMaxSalaryFilter,
    salaryGenderFilter,
    salaryMaritalFilter,
    salaryEsicFilter,
    salarySkillFilters,
    salaryRoleFilters,
    salaryPaymentStatusFilter,
    isSalarySkillDropdownOpen,
    isSalaryRoleDropdownOpen,
    selectedSalaryEmployeeIds,
    birthdaySearchMonth,
    showConfetti,
    simulatedBirthdayEmpIds,
    helplines,
    isFetchingHelplines,
    newHelplineName,
    newHelplinePhone,
    newHelplineRole,
    newHelplineCategory,
    newHelplineLocation,
    helplineSearchQuery,
    helplineLocationFilter,
    attendanceDb,
    isFetchingAttendance,
    attendanceLocationFilter,
    attendanceRoleFilters,
    attendanceSkillFilters,
    isAttendanceRoleDropdownOpen,
    isAttendanceSkillDropdownOpen,
    bulkWizardRoleFilters,
    bulkWizardSkillFilters,
    isBulkWizardRoleDropdownOpen,
    isBulkWizardSkillDropdownOpen,
    confirmDialog,
    confirmAction,
    handleConfirmDialogConfirm,
    handleConfirmDialogCancel,
    attendanceSearchQuery,
    bulkStartDay,
    bulkEndDay,
    bulkStatus,
    bulkWizardStep,
    isBulkWizardOpen,
    attendanceSubView,
    bulkSelLocations,
    bulkSelEmployees,
    bulkSelMonths,
    bulkCalendarMonth,
    bulkSelDates,
    bulkConfirm1,
    bulkConfirm2,
    activeDirectorySubTab,
    directorySearch,
    directoryLocation,
    directoryGender,
    activeDialerContact,
    activeDialerStatus,
    selectedSalaryColumns,
    savedReportTemplates,
    savedSalaryTemplates,
    isFetchingTemplates,
    newReportTemplateName,
    newSalaryTemplateName,
    activeReportTemplateName,
    activeSalaryTemplateName,
    editingRoleIndex,
    editingRoleValue,
    newRoleNameInput,
    selectedRoles,
    selectedReportColumns,
    reportLocFilters,
    reportJoinStartFilter,
    reportJoinEndFilter,
    reportExitStartFilter,
    reportExitEndFilter,
    reportMinSalaryFilter,
    reportMaxSalaryFilter,
    reportGenderFilter,
    reportMaritalFilter,
    reportEsicFilter,
    reportEmploymentFilter,
    reportSkillFilters,
    reportRoleFilters,
    isReportLocDropdownOpen,
    isSkillDropdownOpen,
    isRoleDropdownOpen,
    reportSearchQuery,
    selectedReportEmployeeIds,
    applySessionFromAuthMe,
    fetchRoles,
    persistLocationPtAmounts,
    updateLocationPtAmount,
    updateLocationCompliance,
    fetchLocations,
    fetchJobRoles,
    fetchBulkPayArchives,
    handleDownloadBulkPayArchive,
    handleDeleteBulkPayArchive,
    fetchAuditLogs,
    handleFlushAuditLogs,
    handleExportAuditPDF,
    handleExportAuditExcel,
    handleAddLocationFromConfig,
    handleEditLocationFromConfig,
    fetchHelplines,
    handleAddHelpline,
    handleDeleteHelpline,
    fetchAttendanceForMonth,
    getDaysInSelectedMonth,
    handleCellAttendanceChange,
    handleApplyBulkAttendance,
    handleApplyBulkWizardAttendance,
    downloadAttendanceExcel,
    downloadAttendancePDF,
    normalizeTemplates,
    fetchExportTemplates,
    handleSaveReportTemplate,
    handleLoadReportTemplate,
    handleDeleteReportTemplate,
    handleSaveSalaryTemplate,
    handleLoadSalaryTemplate,
    handleDeleteSalaryTemplate,
    handleDeleteLocations,
    handleAddRoleFromConfig,
    handleEditRoleFromConfig,
    handleDeleteRoles,
    handleSaveBatchLedgerRecords,
    handleSaveLedgerRecord,
    handleClearLedgerValue,
    renderClearButtonOrConfirm,
    handleUpdatePerkValue,
    handleUpdatePaymentStatus,
    handleBulkUpdatePaymentStatus,
    handleCallInitiate,
    downloadReportsCSV,
    downloadReportsExcel,
    downloadReportsPDF,
    downloadSalaryExcel,
    downloadSalaryPDF,
    fetchEmployees,
    fetchAdmins,
    fetchAdminProfile,
    handlePasswordChangeSubmit,
    handleProfileEmailSave,
    triggerSuccess,
    handleLoginSubmit,
    handleForgotPasswordSubmit,
    handleResetPasswordSubmit,
    openForgotPassword,
    backToSignIn,
    handleInviteAdminSubmit,
    handleUpdateAdminSubmit,
    handleLogout,
    handleSaveRoleSubmit,
    handleDeleteRole,
    handleSaveEmployee,
    handleMarkEmployeeExit,
    handleBulkMarkExit,
    handleBulkImport,
    handleDeleteEmployee,
    handleBulkDelete,
    bulkEditDrafts,
    setBulkEditDrafts,
    employeeChangeRequests,
    pendingChangeCount,
    isFetchingChangeRequests,
    isSubmittingBulkEdit,
    fetchEmployeeChangeRequests,
    fetchPendingChangeCount,
    handleBulkEditDraftChange,
    handleBulkEditDraftChangeMany,
    handleBulkEditCustomFieldChange,
    handleBulkEditCustomFieldChangeMany,
    handleDiscardBulkEditDrafts,
    handleApplyBulkEmployeeChanges,
    handleApproveEmployeeChanges,
    handleRejectEmployeeChanges,
    buildAxisBulkPayItems,
    handleExportAxisBulkPay,
    handleExportSelected,
    handlePimSubTabClick,
    navigateToTab,
    toggleSidebarGroup,
    expandedSidebarGroups,
    isSchoolFormOpen,
    setIsSchoolFormOpen,
    currentSchool,
    setCurrentSchool,
    handleSaveSchoolWork,
    activeSchoolSubTab,
    setActiveSchoolSubTab,
    showFlushAuditModal,
    closeFlushAuditModal,
    flushAuditPassword,
    setFlushAuditPassword,
    flushAuditError,
    isFlushingAuditLogs,
    bulkPayPreview,
    setBulkPayPreview,
    registryLocations,
    registeredJobRoles,
    handleSchoolSubTabClick,
    reportLocationExportLabel,
    setNewPassword,
    openFlushAuditModal,
    handleViewBulkPayArchive,
    birthdayTodayList,
    birthdayMonthList,
    birthdayTodayLabel,
    isFetchingBirthdays,
    resolveEmployeePhone,
    isSchoolLoading,
    schoolDashboardStats,
    handleBulkSchoolImport,
    existingSchoolUdiseCodes,
    rawSchoolWorks,
    selectedSchoolIds,
    setSelectedSchoolIds,
    handleDeleteSchoolWork,
    handleBulkDeleteSchools,
    handleExportSchoolsSelected,
    handleExportSchoolExpenseSalary,
    handleDistributeBlockExpense,
    PERMISSION_MODULES,
    sidebarItems,
    filteredSidebarItems,
    activeModuleKey,
    isModuleAccessDenied,
    SALARY_HEADERS,
    userPermissions,
    employees,
    customLocations,
    bulkPayArchiveYears,
    filteredBulkPayArchives,
    filteredAuditLogs,
    activeMonthName,
    activeCalendarYear,
    activeFYRange,
    MONTHS_LIST,
    ledgerUniqueLocations,
    ledgerUniqueSkills,
    ledgerUniqueRoles,
    filteredReportEmployees,
    reportOverviewStats,
    reportActiveFilterCount,
    clearReportFilters,
    dashboardStats,
    existingCodes,
    salaryUniqueLocations,
    filteredSalaryEmployees,
    profileDropdownRef,
    mobileProfileDropdownRef,
    activeSidebarTab,
    setActiveSidebarTab,
    setIsLoggedIn,
    setSessionUser,
    setSessionRole,
    setSessionLocations,
    setSessionPermissions,
    setRolesList,
    setIsFetchingRoles,
    setUsernameInput,
    setPasswordInput,
    setLoginError,
    setLoginView,
    setForgotUsername,
    setForgotError,
    setForgotMessage,
    setIssuedResetToken,
    setResetTokenInput,
    setResetNewPassword,
    setResetConfirmPassword,
    setResetError,
    setResetSuccess,
    setAdminsList,
    setInviteUsername,
    setInvitePassword,
    setInviteRole,
    setInviteLocations,
    setEditingAdminUsername,
    setEditAdminRole,
    setEditAdminLocations,
    setEditAdminDisabled,
    setInviteError,
    setInviteSuccess,
    setIsFetchingAdmins,
    setRoleNameInput,
    setRoleDescInput,
    setRolePermsInput,
    setRoleError,
    setRoleSuccess,
    setActivePimSubTab,
    setSidebarSearch,
    setIsSidebarCollapsed,
    setIsProfileOpen,
    setIsMobileProfileOpen,
    setAdminProfileInfo,
    setIsFetchingProfile,
    setProfileLoadingError,
    setOldPassword,
    setConfirmNewPassword,
    setChangePasswordError,
    setChangePasswordSuccess,
    setProfileEmail,
    setProfileEmailError,
    setProfileEmailSuccess,
    setRawEmployees,
    setSelectedIds,
    setIsFormOpen,
    setCurrentEmployee,
    setIsLoading,
    setErrorMessage,
    setSuccessMessage,
    setEsicEligibilityLimit,
    setBasicSalaryPercentage,
    setCompanyBranch,
    setRawCustomLocations,
    setLocationCompliance,
    setLocationPtAmounts,
    setIsFetchingLocations,
    setNewLocCompliance,
    setNewLocPtAmount,
    setCustomRoles,
    setIsFetchingJobRoles,
    setAuditLogsList,
    setIsFetchingAuditLogs,
    setAuditSearch,
    setAuditFilterAdmin,
    setAuditFilterAction,
    setExpandedLogId,
    setBulkPayArchives,
    setIsFetchingBulkPayArchives,
    setIsExportingBulkPay,
    setLastSavedBulkPay,
    setHighlightedBulkPayId,
    setBulkPayArchiveYearFilter,
    setEditingLocIndex,
    setEditingLocValue,
    setNewLocNameInput,
    setSelectedLocs,
    setLedgerEmployeeId,
    setLedgerType,
    setLedgerAmount,
    setSelectedMonth,
    setLedgerSearchQuery,
    setLedgerSelectedEmployeeIds,
    setLedgerLocationFilters,
    setLedgerSkillFilters,
    setLedgerRoleFilters,
    setIsLedgerLocationDropdownOpen,
    setIsLedgerSkillDropdownOpen,
    setIsLedgerRoleDropdownOpen,
    setTempLedgerEntries,
    setSalarySearchQuery,
    setSalaryLocationFilter,
    setSalaryFilterType,
    setSalaryJoinStartFilter,
    setSalaryJoinEndFilter,
    setSalaryExitStartFilter,
    setSalaryExitEndFilter,
    setSalaryMinSalaryFilter,
    setSalaryMaxSalaryFilter,
    setSalaryGenderFilter,
    setSalaryMaritalFilter,
    setSalaryEsicFilter,
    setSalarySkillFilters,
    setSalaryRoleFilters,
    setSalaryPaymentStatusFilter,
    setIsSalarySkillDropdownOpen,
    setIsSalaryRoleDropdownOpen,
    setSelectedSalaryEmployeeIds,
    setBirthdaySearchMonth,
    setShowConfetti,
    setSimulatedBirthdayEmpIds,
    setHelplines,
    setIsFetchingHelplines,
    setNewHelplineName,
    setNewHelplinePhone,
    setNewHelplineRole,
    setNewHelplineCategory,
    setNewHelplineLocation,
    setHelplineSearchQuery,
    setHelplineLocationFilter,
    setAttendanceDb,
    setIsFetchingAttendance,
    setAttendanceLocationFilter,
    setAttendanceRoleFilters,
    setAttendanceSkillFilters,
    setIsAttendanceRoleDropdownOpen,
    setIsAttendanceSkillDropdownOpen,
    setBulkWizardRoleFilters,
    setBulkWizardSkillFilters,
    setIsBulkWizardRoleDropdownOpen,
    setIsBulkWizardSkillDropdownOpen,
    setAttendanceSearchQuery,
    setBulkStartDay,
    setBulkEndDay,
    setBulkStatus,
    setBulkWizardStep,
    setIsBulkWizardOpen,
    setAttendanceSubView,
    setBulkSelLocations,
    setBulkSelEmployees,
    setBulkSelMonths,
    setBulkCalendarMonth,
    setBulkSelDates,
    setBulkConfirm1,
    setBulkConfirm2,
    setActiveDirectorySubTab,
    setDirectorySearch,
    setDirectoryLocation,
    setDirectoryGender,
    setActiveDialerContact,
    setActiveDialerStatus,
    setSelectedSalaryColumns,
    setSavedReportTemplates,
    setSavedSalaryTemplates,
    setIsFetchingTemplates,
    setNewReportTemplateName,
    setNewSalaryTemplateName,
    setActiveReportTemplateName,
    setActiveSalaryTemplateName,
    setEditingRoleIndex,
    setEditingRoleValue,
    setNewRoleNameInput,
    setSelectedRoles,
    setSelectedReportColumns,
    setReportLocFilters,
    setReportJoinStartFilter,
    setReportJoinEndFilter,
    setReportExitStartFilter,
    setReportExitEndFilter,
    setReportMinSalaryFilter,
    setReportMaxSalaryFilter,
    setReportGenderFilter,
    setReportMaritalFilter,
    setReportEsicFilter,
    setReportEmploymentFilter,
    setReportSkillFilters,
    setReportRoleFilters,
    setIsReportLocDropdownOpen,
    setIsSkillDropdownOpen,
    setIsRoleDropdownOpen,
    setReportSearchQuery,
    setSelectedReportEmployeeIds,
    navigate,
    location,
  };
}
