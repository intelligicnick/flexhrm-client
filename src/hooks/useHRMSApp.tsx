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
  Gavel,
  Landmark,
} from "lucide-react";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Employee, EmployeeChangeRequest, EXCEL_ROW_HEADERS, SchoolWork, SchoolPartner, SchoolSupervisor, SchoolVisit, SupervisorRequest, CommitmentDiary, Tender, CreateTenderInput, Contract, CreateContractInput, Renewal, CreateRenewalInput, BgDdRecord, CreateBgDdInput, AppNotification, SchoolMonthlyBilling, SchoolDistrict, SchoolBlock, SCHOOL_EXCEL_ROW_HEADERS } from "../types";
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
  calculatePfAmounts,
  calculateProfessionalTax,
  isPfEsicCompliant,
  quoteCSVValue,
  downloadAxisBulkPayXls,
  downloadSchoolAxisBulkPayXls,
  saveAxisBulkPayArchive,
  saveSchoolAxisBulkPayArchive,
  getAxisDebitAccountNo,
  buildAxisBulkPayFilename,
  buildSchoolAxisBulkPayFilename,
  parseMonthYear,
  parseBulkPayXlsWorkbook,
  getBulkPayPreviewHeaderRowCount,
  type BulkPayPartnerSheetInput,
  type AxisBulkPayRowInput,
} from "../utils";
import { formatAuditLogDetails } from "../utils/formatAuditLogDetails";
import { expenseRecordTypeToForm, getPartnerPerToiletPay, getSchoolHeaderValue, computePartnerMonthlyPay } from "../lib/school-work-helpers";
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
import {
  parseNonNegativeNumber,
  validateNonNegativeNumberField,
} from "../lib/number-validation";
import { isEmployeeExitedGeneral, isEmployeeExitedOnDayStatic, isEmployeeExitedForMonth } from "../lib/employee-helpers";
import { getSalaryColumnValue, resolveEmployeeDailyWage } from "../lib/salary-columns";
import {
  appendLedgerItem,
  clearItemsOfType,
  defaultTempLedgerEntry,
  getMonthLedger,
  monthLedgerToPayload,
  removeLedgerItem,
  TempLedgerEntry,
  todayDateInputValue,
  LedgerItemType,
} from "../lib/ledger-helpers";
import {
  countMonthAttendance,
  getEffectiveAttendanceStatus,
  isWeeklyOffDay,
  type AttendanceRecordFilter,
} from "../lib/attendance-helpers";
import {
  pickLatestMonthKey,
  type ExitEligibleEmployee,
} from "../lib/exit-eligibility-helpers";
import { getModuleKey, PERMISSION_MODULES, createEmptyRolePermissions, DEFAULT_NEW_ROLE_PERMISSIONS, SidebarItemDef, isAdminModuleTab } from "../lib/permissions";
import {
  applySalaryUiRestrictions,
  createEmptyRoleUiRestrictions,
  getModuleUiRestrictions,
  OBSERVER_SALARY_PRESET,
  SALARY_COLUMNS,
  SALARY_FILTER_DEFINITIONS,
  type RoleUiRestrictions,
} from "../lib/role-ui-restrictions";
import { tabToPath, pathToTab, DEFAULT_PATH, isSchoolWorkTab, isBidsTab, isRenewalsTab, isBgDdTab } from "../routes";
import { useNotificationPoller } from "./useNotificationPoller";
import { useAuth } from "./useAuth";
import { FieldTeamView, getAdminNotificationTarget } from "../lib/notification-navigation";
import PercentIcon from "../components/ui/PercentIcon";
import DialerOverlay from "../components/ui/DialerOverlay";
import DirectoryContactCard from "../components/DirectoryContactCard";
import { formatPhoneDisplay, phoneToDialString } from "../lib/phone-helpers";
import ConfettiRain from "../components/ui/ConfettiRain";
import { TOAST_DURATION_MS } from "../components/ui/AppToast";
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
  const auth = useAuth();
  const {
    authBootstrapping,
    isLoggedIn,
    setIsLoggedIn,
    sessionUser,
    setSessionUser,
    sessionRole,
    setSessionRole,
    sessionLocations,
    setSessionLocations,
    sessionPermissions,
    setSessionPermissions,
    sessionUiRestrictions,
    setSessionUiRestrictions,
    applySessionFromAuthMe,
    usernameInput,
    setUsernameInput,
    passwordInput,
    setPasswordInput,
    captchaInput,
    setCaptchaInput,
    captchaRefreshKey,
    loginError,
    setLoginError,
    loginView,
    setLoginView,
    forgotUsername,
    setForgotUsername,
    forgotError,
    setForgotError,
    forgotMessage,
    setForgotMessage,
    issuedResetToken,
    setIssuedResetToken,
    resetTokenInput,
    setResetTokenInput,
    resetNewPassword,
    setResetNewPassword,
    resetConfirmPassword,
    setResetConfirmPassword,
    resetError,
    setResetError,
    resetSuccess,
    setResetSuccess,
    isLoggingIn,
    isSendingResetCode,
    setIsSendingResetCode,
    isUpdatingPassword,
    setIsUpdatingPassword,
    handleLoginSubmit: authHandleLoginSubmit,
    handleLogout: authHandleLogout,
  } = auth;

  // Custom Roles & Permissions States
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [isFetchingRoles, setIsFetchingRoles] = useState(false);

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
  const [editAdminNewPassword, setEditAdminNewPassword] = useState("");
  const [editAdminPasswordError, setEditAdminPasswordError] = useState<string | null>(null);
  const [editAdminPasswordSuccess, setEditAdminPasswordSuccess] = useState<string | null>(null);
  const [isResettingAdminPassword, setIsResettingAdminPassword] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isFetchingAdmins, setIsFetchingAdmins] = useState(false);

  // Custom Roles Editor States
  const [roleNameInput, setRoleNameInput] = useState("");
  const [roleDescInput, setRoleDescInput] = useState("");
  const [rolePermsInput, setRolePermsInput] = useState<Record<string, { view: boolean; edit: boolean }>>(
    () => ({ ...DEFAULT_NEW_ROLE_PERMISSIONS }),
  );
  const [roleUiInput, setRoleUiInput] = useState<RoleUiRestrictions>(() => createEmptyRoleUiRestrictions());
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null);

  const PERMISSION_MODULES = ["employees", "schoolWork", "bids", "renewals", "salary", "ledger", "attendance", "leave", "birthdays", "directory", "admin"] as const;

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

  const userUiRestrictions = useMemo(() => {
    const isSuperAdmin =
      String(sessionRole || "").toLowerCase() === "admin" ||
      String(sessionUser || "").toLowerCase() === "admin";
    if (isSuperAdmin) return {} as RoleUiRestrictions;

    if (sessionUiRestrictions) return sessionUiRestrictions;

    const matchedRole = rolesList.find(
      (r) => String(r.name || "").toLowerCase() === String(sessionRole || "").toLowerCase(),
    );
    return (matchedRole?.uiRestrictions as RoleUiRestrictions) ?? {};
  }, [sessionRole, sessionUser, rolesList, sessionUiRestrictions]);

  const salaryUiRestrictions = useMemo(
    () => getModuleUiRestrictions(userUiRestrictions, "salary"),
    [userUiRestrictions],
  );

  const canFetchAttendanceData = useMemo(
    () =>
      !!(
        userPermissions.attendance?.view ||
        userPermissions.salary?.view ||
        userPermissions.ledger?.view
      ),
    [userPermissions],
  );

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
  const [employeeListRoleFilter, setEmployeeListRoleFilter] = useState("");
  const [employeeListStatusFilter, setEmployeeListStatusFilter] = useState<
    "active" | "exited" | "all" | "eligible_for_exit"
  >("active");
  const [expandedSidebarGroups, setExpandedSidebarGroups] = useState<Record<string, boolean>>({
    "School Work": false,
    "Bids": false,
    "Renewals": false,
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
  const [myInfoTab, setMyInfoTab] = useState<"account" | "tour">("account");
  const [roleAccessSection, setRoleAccessSection] = useState<"admins" | "roles" | "audit" | "devices">("admins");

  // School Work Registry States
  const [rawSchoolWorks, setRawSchoolWorks] = useState<SchoolWork[]>([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [isSchoolFormOpen, setIsSchoolFormOpen] = useState(false);
  const [currentSchool, setCurrentSchool] = useState<SchoolWork | null>(null);
  const [isSchoolLoading, setIsSchoolLoading] = useState(false);
  const [rawSchoolBillings, setRawSchoolBillings] = useState<SchoolMonthlyBilling[]>([]);
  const [rawSchoolVisits, setRawSchoolVisits] = useState<SchoolVisit[]>([]);
  const [rawSupervisorRequests, setRawSupervisorRequests] = useState<SupervisorRequest[]>([]);
  const [rawCommitmentDiary, setRawCommitmentDiary] = useState<CommitmentDiary[]>([]);
  const [rawTenders, setRawTenders] = useState<Tender[]>([]);
  const [rawContracts, setRawContracts] = useState<Contract[]>([]);
  const [rawRenewals, setRawRenewals] = useState<Renewal[]>([]);
  const [rawBgDdRecords, setRawBgDdRecords] = useState<BgDdRecord[]>([]);
  const [pendingSupervisorRequestCount, setPendingSupervisorRequestCount] = useState(0);
  const [adminNotifications, setAdminNotifications] = useState<AppNotification[]>([]);
  const [adminNotificationUnreadCount, setAdminNotificationUnreadCount] = useState(0);
  const [isFetchingAdminNotifications, setIsFetchingAdminNotifications] = useState(false);
  const [fieldTeamView, setFieldTeamView] = useState<FieldTeamView>("visits");
  const [tenderDeadlineFilter, setTenderDeadlineFilter] = useState<"all" | "upcoming" | "passed">("all");
  const [rawSchoolPartners, setRawSchoolPartners] = useState<SchoolPartner[]>([]);
  const [rawSchoolSupervisors, setRawSchoolSupervisors] = useState<SchoolSupervisor[]>([]);
  const [schoolDistricts, setSchoolDistricts] = useState<SchoolDistrict[]>([]);
  const [schoolBlocks, setSchoolBlocks] = useState<SchoolBlock[]>([]);
  const [isSchoolGeographyLoading, setIsSchoolGeographyLoading] = useState(false);
  const [schoolBulkEditDrafts, setSchoolBulkEditDrafts] = useState<Record<string, Partial<SchoolWork>>>({});
  const [isSubmittingSchoolBulkEdit, setIsSubmittingSchoolBulkEdit] = useState(false);
  const [partnerBulkEditDrafts, setPartnerBulkEditDrafts] = useState<Record<string, Partial<SchoolPartner>>>({});
  const [isSubmittingPartnerBulkEdit, setIsSubmittingPartnerBulkEdit] = useState(false);
  const [isSupervisorFormOpen, setIsSupervisorFormOpen] = useState(false);
  const [currentSupervisor, setCurrentSupervisor] = useState<SchoolSupervisor | null>(null);

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
  const [registeredLocations, setRegisteredLocations] = useState<string[]>([]);
  const [locationCompliance, setLocationCompliance] = useState<Record<string, boolean>>({});
  const [locationPtEnabled, setLocationPtEnabled] = useState<Record<string, boolean>>({});
  const [isFetchingLocations, setIsFetchingLocations] = useState(false);
  const [newLocCompliance, setNewLocCompliance] = useState(true);
  const [newLocPtEnabled, setNewLocPtEnabled] = useState(false);

  const updateLocationCompliance = async (loc: string, enabled: boolean) => {
    setLocationCompliance((prev) => ({ ...prev, [loc]: enabled }));
    try {
      const res = await fetch(`/api/locations/${encodeURIComponent(loc)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complianceEnabled: enabled }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to update location PF/ESIC compliance.");
      await fetchLocations();
      triggerSuccess(`PF/ESIC compliance ${enabled ? "enabled" : "disabled"} for location "${loc}"`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update location PF/ESIC compliance.");
    }
  };

  const updateLocationPtEnabled = async (loc: string, enabled: boolean) => {
    setLocationPtEnabled((prev) => ({ ...prev, [loc]: enabled }));
    try {
      const res = await fetch(`/api/locations/${encodeURIComponent(loc)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ptEnabled: enabled }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to update location PT setting.");
      await fetchLocations();
      triggerSuccess(`Professional Tax ${enabled ? "enabled" : "disabled"} for location "${loc}"`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update location PT setting.");
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

  const mergedLocationNames = useMemo(() => {
    const empLocations = rawEmployees.map((e) => e.location).filter(Boolean) as string[];
    return Array.from(new Set([...registeredLocations, ...empLocations]));
  }, [registeredLocations, rawEmployees]);

  const rawCustomLocations = mergedLocationNames;

  const setRawCustomLocations = useCallback(() => {
    /* Location names are derived from the registry and location API. */
  }, []);

  const customLocations = useMemo(() => {
    const isLocationRestricted = isLoggedIn && sessionUser !== "admin" && Array.isArray(sessionLocations) && sessionLocations.length > 0;
    if (isLocationRestricted) {
      return mergedLocationNames.filter((loc) =>
        sessionLocations.some((sl) => sl.toLowerCase() === loc.toLowerCase())
      );
    }
    return mergedLocationNames;
  }, [mergedLocationNames, isLoggedIn, sessionUser, sessionLocations]);

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
      setRegisteredLocations(apiLocations);

      const complianceMap: Record<string, boolean> = {};
      const ptEnabledMap: Record<string, boolean> = {};
      locationRecords.forEach((loc: any) => {
        if (!loc.name) return;
        complianceMap[loc.name] = !!loc.complianceEnabled;
        ptEnabledMap[loc.name] =
          loc.ptEnabled !== undefined
            ? !!loc.ptEnabled
            : Number(loc.ptAmount || 0) > 0;
      });
      setLocationCompliance(complianceMap);
      setLocationPtEnabled(ptEnabledMap);
      if (typeof window !== "undefined") {
        localStorage.setItem("hrms_location_compliance", JSON.stringify(complianceMap));
        localStorage.setItem("hrms_location_pt_enabled", JSON.stringify(ptEnabledMap));
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Could not load locations.");
    } finally {
      setIsFetchingLocations(false);
    }
  }, []);

  // Custom roles list with sync and edit capabilities
  const [registeredJobRoles, setRegisteredJobRoles] = useState<string[]>([]);
  const [isFetchingJobRoles, setIsFetchingJobRoles] = useState(false);

  const customRoles = useMemo(() => {
    const empRoles = rawEmployees.map((e) => e.role).filter(Boolean) as string[];
    return Array.from(new Set([...registeredJobRoles, ...empRoles]));
  }, [registeredJobRoles, rawEmployees]);

  const setCustomRoles = useCallback(() => {
    /* Roles are derived from the registry and job-role API. */
  }, []);

  const fetchJobRoles = useCallback(async () => {
    setIsFetchingJobRoles(true);
    try {
      const res = await fetch("/api/job-roles");
      if (!res.ok) throw await parseApiError(res, "Failed to fetch job roles.");
      const data = await res.json();
      const apiRoles = Array.isArray(data) ? data.map((role: any) => role.name).filter(Boolean) : [];
      setRegisteredJobRoles(apiRoles);
    } catch (err: any) {
      setErrorMessage(err.message || "Could not load job roles.");
    } finally {
      setIsFetchingJobRoles(false);
    }
  }, []);

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

  const [schoolBulkPayArchives, setSchoolBulkPayArchives] = useState<any[]>([]);
  const [isFetchingSchoolBulkPayArchives, setIsFetchingSchoolBulkPayArchives] = useState(false);
  const [isExportingSchoolBulkPay, setIsExportingSchoolBulkPay] = useState(false);
  const [lastSavedSchoolBulkPay, setLastSavedSchoolBulkPay] = useState<any | null>(null);
  const [highlightedSchoolBulkPayId, setHighlightedSchoolBulkPayId] = useState<string | null>(null);
  const [schoolBulkPayArchiveYearFilter, setSchoolBulkPayArchiveYearFilter] = useState("");
  const [schoolBulkPayPreview, setSchoolBulkPayPreview] = useState<{
    id: string;
    filename: string;
    sheetNames: string[];
    activeSheet: string;
    sheets: Record<string, string[][]>;
    loading: boolean;
  } | null>(null);
  const schoolBulkPayJustSavedRef = useRef(false);

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

  const updateSchoolBulkPayDownloadCount = (id: string, downloadCount: number) => {
    setSchoolBulkPayArchives((prev) =>
      prev.map((item: any) =>
        item.id === id ? { ...item, downloadCount } : item
      )
    );
    setLastSavedSchoolBulkPay((prev: any) =>
      prev?.id === id ? { ...prev, downloadCount } : prev
    );
  };

  const fetchSchoolBulkPayArchives = async (yearFilter?: string) => {
    setIsFetchingSchoolBulkPayArchives(true);
    try {
      const params = new URLSearchParams();
      const year = yearFilter ?? schoolBulkPayArchiveYearFilter;
      if (year) params.set("year", year);
      const query = params.toString();
      const res = await fetch(`/api/school-bulk-pay-exports${query ? `?${query}` : ""}`);
      if (!res.ok) throw new Error("Failed to load saved school bulk pay files.");
      const data = await res.json();
      setSchoolBulkPayArchives(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("School bulk pay archive fetch error:", err);
    } finally {
      setIsFetchingSchoolBulkPayArchives(false);
    }
  };

  const handleDownloadSchoolBulkPayArchive = async (id: string, filename: string) => {
    try {
      const res = await fetch(`/api/school-bulk-pay-exports/${id}/download`);
      if (!res.ok) throw await parseApiError(res, "Could not download archived school bulk pay file.");
      const downloadCountHeader = res.headers.get("X-Download-Count");
      if (downloadCountHeader) {
        updateSchoolBulkPayDownloadCount(id, Number(downloadCountHeader));
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
      setErrorMessage(err.message || "Could not download archived school bulk pay file.");
    }
  };

  const handleViewSchoolBulkPayArchive = async (id: string, filename: string) => {
    setSchoolBulkPayPreview({
      id,
      filename,
      sheetNames: [],
      activeSheet: "",
      sheets: {},
      loading: true,
    });
    try {
      const res = await fetch(`/api/school-bulk-pay-exports/${id}/preview`);
      if (!res.ok) throw await parseApiError(res, "Could not load file for preview.");
      const buffer = await res.arrayBuffer();
      const workbook = parseBulkPayXlsWorkbook(buffer);
      setSchoolBulkPayPreview({
        id,
        filename,
        sheetNames: workbook.sheetNames,
        activeSheet: workbook.defaultSheet,
        sheets: workbook.sheets,
        loading: false,
      });
    } catch (err: any) {
      setSchoolBulkPayPreview(null);
      setErrorMessage(err.message || "Could not preview archived school bulk pay file.");
    }
  };

  const handleDeleteSchoolBulkPayArchive = async (id: string) => {
    const confirmed = await confirmAction({
      title: "Delete archived file",
      message: "Delete this archived school bulk pay file from the server? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/school-bulk-pay-exports/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      if (lastSavedSchoolBulkPay?.id === id) setLastSavedSchoolBulkPay(null);
      if (highlightedSchoolBulkPayId === id) setHighlightedSchoolBulkPayId(null);
      await fetchSchoolBulkPayArchives();
      triggerSuccess("Archived school bulk pay file removed.");
    } catch (err: any) {
      setErrorMessage(err.message || "Could not delete archived school bulk pay file.");
    }
  };

  const schoolBulkPayArchiveYears = useMemo(() => {
    const years = new Set<string>();
    schoolBulkPayArchives.forEach((item: any) => {
      if (item.year) {
        years.add(String(item.year));
      } else if (item.month) {
        const parsed = parseMonthYear(item.month);
        if (parsed.year) years.add(parsed.year);
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [schoolBulkPayArchives]);

  const filteredSchoolBulkPayArchives = useMemo(() => {
    let list = schoolBulkPayArchives;
    if (schoolBulkPayArchiveYearFilter) {
      list = list.filter((item: any) => {
        const year = item.year || parseMonthYear(item.month).year;
        return year === schoolBulkPayArchiveYearFilter;
      });
    }
    if (lastSavedSchoolBulkPay?.id && !list.some((item: any) => item.id === lastSavedSchoolBulkPay.id)) {
      list = [lastSavedSchoolBulkPay, ...list];
    }
    return list;
  }, [schoolBulkPayArchives, schoolBulkPayArchiveYearFilter, lastSavedSchoolBulkPay]);

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

  // Fetch security audit logs when Role & Access → Activity Log is open
  useEffect(() => {
    if (isLoggedIn && isAdminModuleTab(activeSidebarTab) && roleAccessSection === "audit") {
      fetchAuditLogs();
    }
  }, [isLoggedIn, activeSidebarTab, roleAccessSection]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Saved Bulk Pay" && userPermissions.salary?.view) {
      if (bulkPayJustSavedRef.current) {
        bulkPayJustSavedRef.current = false;
        return;
      }
      fetchBulkPayArchives();
    }
  }, [isLoggedIn, activeSidebarTab, userPermissions.salary?.view]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Saved School Bulk Pay" && userPermissions.schoolWork?.view) {
      if (schoolBulkPayJustSavedRef.current) {
        schoolBulkPayJustSavedRef.current = false;
        return;
      }
      fetchSchoolBulkPayArchives();
    }
  }, [isLoggedIn, activeSidebarTab, userPermissions.schoolWork?.view]);

  // Handler to add a new custom location from the configuration tab
  const handleAddLocationFromConfig = async (
    locName: string,
    complianceVal: boolean = true,
    ptEnabledVal: boolean = false,
  ) => {
    const cleanName = locName.trim();
    if (!cleanName) return;
    
    if (mergedLocationNames.some(l => l.toLowerCase() === cleanName.toLowerCase())) {
      setErrorMessage(`Location "${cleanName}" already exists.`);
      return;
    }

    try {
      setErrorMessage(null);
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          complianceEnabled: complianceVal,
          ptEnabled: ptEnabledVal,
        }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to register location.");
      await fetchLocations();
      setNewLocNameInput("");
      setNewLocCompliance(true);
      setNewLocPtEnabled(false);
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
      const updatedPtEnabled = { ...locationPtEnabled };
      if (updatedCompliance[cleanOld] !== undefined) {
        updatedCompliance[cleanNew] = updatedCompliance[cleanOld];
        delete updatedCompliance[cleanOld];
        setLocationCompliance(updatedCompliance);
      }
      if (updatedPtEnabled[cleanOld] !== undefined) {
        updatedPtEnabled[cleanNew] = updatedPtEnabled[cleanOld];
        delete updatedPtEnabled[cleanOld];
        setLocationPtEnabled(updatedPtEnabled);
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

  const [tempLedgerEntries, setTempLedgerEntries] = useState<Record<string, TempLedgerEntry>>({});

  useEffect(() => {
    setTempLedgerEntries((prev) => {
      const updated = { ...prev };
      ledgerSelectedEmployeeIds.forEach((empId) => {
        if (!updated[empId]) {
          updated[empId] = defaultTempLedgerEntry();
        }
      });
      return updated;
    });
  }, [ledgerSelectedEmployeeIds]);

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
  const [salaryMinDailyWageFilter, setSalaryMinDailyWageFilter] = useState<string>("");
  const [salaryMaxDailyWageFilter, setSalaryMaxDailyWageFilter] = useState<string>("");
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
  const [exitEligibleEmployees, setExitEligibleEmployees] = useState<ExitEligibleEmployee[]>([]);
  const exitEligibilityTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const employeesFetchInFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  const [exitEligibilityCheckedMonths, setExitEligibilityCheckedMonths] = useState<string[]>([]);
  const [exitedEmployeesCount, setExitedEmployeesCount] = useState(0);
  const [isFetchingExitEligibility, setIsFetchingExitEligibility] = useState(false);
  const [showExitEligibleModal, setShowExitEligibleModal] = useState(false);

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
  const [attendanceRecordFilter, setAttendanceRecordFilter] = useState<AttendanceRecordFilter>("all");
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
    if (!monthKey || !canFetchAttendanceData) return;
    setIsFetchingAttendance(true);
    try {
      const res = await fetch(`/api/attendance?monthKey=${encodeURIComponent(monthKey)}`);
      if (!res.ok) throw await parseApiError(res, "Failed to fetch attendance.");
      const data = await res.json();
      setAttendanceDb((prev) => ({ ...prev, [monthKey]: data || {} }));
    } catch (err: any) {
      console.error("Attendance fetch failed:", err.message);
    } finally {
      setIsFetchingAttendance(false);
    }
  }, [canFetchAttendanceData]);

  const fetchExitEligibility = useCallback(
    async (referenceMonth?: string, showModalIfEligible = false) => {
      const month = referenceMonth || selectedMonth;
      if (!month || !isLoggedIn) return;
      setIsFetchingExitEligibility(true);
      try {
        const res = await fetch(
          `/api/attendance/exit-eligibility?referenceMonth=${encodeURIComponent(month)}&months=3`,
        );
        if (!res.ok) throw await parseApiError(res, "Failed to fetch exit eligibility.");
        const data = await res.json();
        setExitEligibleEmployees(data.eligible || []);
        setExitEligibilityCheckedMonths(data.checkedMonths || []);
        setExitedEmployeesCount(data.exitedCount ?? 0);
        if (showModalIfEligible && (data.eligible?.length ?? 0) > 0) {
          setShowExitEligibleModal(true);
        }
      } catch (err: any) {
        console.error("Exit eligibility fetch failed:", err.message);
      } finally {
        setIsFetchingExitEligibility(false);
      }
    },
    [selectedMonth, isLoggedIn],
  );

  const scheduleFetchExitEligibility = useCallback(
    (referenceMonth?: string, showModalIfEligible = false, delayMs = 1200) => {
      if (exitEligibilityTimerRef.current) {
        window.clearTimeout(exitEligibilityTimerRef.current);
      }
      exitEligibilityTimerRef.current = window.setTimeout(() => {
        exitEligibilityTimerRef.current = null;
        void fetchExitEligibility(referenceMonth, showModalIfEligible);
      }, delayMs);
    },
    [fetchExitEligibility],
  );

  const shouldTrackExitEligibility = useMemo(() => {
    return (
      !!userPermissions.attendance?.view &&
      (activeSidebarTab === "Attendance" ||
        activeSidebarTab === "Employees" ||
        activeSidebarTab === "Dashboard")
    );
  }, [userPermissions.attendance?.view, activeSidebarTab]);

  useEffect(() => {
    if (selectedMonth) {
      localStorage.setItem("hrms_selected_month", selectedMonth);
      setBulkSelMonths([selectedMonth]);
      setBulkCalendarMonth(selectedMonth);
      if (isLoggedIn && canFetchAttendanceData) {
        fetchAttendanceForMonth(selectedMonth);
        if (shouldTrackExitEligibility) {
          scheduleFetchExitEligibility(selectedMonth, false);
        }
      }
    }
  }, [selectedMonth, isLoggedIn, canFetchAttendanceData, shouldTrackExitEligibility, fetchAttendanceForMonth, scheduleFetchExitEligibility]);

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
      scheduleFetchExitEligibility(selectedMonth, false);
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
      Array.from({ length: end - start + 1 }, (_, i) => {
        const day = start + i;
        if (
          isEmployeeExitedOnDayStatic(emp, selectedMonth, day) ||
          isWeeklyOffDay(emp.workingDaysType, selectedMonth, day)
        ) {
          return null;
        }
        return {
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          location: emp.location,
          monthKey: selectedMonth,
          day,
          status: bulkStatus,
        };
      }).filter((entry): entry is NonNullable<typeof entry> => entry !== null),
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
            if (
              isEmployeeExitedOnDayStatic(emp, selectedMonth, d) ||
              isWeeklyOffDay(emp.workingDaysType, selectedMonth, d)
            ) {
              continue;
            }
            empData[d] = bulkStatus;
          }
          updatedMonth[emp.id] = empData;
        });

        return {
          ...prev,
          [selectedMonth]: updatedMonth
        };
      });

      triggerSuccess("Attendance marked successfully.");
      scheduleFetchExitEligibility(selectedMonth, true, TOAST_DURATION_MS);
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
          if (
            emp &&
            (isEmployeeExitedOnDayStatic(emp, monthKey, day) ||
              isWeeklyOffDay(emp.workingDaysType, monthKey, day))
          ) {
            return null;
          }
          return {
            employeeId: empId,
            employeeCode: emp?.employeeCode,
            location: emp?.location,
            monthKey,
            day,
            status: sortedDates.includes(day) ? "P" : "A",
          };
        }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
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
            const emp = employees.find(e => e.id === empId);
            const empData = { ...(monthData[empId] || {}) };
            for (let d = 1; d <= daysInMonth; d++) {
              if (
                emp &&
                (isEmployeeExitedOnDayStatic(emp, m, d) ||
                  isWeeklyOffDay(emp.workingDaysType, m, d))
              ) {
                continue;
              }
              if (sortedDates.includes(d)) {
                empData[d] = "P";
              } else {
                empData[d] = "A";
              }
            }
            monthData[empId] = empData;
          });
          nextDb[m] = monthData;
        });
      
        return nextDb;
      });

      triggerSuccess("Attendance marked successfully.");

      // Reset wizard
      setBulkWizardStep("employees");
      setBulkSelEmployees([]);
      setBulkSelDates([]);
      setBulkConfirm1(false);
      setBulkConfirm2(false);
      setIsBulkWizardOpen(false);
      setAttendanceSubView("grid"); // Go back to daily grid sheet screen!
      const refMonth = pickLatestMonthKey(bulkSelMonths.length > 0 ? bulkSelMonths : [selectedMonth]);
      scheduleFetchExitEligibility(refMonth, true, TOAST_DURATION_MS);
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

      const { presents, absents } = countMonthAttendance(
        empData,
        daysInMonth,
        (day) => isEmployeeExitedOnDayStatic(emp, selectedMonth, day),
        { workingDaysType: emp.workingDaysType, monthStr: selectedMonth },
      );

      const daysCells = Array.from({ length: daysInMonth }, (_, i) => {
        const dayNum = i + 1;
        const isExited = isEmployeeExitedOnDayStatic(emp, selectedMonth, dayNum);
        if (isExited) return "—";
        const status = empData[dayNum] || "";
        const display = getEffectiveAttendanceStatus(emp.workingDaysType, selectedMonth, dayNum, status);
        return display || "—";
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

        const { presents, absents } = countMonthAttendance(
          empData,
          daysInMonth,
          (day) => isEmployeeExitedOnDayStatic(emp, selectedMonth, day),
        );

        const daysCells = Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const isExited = isEmployeeExitedOnDayStatic(emp, selectedMonth, dayNum);
          if (isExited) return "—";
          const status = empData[dayNum] || "";
          const display = getEffectiveAttendanceStatus(emp.workingDaysType, selectedMonth, dayNum, status);
          return display || "—";
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
    "Daily Wage",
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

  useEffect(() => {
    if (!isLoggedIn || !salaryUiRestrictions) return;
    applySalaryUiRestrictions(salaryUiRestrictions, {
      setSelectedSalaryColumns,
      setSalaryLocationFilter,
      setSalarySearchQuery,
      setSalaryFilterType,
      setSalaryJoinStartFilter,
      setSalaryJoinEndFilter,
      setSalaryExitStartFilter,
      setSalaryExitEndFilter,
      setSalaryMinSalaryFilter,
      setSalaryMaxSalaryFilter,
      setSalaryMinDailyWageFilter,
      setSalaryMaxDailyWageFilter,
      setSalaryGenderFilter,
      setSalaryMaritalFilter,
      setSalaryEsicFilter,
      setSalarySkillFilters,
      setSalaryRoleFilters,
      setSalaryPaymentStatusFilter,
    });
  }, [isLoggedIn, sessionRole, salaryUiRestrictions]);

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
        minDailyWage: salaryMinDailyWageFilter,
        maxDailyWage: salaryMaxDailyWageFilter,
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
      if (template.filters.minDailyWage !== undefined) setSalaryMinDailyWageFilter(template.filters.minDailyWage);
      if (template.filters.maxDailyWage !== undefined) setSalaryMaxDailyWageFilter(template.filters.maxDailyWage);
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
      const updatedPtEnabled = { ...locationPtEnabled };
      locsToDelete.forEach(l => {
        delete updatedCompliance[l];
        delete updatedPtEnabled[l];
        Object.keys(updatedCompliance).forEach((key) => {
          if (key.toLowerCase() === l.toLowerCase()) delete updatedCompliance[key];
        });
        Object.keys(updatedPtEnabled).forEach((key) => {
          if (key.toLowerCase() === l.toLowerCase()) delete updatedPtEnabled[key];
        });
      });
      setLocationCompliance(updatedCompliance);
      setLocationPtEnabled(updatedPtEnabled);

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

  const persistEmployeeMonthLedger = async (empId: string, monthKey: string, ledger: ReturnType<typeof getMonthLedger>) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) throw new Error("Selected employee was not found in database.");
    const updatedEmp = {
      ...emp,
      monthlyLedger: {
        ...(emp.monthlyLedger || {}),
        [monthKey]: monthLedgerToPayload(ledger),
      },
    };
    const res = await fetch(`/api/employees/${empId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedEmp),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Server rejected the update.");
    }
  };

  const handleSaveBatchLedgerRecords = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userPermissions.ledger?.edit) {
      alert("Action locked: You do not have write permissions for Ledgers.");
      return;
    }
    if (ledgerSelectedEmployeeIds.length === 0) {
      setErrorMessage("Please select at least one employee.");
      return;
    }

    const apiEntries: Array<{
      employeeId: string;
      type: LedgerItemType;
      amount: number;
      entryDate: string;
      note: string;
    }> = [];

    for (const empId of ledgerSelectedEmployeeIds) {
      const entry = tempLedgerEntries[empId] ?? defaultTempLedgerEntry();
      if (!entry.entryDate) {
        setErrorMessage("Please select an entry date for each employee.");
        return;
      }
      const note = entry.penaltyReason.trim();
      const fields: Array<[LedgerItemType, string]> = [
        ["advance", entry.advance],
        ["uniform", entry.uniform],
        ["penalty", entry.penalty],
        ["foodPerk", entry.foodPerk],
        ["accommodationPerk", entry.accommodationPerk],
        ["conveyancePerk", entry.conveyancePerk],
      ];
      for (const [type, rawAmount] of fields) {
        const amount = parseNonNegativeNumber(rawAmount, 0);
        if (amount > 0) {
          apiEntries.push({
            employeeId: empId,
            type,
            amount,
            entryDate: entry.entryDate,
            note,
          });
        }
      }
    }

    if (apiEntries.length === 0) {
      setErrorMessage("Enter at least one amount greater than zero.");
      return;
    }

    try {
      setErrorMessage(null);
      const byEmployee = new Map<string, Array<{ type: LedgerItemType; amount: number; entryDate: string; note: string }>>();
      for (const entry of apiEntries) {
        const list = byEmployee.get(entry.employeeId) ?? [];
        list.push(entry);
        byEmployee.set(entry.employeeId, list);
      }

      let savedCount = 0;
      for (const [empId, items] of byEmployee) {
        const emp = employees.find((e) => e.id === empId);
        if (!emp) continue;
        let ledger = getMonthLedger(emp, selectedMonth);
        for (const item of items) {
          ledger = appendLedgerItem(ledger, item);
        }
        await persistEmployeeMonthLedger(empId, selectedMonth, ledger);
        savedCount += items.length;
      }

      await fetchEmployees();
      setTempLedgerEntries((prev) => {
        const next = { ...prev };
        for (const empId of ledgerSelectedEmployeeIds) {
          next[empId] = defaultTempLedgerEntry();
        }
        return next;
      });
      triggerSuccess(`Saved ${savedCount} ledger entry line(s) for ${selectedMonth}.`);
    } catch (err: any) {
      setErrorMessage("Failed to save ledger entries: " + err.message);
    }
  };

  const handleDeleteLedgerItem = async (employeeId: string, itemId: string) => {
    if (!userPermissions.ledger?.edit) return;
    try {
      setErrorMessage(null);
      const emp = employees.find((e) => e.id === employeeId);
      if (!emp) throw new Error("Employee not found.");
      const ledger = removeLedgerItem(getMonthLedger(emp, selectedMonth), itemId);
      await persistEmployeeMonthLedger(employeeId, selectedMonth, ledger);
      await fetchEmployees();
    } catch (err: any) {
      setErrorMessage("Failed to delete entry: " + err.message);
    }
  };

  // Handler to record single employee advance/penalty/perks (Legacy / Fallback support)
  const handleSaveLedgerRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmpId = ledgerEmployeeId;
    const amountNum = parseNonNegativeNumber(ledgerAmount, NaN);
    
    if (!cleanEmpId) {
      setErrorMessage("Please select an employee to record transaction.");
      return;
    }
    if (!Number.isFinite(amountNum)) {
      setErrorMessage("Please enter a valid amount.");
      return;
    }

    const emp = employees.find(e => e.id === cleanEmpId);
    if (!emp) {
      setErrorMessage("Selected employee was not found in database.");
      return;
    }

    try {
      setErrorMessage(null);
      const ledger = appendLedgerItem(getMonthLedger(emp, selectedMonth), {
        type: ledgerType,
        amount: amountNum,
        entryDate: todayDateInputValue(),
        note: "",
      });
      await persistEmployeeMonthLedger(cleanEmpId, selectedMonth, ledger);

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

    const cleared = clearItemsOfType(getMonthLedger(emp, selectedMonth), type);
    const updatedEmp = {
      ...emp,
      monthlyLedger: {
        ...(emp.monthlyLedger || {}),
        [selectedMonth]: monthLedgerToPayload(cleared),
      },
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

    const numericVal = parseNonNegativeNumber(valueStr);
    const currentVal = emp.monthlyLedger?.[selectedMonth]?.[perkName] ?? emp[perkName] ?? 0;
    if (Number(currentVal) === numericVal) return; // No change

    const perkLabel =
      perkName === "foodPerk"
        ? "Food perk"
        : perkName === "accommodationPerk"
          ? "Accommodation perk"
          : "Conveyance perk";
    const perkError = validateNonNegativeNumberField(valueStr, perkLabel);
    if (perkError) {
      alert(perkError);
      return;
    }

    try {
      setErrorMessage(null);
      await savePayrollLedgerFields(empId, { [perkName]: numericVal });
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

    try {
      setErrorMessage(null);
      await savePayrollLedgerFields(empId, { paymentStatus: status });
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
      const updates = selectedSalaryEmployeeIds
        .filter((empId) => employees.some((e) => e.id === empId))
        .map((empId) => ({ id: empId, paymentStatus: status }));

      const res = await fetch("/api/employees/payroll-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey: selectedMonth, updates }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to bulk update payment status.");

      const result = await res.json();
      const successCount = Number(result.count) || updates.length;
      for (const empId of selectedSalaryEmployeeIds) {
        patchEmployeeInState(empId, (emp) => ({
          monthlyLedger: {
            ...(emp.monthlyLedger || {}),
            [selectedMonth]: {
              ...(emp.monthlyLedger?.[selectedMonth] || defaultMonthLedgerEntry(emp)),
              paymentStatus: status,
            },
          },
        }));
      }

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
      const isCompliant = isPfEsicCompliant(emp, locationCompliance);
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
        const isCompliant = isPfEsicCompliant(emp, locationCompliance);
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
        const rowData = cols.map(c => getSalaryColumnValue(emp, c, month, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtEnabled));
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
          const val = getSalaryColumnValue(emp, c, month, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtEnabled);
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
  const patchEmployeeInState = useCallback(
    (id: string, updater: Partial<Employee> | ((emp: Employee) => Partial<Employee>)) => {
      setRawEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== id) return emp;
          const patch = typeof updater === "function" ? updater(emp) : updater;
          return { ...emp, ...patch };
        }),
      );
    },
    [],
  );

  const defaultMonthLedgerEntry = useCallback((emp: Employee) => ({
    advance: Number(emp.advance || 0),
    penalty: Number(emp.penalty || 0),
    foodPerk: Number(emp.foodPerk || 0),
    accommodationPerk: Number(emp.accommodationPerk || 0),
    conveyancePerk: Number(emp.conveyancePerk || 0),
    penaltyReason: "",
    paymentStatus: "Unpaid" as const,
  }), []);

  const savePayrollLedgerFields = useCallback(
    async (empId: string, fields: Record<string, string | number>) => {
      if (!selectedMonth) throw new Error("No payroll month selected.");
      const res = await fetch("/api/employees/payroll-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: selectedMonth,
          updates: [{ id: empId, ...fields }],
        }),
      });
      if (!res.ok) throw await parseApiError(res, "Failed to update payroll ledger.");
      patchEmployeeInState(empId, (emp) => ({
        monthlyLedger: {
          ...(emp.monthlyLedger || {}),
          [selectedMonth]: {
            ...(emp.monthlyLedger?.[selectedMonth] || defaultMonthLedgerEntry(emp)),
            ...fields,
          },
        },
      }));
    },
    [selectedMonth, patchEmployeeInState, defaultMonthLedgerEntry],
  );

  const fetchEmployees = useCallback(async (options?: { forceLedger?: boolean }) => {
    const includeLedger =
      options?.forceLedger ?? (activeSidebarTab === "Salary" || activeSidebarTab === "Ledger");
    const params = new URLSearchParams();
    if (!includeLedger) {
      params.set("lite", "1");
    } else if (selectedMonth) {
      params.set("ledgerMonth", selectedMonth);
    }
    const query = params.toString();
    const url = `/api/employees${query ? `?${query}` : ""}`;

    const inFlight = employeesFetchInFlightRef.current.get(url);
    if (inFlight) {
      await inFlight;
      return;
    }

    const task = (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(url);
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
    })();

    employeesFetchInFlightRef.current.set(url, task);
    try {
      await task;
    } finally {
      employeesFetchInFlightRef.current.delete(url);
    }
  }, [activeSidebarTab, selectedMonth]);

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
      setErrorMessage("Failed to load school records: " + err.message);
      setRawSchoolWorks([]);
    } finally {
      setIsSchoolLoading(false);
    }
  };

  const fetchSchoolVisits = async () => {
    try {
      const res = await fetch("/api/school-visits");
      if (res.ok) setRawSchoolVisits(await res.json());
    } catch {
      setRawSchoolVisits([]);
    }
  };

  const fetchSupervisorRequests = async () => {
    try {
      const res = await fetch("/api/supervisor-requests");
      if (res.ok) setRawSupervisorRequests(await res.json());
      else setRawSupervisorRequests([]);
    } catch {
      setRawSupervisorRequests([]);
    }
  };

  const fetchCommitmentDiary = async () => {
    try {
      const res = await fetch("/api/commitment-diary");
      if (res.ok) setRawCommitmentDiary(await res.json());
      else setRawCommitmentDiary([]);
    } catch {
      setRawCommitmentDiary([]);
    }
  };

  const fetchTenders = async () => {
    try {
      const res = await fetch("/api/tenders");
      if (res.ok) setRawTenders(await res.json());
      else setRawTenders([]);
    } catch {
      setRawTenders([]);
    }
  };

  const fetchContracts = async () => {
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) setRawContracts(await res.json());
      else setRawContracts([]);
    } catch {
      setRawContracts([]);
    }
  };

  const fetchRenewals = async () => {
    try {
      const res = await fetch("/api/renewals");
      if (res.ok) setRawRenewals(await res.json());
      else setRawRenewals([]);
    } catch {
      setRawRenewals([]);
    }
  };

  const fetchBgDdRecords = async () => {
    try {
      const res = await fetch("/api/bg-dd");
      if (res.ok) setRawBgDdRecords(await res.json());
      else setRawBgDdRecords([]);
    } catch {
      setRawBgDdRecords([]);
    }
  };

  const fetchPendingSupervisorRequestCount = async () => {
    try {
      const res = await fetch("/api/supervisor-requests/pending-count");
      if (res.ok) {
        const data = await res.json();
        setPendingSupervisorRequestCount(data.count || 0);
      }
    } catch {
      setPendingSupervisorRequestCount(0);
    }
  };

  const fetchAdminNotifications = useCallback(async (): Promise<AppNotification[]> => {
    setIsFetchingAdminNotifications(true);
    try {
      const res = await fetch("/api/notifications/summary");
      if (!res.ok) throw new Error("Failed to load notifications.");
      const data = await res.json();
      const items: AppNotification[] = Array.isArray(data.items) ? data.items : [];
      setAdminNotifications(items);
      setAdminNotificationUnreadCount(Number(data.count) || 0);
      return items;
    } catch {
      setAdminNotifications([]);
      setAdminNotificationUnreadCount(0);
      return [];
    } finally {
      setIsFetchingAdminNotifications(false);
    }
  }, []);

  const fetchAdminNotificationUnreadCount = useCallback(async (): Promise<number> => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        const count = data.count || 0;
        setAdminNotificationUnreadCount(count);
        return count;
      }
    } catch {
      /* ignore */
    }
    return 0;
  }, []);

  const fetchAdminNotificationsList = useCallback(async (): Promise<AppNotification[]> => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const items: AppNotification[] = await res.json();
        setAdminNotifications(items);
        return items;
      }
    } catch {
      /* ignore */
    }
    return [];
  }, []);

  useNotificationPoller({
    enabled: isLoggedIn && !!userPermissions.schoolWork?.view,
    unreadCount: adminNotificationUnreadCount,
    fetchUnreadCount: fetchAdminNotificationUnreadCount,
    fetchNotifications: fetchAdminNotificationsList,
  });

  const handleMarkAdminNotificationRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      await fetchAdminNotifications();
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllAdminNotificationsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
      await fetchAdminNotifications();
    } catch {
      /* ignore */
    }
  };

  const handleAdminNotificationNavigate = (notification: AppNotification) => {
    const target = getAdminNotificationTarget(notification);
    if (!target) return;
    setActiveSidebarTab(target.tab);
    if (target.fieldTeamView) {
      setFieldTeamView(target.fieldTeamView);
    }
  };

  const fetchSchoolPartners = async () => {
    try {
      const res = await fetch("/api/school-partners");
      if (res.ok) setRawSchoolPartners(await res.json());
      else setRawSchoolPartners([]);
    } catch {
      setRawSchoolPartners([]);
    }
  };

  const fetchSchoolBillings = useCallback(async () => {
    try {
      const res = await fetch("/api/school-monthly-billings");
      if (res.ok) {
        setRawSchoolBillings(await res.json());
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const handleGenerateSchoolBilling = async (payload: {
    block: string;
    district?: string;
    monthKey: string;
    financialYear: string;
    cleaningDays: number;
    category: "elementary" | "secondary" | "all";
    billingId?: string;
  }): Promise<SchoolMonthlyBilling | null> => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-monthly-billings/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to generate invoice (${res.status})`);
      }
      const saved = (await res.json()) as SchoolMonthlyBilling;
      setRawSchoolBillings((prev) => {
        const rest = prev.filter(
          (billing) =>
            !(
              billing.block === saved.block &&
              billing.monthKey === saved.monthKey &&
              billing.category === saved.category
            ),
        );
        return [saved, ...rest];
      });
      void fetchSchoolBillings();
      triggerSuccess(`Saved monthly invoice for ${payload.block} (${payload.monthKey}).`);
      return saved;
    } catch (err: any) {
      setErrorMessage("Invoice generation failed: " + err.message);
      return null;
    }
  };

  const handleSaveSchoolWorkdays = async (payload: {
    block: string;
    district?: string;
    monthKey: string;
    defaultDays: number;
    updates: Array<{ id: string; cleaningDays: number; billingToilets?: number }>;
  }): Promise<boolean> => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-works/bulk-update-workdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to save workdays (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data.schools) && data.schools.length > 0) {
        setRawSchoolWorks((prev) => {
          const byId = new Map(data.schools.map((s: { id: string }) => [s.id, s]));
          return prev.map((school) => (byId.has(school.id) ? (byId.get(school.id) as typeof school) : school));
        });
      } else {
        await fetchSchoolWorks();
      }
      triggerSuccess(
        `Saved billing values for ${payload.block} (${payload.monthKey}) — ${data.updatedCount || 0} school(s).`,
      );
      return true;
    } catch (err: any) {
      setErrorMessage("Failed to save days worked: " + err.message);
      return false;
    }
  };

  const handleSavePartnerPayUpdates = async (
    updates: Array<{ id: string; changes: { partnerMonthlyPay: number; rates: number } }>,
  ): Promise<boolean> => {
    if (updates.length === 0) return true;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-works/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to save partner pay (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data.records) && data.records.length > 0) {
        setRawSchoolWorks((prev) => {
          const byId = new Map(data.records.map((s: { id: string }) => [s.id, s]));
          return prev.map((school) => (byId.has(school.id) ? (byId.get(school.id) as typeof school) : school));
        });
      } else {
        await fetchSchoolWorks();
      }
      await fetchSchoolPartners();
      triggerSuccess(`Updated partner pay for ${data.updated || updates.length} school(s).`);
      return true;
    } catch (err: any) {
      setErrorMessage("Failed to save partner pay: " + err.message);
      return false;
    }
  };

  const handleSavePartnerPayDetails = async (
    updates: Array<{ id: string; changes: Partial<SchoolWork> }>,
  ): Promise<boolean> => {
    if (updates.length === 0) return true;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-works/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to save partner details (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data.records) && data.records.length > 0) {
        setRawSchoolWorks((prev) => {
          const byId = new Map(data.records.map((s: { id: string }) => [s.id, s]));
          return prev.map((school) => (byId.has(school.id) ? (byId.get(school.id) as typeof school) : school));
        });
      } else {
        await fetchSchoolWorks();
      }
      await fetchSchoolPartners();
      triggerSuccess(`Updated partner details for ${data.updated || updates.length} school(s).`);
      return true;
    } catch (err: any) {
      setErrorMessage("Failed to save partner details: " + err.message);
      return false;
    }
  };

  const handleSavePartnerPaymentStatus = async (
    updates: Array<{ id: string; paymentStatus: "Unpaid" | "Paid" | "Hold" }>,
  ): Promise<boolean> => {
    if (updates.length === 0 || !selectedMonth) return true;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-partners/bulk-update-pay-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey: selectedMonth, updates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to save payment status (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data.records) && data.records.length > 0) {
        setRawSchoolPartners((prev) => {
          const byId = new Map(data.records.map((p: SchoolPartner) => [p.id, p]));
          return prev.map((partner) =>
            byId.has(partner.id) ? (byId.get(partner.id) as SchoolPartner) : partner,
          );
        });
      } else {
        await fetchSchoolPartners();
      }
      triggerSuccess(`Updated payment status for ${data.updated || updates.length} partner(s).`);
      return true;
    } catch (err: any) {
      setErrorMessage("Failed to save payment status: " + err.message);
      return false;
    }
  };

  const fetchSchoolSupervisors = async () => {
    try {
      const res = await fetch("/api/school-supervisors");
      if (res.ok) setRawSchoolSupervisors(await res.json());
      else setRawSchoolSupervisors([]);
    } catch {
      setRawSchoolSupervisors([]);
    }
  };

  const fetchSchoolGeography = async () => {
    setIsSchoolGeographyLoading(true);
    try {
      const [districtRes, blockRes] = await Promise.all([
        fetch("/api/school-geography/districts"),
        fetch("/api/school-geography/blocks"),
      ]);
      if (districtRes.ok) setSchoolDistricts(await districtRes.json());
      else setSchoolDistricts([]);
      if (blockRes.ok) setSchoolBlocks(await blockRes.json());
      else setSchoolBlocks([]);
    } catch {
      setSchoolDistricts([]);
      setSchoolBlocks([]);
    } finally {
      setIsSchoolGeographyLoading(false);
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
      fetchAdminNotifications();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeSidebarTab === "Salary" || activeSidebarTab === "Ledger") {
      void fetchEmployees({ forceLedger: true });
    }
  }, [isLoggedIn, activeSidebarTab, selectedMonth]);

  useEffect(() => {
    if (!isLoggedIn || !selectedMonth || !shouldTrackExitEligibility) return;
    scheduleFetchExitEligibility(selectedMonth, false);
  }, [isLoggedIn, selectedMonth, shouldTrackExitEligibility, activeSidebarTab, scheduleFetchExitEligibility]);

  useEffect(() => {
    if (isLoggedIn && isSchoolWorkTab(activeSidebarTab)) {
      fetchSchoolWorks();
      if (activeSidebarTab === "Field Team" || activeSidebarTab === "Schools") {
        fetchSchoolVisits();
        fetchSupervisorRequests();
        fetchCommitmentDiary();
        fetchPendingSupervisorRequestCount();
        fetchAdminNotifications();
      }
      if (activeSidebarTab === "Monthly Billing") {
        fetchSchoolPartners();
        fetchSchoolBillings();
      }
      if (
        activeSidebarTab === "Field Team" ||
        activeSidebarTab === "Schools"
      ) {
        fetchSchoolSupervisors();
      }
      if (
        activeSidebarTab === "Schools" ||
        activeSidebarTab === "Expenses" ||
        activeSidebarTab === "Field Team"
      ) {
        fetchSchoolGeography();
      }
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Dashboard") {
      fetchTenders();
      fetchContracts();
      fetchRenewals();
      fetchBgDdRecords();
      fetchSchoolWorks();
      fetchPendingSupervisorRequestCount();
      fetchSchoolVisits();
      fetchSchoolSupervisors();
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && isBidsTab(activeSidebarTab)) {
      fetchTenders();
      fetchContracts();
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && isRenewalsTab(activeSidebarTab)) {
      fetchRenewals();
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && isBgDdTab(activeSidebarTab)) {
      fetchBgDdRecords();
      fetchContracts();
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Field Team" && fieldTeamView === "commitments") {
      fetchCommitmentDiary();
    }
  }, [isLoggedIn, activeSidebarTab, fieldTeamView]);

  useEffect(() => {
    if (!isLoggedIn || activeSidebarTab !== "Field Team") return;
    const timer = window.setInterval(() => {
      void fetchSchoolSupervisors();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Employees") {
      fetchEmployeeChangeRequests();
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && activeSidebarTab === "Employees" && activePimSubTab === "Configuration") {
      fetchSchoolGeography();
    }
  }, [isLoggedIn, activeSidebarTab, activePimSubTab]);

  useEffect(() => {
    if (location.pathname === "/school-configuration") {
      setActivePimSubTab("Configuration");
      navigate("/employees", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (isSchoolWorkTab(activeSidebarTab)) {
      setExpandedSidebarGroups((prev) => ({ ...prev, "School Work": true }));
    }
  }, [activeSidebarTab]);

  useEffect(() => {
    if (isBidsTab(activeSidebarTab)) {
      setExpandedSidebarGroups((prev) => ({ ...prev, "Bids": true }));
    }
  }, [activeSidebarTab]);

  useEffect(() => {
    if (isRenewalsTab(activeSidebarTab)) {
      setExpandedSidebarGroups((prev) => ({ ...prev, "Renewals": true }));
    }
  }, [activeSidebarTab]);

  useEffect(() => {
    if (isLoggedIn && sessionUser) {
      fetchAdminProfile();
    }
  }, [isLoggedIn, sessionUser]);

  useEffect(() => {
    if (isLoggedIn && isAdminModuleTab(activeSidebarTab)) {
      fetchAdmins();
      fetchRoles();
    }
  }, [isLoggedIn, activeSidebarTab]);

  useEffect(() => {
    if (location.pathname === "/audit-logs") {
      setRoleAccessSection("audit");
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isLoggedIn || !location.pathname.startsWith("/observer")) return;
    fetchSchoolWorks();
    fetchSchoolVisits();
    fetchSchoolSupervisors();
    fetchCommitmentDiary();
    fetchTenders();
    fetchContracts();
    fetchRenewals();
    fetchSchoolPartners();
    fetchPendingSupervisorRequestCount();
    fetchAdminNotifications();
  }, [isLoggedIn, location.pathname]);

  useEffect(() => {
    if (!isLoggedIn || !location.pathname.startsWith("/observer/map")) return;
    const timer = window.setInterval(() => {
      void fetchSchoolSupervisors();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [isLoggedIn, location.pathname]);

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

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
  };

  // Login handler
  const handleLoginSubmit = (e: React.FormEvent) =>
    authHandleLoginSubmit(e, (username) =>
      triggerSuccess(`Successfully authenticated. Welcome back, ${username}!`),
    );

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = forgotUsername.trim();
    if (!cleanUser) {
      setForgotError("Please enter your username or recovery email.");
      return;
    }
    try {
      setIsSendingResetCode(true);
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
    } finally {
      setIsSendingResetCode(false);
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
      setIsUpdatingPassword(true);
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
    } finally {
      setIsUpdatingPassword(false);
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

  const resetEditAdminPasswordFields = () => {
    setEditAdminNewPassword("");
    setEditAdminPasswordError(null);
    setEditAdminPasswordSuccess(null);
  };

  const handleResetAdminPasswordSubmit = async (username: string) => {
    setEditAdminPasswordError(null);
    setEditAdminPasswordSuccess(null);

    const newP = editAdminNewPassword.trim();

    if (!newP) {
      setEditAdminPasswordError("Please enter a new password.");
      return;
    }

    if (newP.length < 8) {
      setEditAdminPasswordError("Password must be at least 8 characters long.");
      return;
    }

    setIsResettingAdminPassword(true);
    try {
      const res = await fetch("/api/admins/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          newPassword: newP,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to reset administrator password.");
      }

      resetEditAdminPasswordFields();
      setEditAdminPasswordSuccess(`Password reset for "${username}". Their active sessions were signed out.`);
      triggerSuccess(`Password reset for "${username}".`);
    } catch (err: any) {
      setEditAdminPasswordError(err.message);
    } finally {
      setIsResettingAdminPassword(false);
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
  const handleLogout = async (redirectTo?: string) => {
    setIsProfileOpen(false);
    setIsMobileProfileOpen(false);
    await authHandleLogout(redirectTo);
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
          permissions: rolePermsInput,
          uiRestrictions: roleUiInput,
        })
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save the custom role.");
      }
      setRoleNameInput("");
      setRoleDescInput("");
      setRolePermsInput({ ...DEFAULT_NEW_ROLE_PERMISSIONS });
      setRoleUiInput(createEmptyRoleUiRestrictions());
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
      delete (payload as Partial<Employee>).contractId;
      
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
      patchEmployeeInState(savedEmployee.id, savedEmployee);
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
      await fetchExitEligibility(selectedMonth, false);
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
      await fetchSchoolPartners();
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
      await fetchSchoolPartners();
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
      await fetchSchoolPartners();
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
      await fetchSchoolPartners();
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

  const applySchoolBulkEditDraftUpdate = (
    prev: Record<string, Partial<SchoolWork>>,
    schools: SchoolWork[],
    schoolId: string,
    field: keyof SchoolWork,
    value: string,
  ): Record<string, Partial<SchoolWork>> => {
    const school = schools.find((s) => s.id === schoolId);
    if (!school) return prev;
    const original = String(school[field] ?? "");
    const nextDraft = { ...(prev[schoolId] || {}) };
    if (value === original) {
      delete nextDraft[field];
    } else if (field === "noOfToilets" || field === "govtUnitRate" || field === "partnerMonthlyPay") {
      nextDraft[field] = Number(value) || 0;
    } else {
      nextDraft[field] = value as never;
    }
    const next = { ...prev };
    if (Object.keys(nextDraft).length === 0) delete next[schoolId];
    else next[schoolId] = nextDraft;
    return next;
  };

  const handleSchoolBulkEditDraftChange = (
    schoolId: string,
    field: keyof SchoolWork,
    value: string,
  ) => {
    setSchoolBulkEditDrafts((prev) =>
      applySchoolBulkEditDraftUpdate(prev, rawSchoolWorks, schoolId, field, value),
    );
  };

  const handleSchoolBulkEditDraftChangeMany = (
    updates: Array<{ schoolId: string; field: keyof SchoolWork; value: string }>,
  ) => {
    if (updates.length === 0) return;
    if (updates.length === 1) {
      handleSchoolBulkEditDraftChange(updates[0].schoolId, updates[0].field, updates[0].value);
      return;
    }
    setSchoolBulkEditDrafts((prev) => {
      let next = prev;
      for (const update of updates) {
        next = applySchoolBulkEditDraftUpdate(
          next,
          rawSchoolWorks,
          update.schoolId,
          update.field,
          update.value,
        );
      }
      return next;
    });
  };

  const handleDiscardSchoolBulkEditDrafts = () => {
    setSchoolBulkEditDrafts({});
  };

  const handleApplySchoolBulkEdit = async () => {
    const updates = Object.entries(schoolBulkEditDrafts)
      .filter(([, changes]) => Object.keys(changes).length > 0)
      .map(([id, changes]) => ({ id, changes }));
    if (updates.length === 0) return;

    setIsSubmittingSchoolBulkEdit(true);
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-works/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || errorJson.error || "Bulk update failed.");
      }
      const result = await res.json();
      setSchoolBulkEditDrafts({});
      await fetchSchoolWorks();
      await fetchSchoolPartners();
      triggerSuccess(`Successfully updated ${result.updated} school record(s).`);
    } catch (err: any) {
      setErrorMessage("School bulk edit failed: " + err.message);
    } finally {
      setIsSubmittingSchoolBulkEdit(false);
    }
  };

  const PARTNER_TO_SCHOOL_FIELD: Partial<Record<keyof SchoolPartner, keyof SchoolWork>> = {
    schoolName: "schoolName",
    partnerName: "sweeperName",
    accountHolderName: "accountHolderName",
    accountNumber: "accountNumber",
    ifscCode: "ifscCode",
    monthlyPay: "partnerMonthlyPay",
    block: "block",
    district: "district",
  };

  const applyPartnerBulkEditDraftUpdate = (
    prev: Record<string, Partial<SchoolPartner>>,
    partners: SchoolPartner[],
    partnerId: string,
    field: keyof SchoolPartner,
    value: string,
  ): Record<string, Partial<SchoolPartner>> => {
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner) return prev;
    const original =
      field === "perToiletPay"
        ? String(getPartnerPerToiletPay(partner))
        : String(partner[field] ?? "");
    const nextDraft = { ...(prev[partnerId] || {}) };
    if (value === original) {
      delete nextDraft[field];
    } else if (field === "monthlyPay" || field === "perToiletPay") {
      nextDraft[field] = Number(value) || 0;
      const toilets = Number(partner.noOfToilets) || 0;
      if (field === "monthlyPay" && toilets > 0) {
        const monthly = Number(value) || 0;
        nextDraft.perToiletPay = monthly > 0 ? Math.round(monthly / toilets) : 0;
      } else if (field === "perToiletPay") {
        const perToilet = Number(value) || 0;
        nextDraft.monthlyPay = perToilet * toilets;
      }
    } else if (field === "noOfToilets") {
      nextDraft[field] = Number(value) || 0;
      const toilets = Number(value) || 0;
      const perToilet = Number(nextDraft.perToiletPay ?? getPartnerPerToiletPay(partner)) || 0;
      if (toilets > 0 && perToilet > 0) {
        nextDraft.monthlyPay = perToilet * toilets;
      }
    } else {
      nextDraft[field] = value as never;
    }
    const next = { ...prev };
    if (Object.keys(nextDraft).length === 0) delete next[partnerId];
    else next[partnerId] = nextDraft;
    return next;
  };

  const handlePartnerBulkEditDraftChange = (
    partnerId: string,
    field: keyof SchoolPartner,
    value: string,
  ) => {
    setPartnerBulkEditDrafts((prev) =>
      applyPartnerBulkEditDraftUpdate(prev, rawSchoolPartners, partnerId, field, value),
    );
  };

  const handlePartnerBulkEditDraftChangeMany = (
    updates: Array<{ partnerId: string; field: keyof SchoolPartner; value: string }>,
  ) => {
    if (updates.length === 0) return;
    if (updates.length === 1) {
      handlePartnerBulkEditDraftChange(updates[0].partnerId, updates[0].field, updates[0].value);
      return;
    }
    setPartnerBulkEditDrafts((prev) => {
      let next = prev;
      for (const update of updates) {
        next = applyPartnerBulkEditDraftUpdate(
          next,
          rawSchoolPartners,
          update.partnerId,
          update.field,
          update.value,
        );
      }
      return next;
    });
  };

  const handleDiscardPartnerBulkEditDrafts = () => {
    setPartnerBulkEditDrafts({});
  };

  const handleApplyPartnerBulkEdit = async () => {
    const updates = Object.entries(partnerBulkEditDrafts)
      .filter(([, changes]) => Object.keys(changes).length > 0)
      .map(([partnerId, changes]) => {
        const partner = rawSchoolPartners.find((p) => p.id === partnerId);
        if (!partner?.schoolWorkId) return null;
        const schoolChanges: Partial<SchoolWork> = {};
        for (const [key, val] of Object.entries(changes)) {
          if (key === "perToiletPay") {
            const toilets = Number(partner.noOfToilets) || 0;
            const perToilet = Number(val) || 0;
            if (toilets > 0) {
              schoolChanges.partnerMonthlyPay = perToilet * toilets;
              schoolChanges.rates = perToilet * toilets;
            }
            continue;
          }
          if (key === "monthlyPay") {
            const monthly = Number(val) || 0;
            schoolChanges.partnerMonthlyPay = monthly;
            schoolChanges.rates = monthly;
            continue;
          }
          if (key === "noOfToilets") {
            schoolChanges.noOfToilets = Number(val) || 0;
            continue;
          }
          const schoolField = PARTNER_TO_SCHOOL_FIELD[key as keyof SchoolPartner];
          if (schoolField) {
            (schoolChanges as Record<string, unknown>)[schoolField] = val;
          }
        }
        if (Object.keys(schoolChanges).length === 0) return null;
        return { id: partner.schoolWorkId, changes: schoolChanges };
      })
      .filter((item): item is { id: string; changes: Partial<SchoolWork> } => item !== null);

    if (updates.length === 0) return;

    setIsSubmittingPartnerBulkEdit(true);
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-works/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || errorJson.error || "Bulk update failed.");
      }
      const result = await res.json();
      setPartnerBulkEditDrafts({});
      await fetchSchoolWorks();
      await fetchSchoolPartners();
      triggerSuccess(`Successfully updated ${result.updated} partner record(s).`);
    } catch (err: any) {
      setErrorMessage("Partner bulk edit failed: " + err.message);
    } finally {
      setIsSubmittingPartnerBulkEdit(false);
    }
  };

  const handleAddSchoolDistrict = async (name: string): Promise<boolean> => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-geography/districts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || errorJson.error || "Failed to add district.");
      }
      await fetchSchoolGeography();
      triggerSuccess(`District "${name}" added.`);
      return true;
    } catch (err: any) {
      setErrorMessage("Add district failed: " + err.message);
      return false;
    }
  };

  const handleUpdateSchoolDistrict = async (id: string, name: string): Promise<boolean> => {
    try {
      setErrorMessage(null);
      const res = await fetch(`/api/school-geography/districts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || errorJson.error || "Failed to update district.");
      }
      await fetchSchoolGeography();
      await fetchSchoolWorks();
      triggerSuccess(`District updated to "${name}".`);
      return true;
    } catch (err: any) {
      setErrorMessage("Update district failed: " + err.message);
      return false;
    }
  };

  const handleDeleteSchoolDistricts = async (ids: string[]): Promise<boolean> => {
    const confirmed = await confirmAction({
      title: "Delete districts",
      message: `Remove ${ids.length} district(s) and their configured blocks? Existing school records keep their text values.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return false;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-geography/districts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Delete districts failed.");
      await fetchSchoolGeography();
      triggerSuccess(`Removed ${ids.length} district(s).`);
      return true;
    } catch (err: any) {
      setErrorMessage("Delete districts failed: " + err.message);
      return false;
    }
  };

  const handleAddSchoolBlock = async (name: string, districtId: string): Promise<boolean> => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-geography/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, districtId }),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || errorJson.error || "Failed to add block.");
      }
      await fetchSchoolGeography();
      triggerSuccess(`Block "${name}" added.`);
      return true;
    } catch (err: any) {
      setErrorMessage("Add block failed: " + err.message);
      return false;
    }
  };

  const handleUpdateSchoolBlock = async (
    id: string,
    patch: { name?: string; districtId?: string },
  ): Promise<boolean> => {
    try {
      setErrorMessage(null);
      const res = await fetch(`/api/school-geography/blocks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || errorJson.error || "Failed to update block.");
      }
      await fetchSchoolGeography();
      await fetchSchoolWorks();
      triggerSuccess("Block updated.");
      return true;
    } catch (err: any) {
      setErrorMessage("Update block failed: " + err.message);
      return false;
    }
  };

  const handleDeleteSchoolBlocks = async (ids: string[]): Promise<boolean> => {
    const confirmed = await confirmAction({
      title: "Delete blocks",
      message: `Remove ${ids.length} block(s) from configuration?`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return false;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-geography/blocks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Delete blocks failed.");
      await fetchSchoolGeography();
      triggerSuccess(`Removed ${ids.length} block(s).`);
      return true;
    } catch (err: any) {
      setErrorMessage("Delete blocks failed: " + err.message);
      return false;
    }
  };

  const handleAddExpenseRecord = async (payload: {
    district: string;
    block: string;
    monthKey: string;
    expenseType: "material" | "trek" | "miscellaneous";
    amount: number;
    remark: string;
    date: string;
  }): Promise<boolean> => {
    const amountError = validateNonNegativeNumberField(payload.amount, "Amount", { required: true });
    if (amountError) {
      setErrorMessage(amountError);
      return false;
    }

    try {
      setErrorMessage(null);
      const body: Record<string, unknown> = {
        block: payload.block,
        district: payload.district,
        monthKey: payload.monthKey,
        materialAmount: 0,
        trekAmount: 0,
        miscellaneousAmount: 0,
      };
      if (payload.expenseType === "material") {
        body.materialAmount = payload.amount;
        body.materialRemark = payload.remark;
        body.materialDate = payload.date;
      } else if (payload.expenseType === "trek") {
        body.trekAmount = payload.amount;
        body.trekRemark = payload.remark;
        body.trekDate = payload.date;
      } else {
        body.miscellaneousAmount = payload.amount;
        body.miscellaneousRemark = payload.remark;
        body.miscellaneousDate = payload.date;
      }

      const res = await fetch("/api/school-works/distribute-block-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || errorJson.error || "Failed to add expense record.");
      }
      const result = await res.json();
      await fetchSchoolWorks();
      const typeLabel =
        payload.expenseType === "material"
          ? "Material"
          : payload.expenseType === "trek"
            ? "Trek"
            : "Miscellaneous";
      const perSchool =
        payload.expenseType === "material"
          ? result.perSchoolMaterial
          : payload.expenseType === "trek"
            ? result.perSchoolTrek
            : result.perSchoolMiscellaneous;
      triggerSuccess(
        `Saved ${typeLabel} expense for ${payload.monthKey}: ₹${payload.amount.toLocaleString("en-IN")} split across ${result.updatedCount} school(s) in block "${payload.block}" (≈ ₹${perSchool}/school).`,
      );
      return true;
    } catch (err: any) {
      setErrorMessage("Save expense failed: " + err.message);
      return false;
    }
  };

  const handleDeleteExpenseRecord = async (row: {
    block: string;
    district: string;
    monthKey: string;
    type: "Material" | "Trek" | "Miscellaneous";
    amount: number;
  }): Promise<boolean> => {
    const typeLabel = row.type;
    const confirmed = await confirmAction({
      title: "Delete expense",
      message: `Remove ${typeLabel} expense of ₹${row.amount.toLocaleString("en-IN")} for block "${row.block}" in ${row.monthKey}?`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return false;

    try {
      setErrorMessage(null);
      const res = await fetch("/api/school-works/delete-block-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block: row.block,
          district: row.district || undefined,
          monthKey: row.monthKey,
          expenseType: expenseRecordTypeToForm(row.type),
        }),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || errorJson.error || "Failed to delete expense record.");
      }
      await fetchSchoolWorks();
      triggerSuccess(`Deleted ${typeLabel} expense for block "${row.block}" (${row.monthKey}).`);
      return true;
    } catch (err: any) {
      setErrorMessage("Delete expense failed: " + err.message);
      return false;
    }
  };

  const handleUpdateVisitStatus = async (
    id: string,
    status: "approved" | "rejected",
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/school-visits/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update visit status.");
      await fetchSchoolVisits();
      await fetchAdminNotifications();
      triggerSuccess(`Visit marked as ${status}.`);
      return true;
    } catch (err: any) {
      setErrorMessage(err.message);
      return false;
    }
  };

  const handleBulkUpdateVisitStatus = async (
    ids: string[],
    status: "approved" | "rejected",
  ): Promise<boolean> => {
    if (ids.length === 0) return true;
    try {
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/school-visits/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }),
        ),
      );
      if (results.some((res) => !res.ok)) {
        throw new Error("Some visits could not be updated.");
      }
      await fetchSchoolVisits();
      await fetchAdminNotifications();
      triggerSuccess(
        `${ids.length} visit${ids.length !== 1 ? "s" : ""} marked as ${status}.`,
      );
      return true;
    } catch (err: any) {
      setErrorMessage(err.message);
      return false;
    }
  };

  const handleRespondSupervisorRequest = async (
    id: string,
    adminResponse: string,
    status: "responded" | "closed",
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/supervisor-requests/${id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminResponse, status }),
      });
      if (!res.ok) throw new Error("Failed to respond to supervisor request.");
      await fetchSupervisorRequests();
      await fetchPendingSupervisorRequestCount();
      await fetchAdminNotifications();
      triggerSuccess("Response sent to supervisor.");
      return true;
    } catch (err: any) {
      setErrorMessage(err.message);
      return false;
    }
  };

  const handleCloseSupervisorRequest = async (
    id: string,
    note?: string,
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/supervisor-requests/${id}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || "" }),
      });
      if (!res.ok) throw new Error("Failed to close supervisor request.");
      await fetchSupervisorRequests();
      await fetchPendingSupervisorRequestCount();
      await fetchAdminNotifications();
      triggerSuccess("Request closed.");
      return true;
    } catch (err: any) {
      setErrorMessage(err.message);
      return false;
    }
  };

  const handleResolveSupervisorEscalation = async (
    id: string,
    resolution: string,
    status: "responded" | "closed",
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/supervisor-requests/${id}/resolve-escalation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, status }),
      });
      if (!res.ok) throw new Error("Failed to resolve escalated request.");
      await fetchSupervisorRequests();
      await fetchPendingSupervisorRequestCount();
      await fetchAdminNotifications();
      triggerSuccess("Escalation resolved and supervisor notified.");
      return true;
    } catch (err: any) {
      setErrorMessage(err.message);
      return false;
    }
  };

  const handleUpdateCommitmentDiary = async (
    id: string,
    patch: {
      status?: CommitmentDiary["status"];
      adminNotes?: string;
      notes?: string;
    },
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/commitment-diary/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update commitment diary entry.");
      await fetchCommitmentDiary();
      await fetchAdminNotifications();
      triggerSuccess("Commitment diary updated.");
      return true;
    } catch (err: any) {
      setErrorMessage(err.message);
      return false;
    }
  };

  const handleCreateTender = async (payload: CreateTenderInput): Promise<void> => {
    const res = await fetch("/api/tenders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to create tender.");
    await fetchTenders();
    triggerSuccess("Tender added.");
  };

  const handleUpdateTender = async (
    id: string,
    payload: Partial<CreateTenderInput>,
  ): Promise<void> => {
    const res = await fetch(`/api/tenders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to update tender.");
    await fetchTenders();
    triggerSuccess("Tender updated.");
  };

  const handleDeleteTender = async (id: string): Promise<void> => {
    const res = await fetch(`/api/tenders/${id}`, { method: "DELETE" });
    if (!res.ok) throw await parseApiError(res, "Failed to delete tender.");
    await fetchTenders();
    triggerSuccess("Tender deleted.");
  };

  const handleImportTenders = async (
    items: CreateTenderInput[],
  ): Promise<{ created: number; updated: number; skipped: number }> => {
    const res = await fetch("/api/tenders/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to import tenders.");
    const data = await res.json();
    await fetchTenders();
    triggerSuccess(
      `Imported ${data.created || 0} new, updated ${data.updated || 0}, skipped ${data.skipped || 0}.`,
    );
    return {
      created: data.created || 0,
      updated: data.updated || 0,
      skipped: data.skipped || 0,
    };
  };

  const handleCreateContract = async (payload: CreateContractInput): Promise<void> => {
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to create contract.");
    await fetchContracts();
    await fetchBgDdRecords();
    triggerSuccess("Contract added.");
  };

  const handleUpdateContract = async (
    id: string,
    payload: Partial<CreateContractInput>,
  ): Promise<void> => {
    const res = await fetch(`/api/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to update contract.");
    await fetchContracts();
    await fetchBgDdRecords();
    triggerSuccess("Contract updated.");
  };

  const handleDeleteContract = async (id: string): Promise<void> => {
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    if (!res.ok) throw await parseApiError(res, "Failed to delete contract.");
    await fetchContracts();
    triggerSuccess("Contract deleted.");
  };

  const handleImportContracts = async (
    items: CreateContractInput[],
  ): Promise<{ created: number; updated: number; skipped: number }> => {
    const res = await fetch("/api/contracts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to import contracts.");
    const data = await res.json();
    await fetchContracts();
    await fetchBgDdRecords();
    triggerSuccess(
      `Imported ${data.created || 0} new, updated ${data.updated || 0}, skipped ${data.skipped || 0}.`,
    );
    return {
      created: data.created || 0,
      updated: data.updated || 0,
      skipped: data.skipped || 0,
    };
  };

  const handleCreateRenewal = async (payload: CreateRenewalInput): Promise<Renewal> => {
    const res = await fetch("/api/renewals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to create renewal.");
    const created = await res.json();
    await fetchRenewals();
    triggerSuccess("Renewal added.");
    return created;
  };

  const handleUpdateRenewal = async (
    id: string,
    payload: Partial<CreateRenewalInput>,
  ): Promise<void> => {
    const res = await fetch(`/api/renewals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to update renewal.");
    await fetchRenewals();
    triggerSuccess("Renewal updated.");
  };

  const handleDeleteRenewal = async (id: string): Promise<void> => {
    const res = await fetch(`/api/renewals/${id}`, { method: "DELETE" });
    if (!res.ok) throw await parseApiError(res, "Failed to delete renewal.");
    await fetchRenewals();
    triggerSuccess("Renewal deleted.");
  };

  const handleImportRenewals = async (
    items: CreateRenewalInput[],
  ): Promise<{ created: number; updated: number; skipped: number }> => {
    const res = await fetch("/api/renewals/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to import renewals.");
    const data = await res.json();
    await fetchRenewals();
    triggerSuccess(
      `Imported ${data.created || 0} new, updated ${data.updated || 0}, skipped ${data.skipped || 0}.`,
    );
    return {
      created: data.created || 0,
      updated: data.updated || 0,
      skipped: data.skipped || 0,
    };
  };

  const handleCreateBgDdRecord = async (payload: CreateBgDdInput): Promise<BgDdRecord> => {
    const res = await fetch("/api/bg-dd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to create BG/DD record.");
    const created = await res.json();
    await fetchBgDdRecords();
    await fetchContracts();
    triggerSuccess("BG/DD record added.");
    return created;
  };

  const handleUpdateBgDdRecord = async (
    id: string,
    payload: Partial<CreateBgDdInput>,
  ): Promise<void> => {
    const res = await fetch(`/api/bg-dd/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseApiError(res, "Failed to update BG/DD record.");
    await fetchBgDdRecords();
    await fetchContracts();
    triggerSuccess("BG/DD record updated.");
  };

  const handleDeleteBgDdRecord = async (id: string): Promise<void> => {
    const res = await fetch(`/api/bg-dd/${id}`, { method: "DELETE" });
    if (!res.ok) throw await parseApiError(res, "Failed to delete BG/DD record.");
    await fetchBgDdRecords();
    triggerSuccess("BG/DD record deleted.");
  };

  const handleSaveSchoolSupervisor = async (
    data: Partial<SchoolSupervisor> & { password?: string },
  ): Promise<boolean> => {
    try {
      setErrorMessage(null);
      const isEdit = !!data.id && rawSchoolSupervisors.some((supervisor) => supervisor.id === data.id);
      const url = isEdit ? `/api/school-supervisors/${data.id}` : "/api/school-supervisors";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          assignedBlocks: data.assignedBlocks,
          loginEnabled: data.loginEnabled,
          loginPhone: data.loginPhone,
          password: data.password,
          status: data.status,
        }),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || errorJson.error || "Server rejected supervisor save.");
      }
      await fetchSchoolSupervisors();
      triggerSuccess(isEdit ? `Updated supervisor "${data.name}"` : `Added supervisor "${data.name}"`);
      return true;
    } catch (err: any) {
      setErrorMessage("Supervisor save failed: " + err.message);
      return false;
    }
  };

  const handleDeleteSchoolSupervisor = async (id: string) => {
    const confirmed = await confirmAction({
      title: "Delete school supervisor",
      message: "Remove this school supervisor record? Schools in their assigned blocks will no longer have supervisor coverage.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await fetch("/api/school-supervisors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error("Delete request refused by backend.");
      await fetchSchoolSupervisors();
      triggerSuccess("School supervisor removed.");
    } catch (err: any) {
      setErrorMessage("Supervisor deletion failed: " + err.message);
    }
  };


  const existingSchoolUdiseCodes = useMemo(
    () => rawSchoolWorks.map((s) => s.udise).filter(Boolean),
    [rawSchoolWorks],
  );

  const schoolDashboardStats = useMemo(() => {
    const totalPartnerPay = rawSchoolWorks.reduce(
      (sum, s) => sum + computePartnerMonthlyPay(s),
      0,
    );
    const totalToilets = rawSchoolWorks.reduce((sum, s) => sum + (Number(s.noOfToilets) || 0), 0);
    const districts = new Set(rawSchoolWorks.map((s) => s.district).filter(Boolean));
    return {
      totalCount: rawSchoolWorks.length,
      totalPartnerPay,
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
            locationPtEnabled,
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
      alert(
        "No default debit account configured. Go to Configuration → Bank Accounts, add an account, and set it as default for bulk pay."
      );
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
            locationPtEnabled,
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

  const handleExportSchoolAxisBulkPay = async (payload: {
    items: AxisBulkPayRowInput[];
    partnerSheet: BulkPayPartnerSheetInput;
    partnerIds: string[];
    partnerHeaders: readonly string[];
  }) => {
    if (!userPermissions.schoolWork?.edit) {
      setErrorMessage(
        "You do not have permission to save school bulk pay files. Contact an administrator for School Work edit access."
      );
      return;
    }

    const debitAccountNo = getAxisDebitAccountNo();
    if (!debitAccountNo) {
      alert(
        "No default debit account configured. Go to Configuration → Bank Accounts, add an account, and set it as default for bulk pay."
      );
      return;
    }

    const { items, partnerSheet, partnerIds, partnerHeaders } = payload;
    if (partnerIds.length === 0) {
      alert("No partner rows to export.");
      return;
    }

    const missingBank = items.filter(
      (item) => !item.accountNo?.trim() || !item.beneficiaryName?.trim()
    );
    if (missingBank.length > 0) {
      const proceed = await confirmAction({
        title: "Missing bank details",
        message: `${missingBank.length} partner(s) are missing bank account or account holder name and will be skipped. Continue?`,
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

    const filename = buildSchoolAxisBulkPayFilename(selectedMonth);
    const { exported, totalAmount, fileBase64 } = downloadSchoolAxisBulkPayXls(
      items,
      { debitAccountNo },
      filename,
      partnerSheet,
      partnerHeaders
    );

    if (exported === 0) {
      alert("No valid bank payment rows to export. Ensure partners have bank details and total pay > 0.");
      return;
    }

    if (!fileBase64?.trim()) {
      setErrorMessage("Bulk pay file was generated but could not be encoded for server storage. Try again.");
      return;
    }

    setIsExportingSchoolBulkPay(true);
    try {
      const saved = await saveSchoolAxisBulkPayArchive({
        filename,
        month: payMonth,
        year: payYear,
        recordCount: exported,
        totalAmount,
        employeeIds: partnerIds,
        fileBase64,
      });
      if (!saved?.id) {
        throw new Error("Server did not return a saved archive record.");
      }

      setLastSavedSchoolBulkPay(saved);
      setHighlightedSchoolBulkPayId(saved.id);
      setSchoolBulkPayArchives((prev) => {
        const rest = prev.filter((item: any) => item.id !== saved.id);
        return [saved, ...rest];
      });
      setSchoolBulkPayArchiveYearFilter("");
      schoolBulkPayJustSavedRef.current = true;
      await fetchSchoolBulkPayArchives("");
      setActiveSidebarTab("Saved School Bulk Pay");
      triggerSuccess(
        `School bulk pay saved (${exported} payment${exported > 1 ? "s" : ""}, ₹${totalAmount.toLocaleString("en-IN")}). Saved file includes bank upload sheet and full partner payment rows — use Re-download or View Excel below. Remove the header row from the BulkPay sheet before bank upload.`
      );

      fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EXPORT_SCHOOL_AXIS_BULKPAY",
          target: `School Axis Bulk Pay: Exported partner disbursement file for ${selectedMonth} containing ${exported} payment records.`,
          details: {
            format: "XLS",
            month: selectedMonth,
            recordCount: exported,
            partnerIds,
            totalAmount,
            archiveId: saved.id,
          },
        }),
      })
        .then(() => fetchAuditLogs())
        .catch((err) => console.error("Audit log error:", err));
    } catch (err: any) {
      setErrorMessage(
        `School bulk pay file downloaded but could not be saved on server: ${err.message}`
      );
    } finally {
      setIsExportingSchoolBulkPay(false);
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

      // 5b. Daily Wage Filter
      const dailyWage = resolveEmployeeDailyWage(emp);
      if (salaryMinDailyWageFilter) {
        const minW = parseFloat(salaryMinDailyWageFilter);
        if (!isNaN(minW) && dailyWage < minW) {
          return false;
        }
      }
      if (salaryMaxDailyWageFilter) {
        const maxW = parseFloat(salaryMaxDailyWageFilter);
        if (!isNaN(maxW) && dailyWage > maxW) {
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
    salaryMinDailyWageFilter,
    salaryMaxDailyWageFilter,
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
    { name: "Dashboard", icon: LayoutDashboard, badge: "" },
    { name: "Role & Access", icon: Shield, badge: "" },
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
        { name: "Schools", tab: "Schools" },
        { name: "Monthly Billing", tab: "Monthly Billing" },
        { name: "Saved School Bulk Pay", tab: "Saved School Bulk Pay" },
        { name: "Expenses", tab: "Expenses" },
        { name: "Field Team", tab: "Field Team" },
      ],
    },
    {
      name: "Bids",
      icon: Gavel,
      badge: "New",
      children: [
        { name: "Tenders", tab: "Tenders" },
        { name: "Contracts", tab: "Contracts" },
      ],
    },
    {
      name: "Renewals",
      icon: RotateCw,
      badge: "New",
      children: [
        { name: "Car Papers", tab: "Car Papers" },
        { name: "IT Renewals", tab: "IT Renewals" },
        { name: "Licenses", tab: "Licenses" },
      ],
    },
    { name: "BG & DD", icon: Landmark, badge: "New" },
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

  const openAddSchoolForm = () => {
    setCurrentSchool(null);
    setIsSchoolFormOpen(true);
  };

  const openAddSupervisorForm = () => {
    setCurrentSupervisor(null);
    setIsSupervisorFormOpen(true);
  };

  const toggleSidebarGroup = (groupName: string) => {
    setExpandedSidebarGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const navigateToTab = (tabName: string) => {
    setActiveSidebarTab(tabName);
    if (window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  };


  return {
    authBootstrapping,
    isLoggedIn,
    sessionUser,
    sessionRole,
    sessionLocations,
    sessionPermissions,
    rolesList,
    isFetchingRoles,
    usernameInput,
    passwordInput,
    captchaInput,
    captchaRefreshKey,
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
    isLoggingIn,
    isSendingResetCode,
    isUpdatingPassword,
    adminsList,
    inviteUsername,
    invitePassword,
    inviteRole,
    inviteLocations,
    editingAdminUsername,
    editAdminRole,
    editAdminLocations,
    editAdminDisabled,
    editAdminNewPassword,
    editAdminPasswordError,
    editAdminPasswordSuccess,
    isResettingAdminPassword,
    inviteError,
    inviteSuccess,
    isFetchingAdmins,
    roleNameInput,
    roleDescInput,
    rolePermsInput,
    roleUiInput,
    roleError,
    roleSuccess,
    activePimSubTab,
    employeeListRoleFilter,
    employeeListStatusFilter,
    setEmployeeListStatusFilter,
    exitEligibleEmployees,
    exitEligibilityCheckedMonths,
    exitedEmployeesCount,
    isFetchingExitEligibility,
    showExitEligibleModal,
    setShowExitEligibleModal,
    fetchExitEligibility,
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
    myInfoTab,
    setMyInfoTab,
    roleAccessSection,
    setRoleAccessSection,
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
    locationPtEnabled,
    isFetchingLocations,
    newLocCompliance,
    newLocPtEnabled,
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
    salaryMinDailyWageFilter,
    salaryMaxDailyWageFilter,
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
    attendanceRecordFilter,
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
    updateLocationCompliance,
    updateLocationPtEnabled,
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
    handleDeleteLedgerItem,
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
    handleResetAdminPasswordSubmit,
    resetEditAdminPasswordFields,
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
    handleExportSchoolAxisBulkPay,
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
    openAddSchoolForm,
    showFlushAuditModal,
    closeFlushAuditModal,
    flushAuditPassword,
    setFlushAuditPassword,
    flushAuditError,
    isFlushingAuditLogs,
    bulkPayPreview,
    setBulkPayPreview,
    schoolBulkPayArchives,
    isFetchingSchoolBulkPayArchives,
    isExportingSchoolBulkPay,
    lastSavedSchoolBulkPay,
    highlightedSchoolBulkPayId,
    schoolBulkPayArchiveYearFilter,
    schoolBulkPayPreview,
    setSchoolBulkPayPreview,
    fetchSchoolBulkPayArchives,
    handleDownloadSchoolBulkPayArchive,
    handleDeleteSchoolBulkPayArchive,
    handleViewSchoolBulkPayArchive,
    schoolBulkPayArchiveYears,
    filteredSchoolBulkPayArchives,
    setSchoolBulkPayArchives,
    setIsFetchingSchoolBulkPayArchives,
    setIsExportingSchoolBulkPay,
    setLastSavedSchoolBulkPay,
    setHighlightedSchoolBulkPayId,
    setSchoolBulkPayArchiveYearFilter,
    registryLocations,
    registeredJobRoles,
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
    schoolDistricts,
    schoolBlocks,
    isSchoolGeographyLoading,
    schoolBulkEditDrafts,
    isSubmittingSchoolBulkEdit,
    handleSchoolBulkEditDraftChange,
    handleSchoolBulkEditDraftChangeMany,
    handleDiscardSchoolBulkEditDrafts,
    handleApplySchoolBulkEdit,
    partnerBulkEditDrafts,
    isSubmittingPartnerBulkEdit,
    handlePartnerBulkEditDraftChange,
    handlePartnerBulkEditDraftChangeMany,
    handleDiscardPartnerBulkEditDrafts,
    handleApplyPartnerBulkEdit,
    handleAddSchoolDistrict,
    handleUpdateSchoolDistrict,
    handleDeleteSchoolDistricts,
    handleAddSchoolBlock,
    handleUpdateSchoolBlock,
    handleDeleteSchoolBlocks,
    handleAddExpenseRecord,
    handleDeleteExpenseRecord,
    handleUpdateVisitStatus,
    handleBulkUpdateVisitStatus,
    handleRespondSupervisorRequest,
    handleCloseSupervisorRequest,
    handleResolveSupervisorEscalation,
    handleUpdateCommitmentDiary,
    handleGenerateSchoolBilling,
    handleSaveSchoolWorkdays,
    handleSavePartnerPayUpdates,
    handleSavePartnerPayDetails,
    handleSavePartnerPaymentStatus,
    fetchSchoolBillings,
    rawSchoolBillings,
    rawSchoolVisits,
    rawSupervisorRequests,
    rawCommitmentDiary,
    rawTenders,
    fetchTenders,
    handleCreateTender,
    handleUpdateTender,
    handleDeleteTender,
    handleImportTenders,
    rawContracts,
    fetchContracts,
    handleCreateContract,
    handleUpdateContract,
    handleDeleteContract,
    handleImportContracts,
    rawRenewals,
    fetchRenewals,
    handleCreateRenewal,
    handleUpdateRenewal,
    handleDeleteRenewal,
    handleImportRenewals,
    rawBgDdRecords,
    fetchBgDdRecords,
    handleCreateBgDdRecord,
    handleUpdateBgDdRecord,
    handleDeleteBgDdRecord,
    pendingSupervisorRequestCount,
    adminNotifications,
    adminNotificationUnreadCount,
    isFetchingAdminNotifications,
    fetchAdminNotifications,
    handleMarkAdminNotificationRead,
    handleMarkAllAdminNotificationsRead,
    handleAdminNotificationNavigate,
    fieldTeamView,
    setFieldTeamView,
    tenderDeadlineFilter,
    setTenderDeadlineFilter,
    rawSchoolPartners,
    rawSchoolSupervisors,
    isSupervisorFormOpen,
    setIsSupervisorFormOpen,
    currentSupervisor,
    setCurrentSupervisor,
    handleSaveSchoolSupervisor,
    handleDeleteSchoolSupervisor,
    openAddSupervisorForm,
    PERMISSION_MODULES,
    sidebarItems,
    filteredSidebarItems,
    activeModuleKey,
    isModuleAccessDenied,
    SALARY_HEADERS,
    userPermissions,
    userUiRestrictions,
    salaryUiRestrictions,
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
    setCaptchaInput,
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
    setEditAdminNewPassword,
    setEditAdminPasswordError,
    setEditAdminPasswordSuccess,
    setInviteError,
    setInviteSuccess,
    setIsFetchingAdmins,
    setRoleNameInput,
    setRoleDescInput,
    setRolePermsInput,
    setRoleUiInput,
    setRoleError,
    setRoleSuccess,
    setActivePimSubTab,
    setEmployeeListRoleFilter,
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
    setLocationPtEnabled,
    setIsFetchingLocations,
    setNewLocCompliance,
    setNewLocPtEnabled,
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
    setSalaryMinDailyWageFilter,
    setSalaryMaxDailyWageFilter,
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
    setAttendanceRecordFilter,
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
