/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Users, 
  UserPlus, 
  TrendingUp, 
  IndianRupee, 
  Map, 
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
  Download
} from "lucide-react";
import "./index.css";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Employee, EXCEL_ROW_HEADERS } from "./types";
import PasswordInput from "./components/PasswordInput";
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
} from "./utils";
import CsvImporter from "./components/CsvImporter";
import EmployeeTable from "./components/EmployeeTable";
import EmployeeFormModal from "./components/EmployeeFormModal";
import { parseApiError } from "./api";

const getCurrentFY = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed: April is 3
  if (month >= 3) {
    return `FY ${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `FY ${year - 1}-${String(year).slice(-2)}`;
  }
};

const getFinancialYears = () => {
  const today = new Date();
  const currentFY = getCurrentFY(today);
  const currentStartYear = parseInt(currentFY.substring(3, 7));
  
  const list = [];
  const startYear = Math.min(2025, currentStartYear - 1);
  const endYear = currentStartYear + 1; // current + 1 year for forward planning
  
  for (let y = startYear; y <= endYear; y++) {
    list.push(`FY ${y}-${String(y + 1).slice(-2)}`);
  }
  return list;
};

const MONTH_NAME_LIST = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getMonthsForFY = (fyStr: string) => {
  const list: string[] = [];
  const trimmed = (fyStr || "").trim();
  let startYear = NaN;

  // Header year selector uses "2025-2026"; legacy helpers used "FY 2025-26".
  if (/^\d{4}-\d{4}$/.test(trimmed)) {
    startYear = parseInt(trimmed.split("-")[0], 10);
  } else {
    startYear = parseInt(trimmed.substring(3, 7), 10);
  }
  if (!Number.isFinite(startYear)) {
    startYear = new Date().getFullYear();
  }

  // April of startYear to December of startYear
  for (let m = 3; m < 12; m++) {
    list.push(`${MONTH_NAME_LIST[m]} ${startYear}`);
  }
  // January of startYear+1 to March of startYear+1
  for (let m = 0; m < 3; m++) {
    list.push(`${MONTH_NAME_LIST[m]} ${startYear + 1}`);
  }
  return list;
};

const getCalendarYearFromFYRange = (monthName: string, fyRange: string): string => {
  const years = fyRange.split("-");
  const startYear = years[0];
  const endYear = years[1] || String(parseInt(startYear) + 1);
  const endMonthNames = ["January", "February", "March"];
  if (endMonthNames.includes(monthName)) {
    return endYear;
  }
  return startYear;
};

/** Ensure payroll month keys always use "Month YYYY" (fixes broken selects from stale localStorage). */
const normalizeMonthKey = (monthStr: string | null | undefined): string => {
  const today = new Date();
  const fallback = `${MONTH_NAME_LIST[today.getMonth()]} ${today.getFullYear()}`;
  if (!monthStr || typeof monthStr !== "string") return fallback;

  const parts = monthStr.trim().split(/\s+/);
  if (parts.length < 2) return fallback;

  const monthName = parts[0];
  const year = parseInt(parts[parts.length - 1], 10);
  if (MONTH_NAME_LIST.indexOf(monthName) === -1 || !Number.isFinite(year)) return fallback;

  return `${monthName} ${year}`;
};

const safeNumber = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Sidebar Menu Configuration
interface SidebarItemDef {
  name: string;
  icon: React.ComponentType<any>;
  badge: string;
}

const isEmployeeExitedGeneral = (emp: Employee) => {
  if (emp.exitDate && emp.exitDate.trim() !== "") return true;
  if (emp.customFields && Array.isArray(emp.customFields)) {
    const exitField = emp.customFields.find(f => 
      f.name.toLowerCase().includes("exit") || 
      f.name.toLowerCase().includes("resignation") || 
      f.name.toLowerCase().includes("leaving_date") ||
      f.name.toLowerCase().includes("leaving date")
    );
    if (exitField && exitField.value && exitField.value.trim() !== "") return true;
  }
  return false;
};

const isEmployeeExitedOnDayStatic = (emp: Employee, monthStr: string, dayNum: number) => {
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
  
  if (!exitDateVal || exitDateVal.trim() === "") return false;
  
  const exitParts = exitDateVal.split("-");
  if (exitParts.length !== 3) return false;
  const exitYear = parseInt(exitParts[0], 10);
  const exitMonth = parseInt(exitParts[1], 10);
  const exitDay = parseInt(exitParts[2], 10);
  
  const monthParts = monthStr.split(" ");
  if (monthParts.length !== 2) return false;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const targetMonthIndex = monthNames.indexOf(monthParts[0]);
  const targetYear = parseInt(monthParts[1], 10);
  
  if (targetMonthIndex === -1 || isNaN(targetYear)) return false;
  const targetMonthNum = targetMonthIndex + 1;
  
  if (targetYear > exitYear) return true;
  if (targetYear === exitYear && targetMonthNum > exitMonth) return true;
  if (targetYear === exitYear && targetMonthNum === exitMonth && dayNum > exitDay) return true;
  
  return false;
};

const isEmployeeExitedForMonth = (emp: Employee, monthStr: string) => {
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
  
  if (!exitDateVal || exitDateVal.trim() === "") return false;
  
  const exitParts = exitDateVal.split("-");
  if (exitParts.length !== 3) return false;
  const exitYear = parseInt(exitParts[0], 10);
  const exitMonth = parseInt(exitParts[1], 10);
  
  const monthParts = monthStr.split(" ");
  if (monthParts.length !== 2) return false;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const targetMonthIndex = monthNames.indexOf(monthParts[0]);
  const targetYear = parseInt(monthParts[1], 10);
  
  if (targetMonthIndex === -1 || isNaN(targetYear)) return false;
  const targetMonthNum = targetMonthIndex + 1;
  
  if (targetYear > exitYear) return true;
  if (targetYear === exitYear && targetMonthNum > exitMonth) return true;
  
  return false;
};

const getDaysInMonthStatic = (monthStr: string) => {
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

const getSalaryColumnValue = (
  emp: Employee,
  col: string,
  month: string,
  esicEligibilityLimit: number,
  attendanceDb?: any,
  locationComplianceMap: Record<string, boolean> = {},
  locationPtMap: Record<string, number> = {}
) => {
  let presents = 0;
  let daysInMonth = 30;
  
  if (attendanceDb && month) {
    daysInMonth = getDaysInMonthStatic(month);
    const monthData = attendanceDb[month] || {};
    const empData = monthData[emp.id] || {};
    for (let i = 1; i <= daysInMonth; i++) {
      if (isEmployeeExitedOnDayStatic(emp, month, i)) {
        continue;
      }
      if (empData[i] === "P") {
        presents++;
      }
    }
  }

  const rawGross = safeNumber(emp.grossSalary);
  const rawBasic = safeNumber(emp.basicSalary);
  const empMonthAttendance = attendanceDb && month ? (attendanceDb[month]?.[emp.id] || {}) : {};

  const gross = attendanceDb
    ? prorateSalaryByAttendance(rawGross, daysInMonth, presents, empMonthAttendance)
    : rawGross;
  const basic = attendanceDb
    ? prorateSalaryByAttendance(rawBasic, daysInMonth, presents, empMonthAttendance)
    : rawBasic;

  const isLocCompliant = emp.location ? !!locationComplianceMap[emp.location] : false;
  const isEmpCompliant = emp.complianceEnabled !== false;
  const isCompliant = isLocCompliant && isEmpCompliant;

  const { employeePf: empPf, employerPf: erPf } = calculatePfAmounts(gross, {
    mode: emp.pfCalculationMode,
    isCompliant,
  });
  const isEsicCovered = isEmployeeEsicCovered(gross, esicEligibilityLimit, isCompliant, emp.esic);
  const erEsic = isEsicCovered ? (gross * 0.0325) : 0;
  const empEsic = isEsicCovered ? (gross * 0.0075) : 0;
  const pt = calculateProfessionalTax(gross, {
    isCompliant,
    locationPtAmount: resolveLocationPtAmount(emp.location, locationPtMap),
  });
  
  const ledger = emp.monthlyLedger?.[month];
  const adv = ledger ? safeNumber(ledger.advance) : 0;
  const pen = ledger ? safeNumber(ledger.penalty) : 0;
  const uniform = ledger ? safeNumber(ledger.uniform) : 0;
  const food = ledger ? safeNumber(ledger.foodPerk) : 0;
  const acc = ledger ? safeNumber(ledger.accommodationPerk) : 0;
  const conv = ledger ? safeNumber(ledger.conveyancePerk) : 0;
  
  const netSalaryVal = safeNumber(gross) - safeNumber(empPf) - safeNumber(empEsic) - safeNumber(pt);
  const totalDeductionsVal = safeNumber(empPf) + safeNumber(empEsic) + safeNumber(pt) + safeNumber(adv) + safeNumber(pen) + safeNumber(uniform);
  const netPayableVal = safeNumber(netSalaryVal) - safeNumber(adv) - safeNumber(pen) - safeNumber(uniform) + safeNumber(food) + safeNumber(acc) + safeNumber(conv);

  switch (col) {
    case "Employee Code":
      return emp.employeeCode;
    case "Employee Name":
      return emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "";
    case "Skill Category":
      return normalizeSkillCategory(emp.skillCategory) || "";
    case "Job Role":
      return emp.role || "";
    case "Present Days":
      return attendanceDb ? presents : 0;
    case "Total Salary":
      return rawGross;
    case "Gross Salary (Monthly)":
      return gross;
    case "Basic Salary":
      return basic;
    case "Employer PF (13%)":
      return isCompliant ? Math.round(erPf) : "";
    case "Employer ESIC (3.25%)":
      return isCompliant ? Math.round(erEsic) : "";
    case "Employee PF (12%)":
      return isCompliant ? Math.round(empPf) : "";
    case "Employee ESIC (0.75%)":
      return isCompliant ? Math.round(empEsic) : "";
    case "Professional Tax (PT)":
      return isCompliant ? pt : "";
    case "Advance Balance":
      return adv;
    case "Uniform Deductions":
      return uniform;
    case "Penalty Balance":
      return pen;
    case "Net Salary":
      return Math.round(netSalaryVal);
    case "Total Deductions":
      return Math.round(totalDeductionsVal);
    case "Food Perk":
      return food;
    case "Accommodation Perk":
      return acc;
    case "Conveyance Perk":
      return conv;
    case "Net Payable":
      return Math.round(Math.max(0, netPayableVal));
    case "Payment Status":
      return ledger?.paymentStatus || "Unpaid";
  }
};

const getModuleKey = (tabName: string): string => {
  switch (tabName) {
    case "Admin": return "admin";
    case "Audit Logs": return "admin";
    case "Employees": return "employees";
    case "Salary": return "salary";
    case "Saved Bulk Pay": return "salary";
    case "Advance & Penalty": return "ledger";
    case "Leave": return "leave";
    case "Attendance": return "attendance";
    case "Directory": return "directory";
    case "Birthdays": return "birthdays";
    default: return "";
  }
};

export default function App() {
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



  const PERMISSION_MODULES = ["employees", "salary", "ledger", "attendance", "leave", "birthdays", "directory", "admin"] as const;

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
  const [activeSidebarTab, setActiveSidebarTab] = useState("Employees");
  const [activePimSubTab, setActivePimSubTab] = useState("Employee List");
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

  // Employee Registry Core States
  const [rawEmployees, setRawEmployees] = useState<Employee[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Configuration States (Fully interactive!)
  const [esicEligibilityLimit, setEsicEligibilityLimit] = useState(21000);
  const [basicSalaryPercentage, setBasicSalaryPercentage] = useState(50);
  const [companyBranch, setCompanyBranch] = useState("Corporate HQ, Mumbai");

  // Custom locations list with sync and edit capabilities
  const [rawCustomLocations, setRawCustomLocations] = useState<string[]>([]);
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

  const fetchLocations = useCallback(async () => {
    setIsFetchingLocations(true);
    try {
      const res = await fetch("/api/locations");
      if (!res.ok) throw await parseApiError(res, "Failed to fetch locations.");
      const data = await res.json();
      const locationRecords = Array.isArray(data) ? data : [];
      const apiLocations = locationRecords.map((loc: any) => loc.name).filter(Boolean);
    const empLocations = rawEmployees.map((e) => e.location).filter(Boolean) as string[];
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
  const [isFetchingJobRoles, setIsFetchingJobRoles] = useState(false);

  const fetchJobRoles = useCallback(async () => {
    setIsFetchingJobRoles(true);
    try {
      const res = await fetch("/api/job-roles");
      if (!res.ok) throw await parseApiError(res, "Failed to fetch job roles.");
      const data = await res.json();
      const apiRoles = Array.isArray(data) ? data.map((role: any) => role.name).filter(Boolean) : [];
      const empRoles = rawEmployees.map(e => e.role).filter(Boolean) as string[];
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

  const [bulkPayArchives, setBulkPayArchives] = useState<any[]>([]);
  const [isFetchingBulkPayArchives, setIsFetchingBulkPayArchives] = useState(false);
  const [isExportingBulkPay, setIsExportingBulkPay] = useState(false);
  const [lastSavedBulkPay, setLastSavedBulkPay] = useState<any | null>(null);
  const [highlightedBulkPayId, setHighlightedBulkPayId] = useState<string | null>(null);
  const [bulkPayArchiveYearFilter, setBulkPayArchiveYearFilter] = useState("");

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
      if (!res.ok) throw new Error("Download failed.");
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

  const handleDeleteBulkPayArchive = async (id: string) => {
    if (!window.confirm("Delete this archived bulk pay file from the server?")) return;
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
    if (!bulkPayArchiveYearFilter) return bulkPayArchives;
    return bulkPayArchives.filter((item: any) => {
      const year = item.year || parseMonthYear(item.month).year;
      return year === bulkPayArchiveYearFilter;
    });
  }, [bulkPayArchives, bulkPayArchiveYearFilter]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogsList.filter((log: any) => {
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
    });
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
      const sorted = Array.isArray(data) ? [...data].reverse() : [];
      setAuditLogsList(sorted);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Could not load security audit trail.");
    } finally {
      setIsFetchingAuditLogs(false);
    }
  };

  // Flush / Clear Audit Logs (Root admin only — verified server-side via session)
  const handleFlushAuditLogs = async () => {
    if (!window.confirm("🔴 DANGER ZONE: Are you absolutely sure you want to permanently clear/flush ALL security audit trail logs? This action is irreversible and audit trail payload records will be lost forever.")) {
      return;
    }
    setErrorMessage(null);
    try {
      const res = await fetch("/api/audit-logs", {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to flush audit logs");
      }
      triggerSuccess("Security audit trail flushed successfully!");
      fetchAuditLogs();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to clear logs.");
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
      fetchBulkPayArchives();
    }
  }, [isLoggedIn, activeSidebarTab, userPermissions.salary?.view]);

  // Handler to add a new custom location from the configuration tab
  const handleAddLocationFromConfig = async (locName: string, complianceVal: boolean = true, ptAmount?: number) => {
    const cleanName = locName.trim();
    if (!cleanName) return;
    
    if (rawCustomLocations.some(l => l.toLowerCase() === cleanName.toLowerCase())) {
      triggerSuccess(`Location "${cleanName}" already exists.`);
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
  const [birthdaySearchMonth, setBirthdaySearchMonth] = useState("May");
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
    if (!window.confirm(`Are you sure you want to delete the helpline "${nameToDelete}"?`)) return;
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
  const [confirmClearState, setConfirmClearState] = useState<{ empId: string, type: string } | null>(null);
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
        roles: reportRoleFilters
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
      
      setActiveReportTemplateName(name);
      triggerSuccess(`Loaded report template layout: "${name}"`);
    }
  };

  const handleDeleteReportTemplate = async (name: string) => {
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
      
    if (!window.confirm(confirmMsg)) return;

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
      triggerSuccess(`Role "${cleanName}" already exists.`);
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
      
    if (!window.confirm(confirmMsg)) return;

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
    const isConfirming = confirmClearState?.empId === empId && confirmClearState?.type === type;
    if (isConfirming) {
      return (
        <div className="flex flex-col items-start gap-1 bg-red-50 p-2 border border-red-200 rounded-lg mt-1 shadow-sm w-[180px] z-10 relative delete-confirm-popover">
          <span className="text-[9.5px] text-red-650 font-black leading-tight">Are you sure you want to delete?</span>
          <div className="flex gap-1.5 w-full justify-between mt-1">
            <button
              type="button"
              onClick={() => {
                handleClearLedgerValue(empId, type);
                setConfirmClearState(null);
              }}
              className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[8.5px] font-black uppercase tracking-wider cursor-pointer"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmClearState(null)}
              className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[8.5px] font-black uppercase tracking-wider cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-start">
        <span className={`font-semibold ${colorClass}`}>₹{currentVal.toLocaleString("en-IN")}</span>
        <button
          type="button"
          onClick={() => setConfirmClearState({ empId, type })}
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
    if (!window.confirm(`Are you sure you want to mark salary status as "${status}" for the ${selectedSalaryEmployeeIds.length} selected employees?`)) return;

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
    setActiveDialerContact({ name, phone, role });
    setActiveDialerStatus("ringing");
    try {
      window.location.href = `tel:${phone}`;
    } catch (e) {}
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
  const [reportSkillFilters, setReportSkillFilters] = useState<string[]>([]);
  const [reportRoleFilters, setReportRoleFilters] = useState<string[]>([]);
  const [isReportLocDropdownOpen, setIsReportLocDropdownOpen] = useState(false);
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const reportLocationExportLabel =
    reportLocFilters.length === 0 ? "All Locations" : reportLocFilters.join(", ");
  const [reportSearchQuery, setReportSearchQuery] = useState<string>("");
  const [selectedReportEmployeeIds, setSelectedReportEmployeeIds] = useState<string[]>([]);

  // Dynamic report matching resolver
  const filteredReportEmployees = useMemo(() => {
    return employees.filter(emp => {
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
        if ((emp.esic || "").toLowerCase() !== reportEsicFilter.toLowerCase()) {
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
    reportSkillFilters,
    reportRoleFilters,
    reportSearchQuery
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


  useEffect(() => {
    if (isLoggedIn) {
      fetchEmployees();
      fetchRoles();
      fetchExportTemplates();
    }
  }, [isLoggedIn]);

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
      if (confirmClearState && !target.closest(".delete-confirm-popover")) {
        setConfirmClearState(null);
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
    confirmClearState
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
      setForgotError("Please enter your username.");
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
    if (!confirm(`Are you sure you want to delete the custom role "${name}"?`)) return;
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
  const handleSaveEmployee = async (empData: Partial<Employee>): Promise<boolean> => {
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

      await fetchEmployees();
      triggerSuccess(
        isEdit 
          ? `Successfully saved changes for employee "${empData.employeeCode}"` 
          : `Successfully onboarded employee "${empData.employeeCode}" into registry`
      );
      return true;
    } catch (err: any) {
      setErrorMessage("Onboarding Save Refused: " + err.message);
      return false;
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

  // Single Delete Tracker
  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm(`Are you sure you want to permanently remove employee "${id}"?`)) return;
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

  // Bulk Selection Delete Trigger
  const handleBulkDelete = async (ids: string[]) => {
    if (!window.confirm(`WARNING: You are about to permanently DELETE ${ids.length} selected employees. Continue?`)) return;
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
      const proceed = window.confirm(
        `${missingBank.length} selected employee(s) are missing bank account or name-as-per-bank and will be skipped. Continue?`
      );
      if (!proceed) return;
    }

    const filename = buildAxisBulkPayFilename(selectedMonth);
    const { exported, totalAmount, fileBase64 } = downloadAxisBulkPayXls(
      buildAxisBulkPayItems(selectedEmployees),
      { debitAccountNo },
      filename
    );

    if (exported === 0) {
      alert("No valid bank payment rows to export. Ensure employees have bank details and net payable > 0.");
      return;
    }

    const { month: payMonth, year: payYear } = parseMonthYear(selectedMonth);
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
      setLastSavedBulkPay(saved);
      setHighlightedBulkPayId(saved.id);
      setBulkPayArchiveYearFilter(payYear);
      await fetchBulkPayArchives(payYear);
      setActiveSidebarTab("Saved Bulk Pay");
      triggerSuccess(
        `Bulk pay saved (${exported} payment${exported > 1 ? "s" : ""}, ₹${totalAmount.toLocaleString("en-IN")}). Use Re-download or Delete below. Remove the header row before bank upload.`
      );
    } catch (err: any) {
      setErrorMessage(
        `Bulk pay file downloaded but could not be saved on server: ${err.message}`
      );
    } finally {
      setIsExportingBulkPay(false);
    }

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
        },
      }),
    })
      .then(() => fetchAuditLogs())
      .catch((err) => console.error("Audit log error:", err));
  };

  // Export selected row items back into matching formatted patterns (CSV, Excel, or PDF)
  const handleExportSelected = (exportType: "csv" | "excel" | "pdf" | "bulkpay", ids: string[]) => {
    if (exportType === "bulkpay") {
      handleExportAxisBulkPay(ids);
      return;
    }
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
    { name: "Birthdays", icon: Cake, badge: "Gift" }
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

  // --- Authentication Login Layout Mode ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden" id="login-layout">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100 rounded-full filter blur-3xl opacity-50 -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 rounded-full filter blur-3xl opacity-50 -ml-20 -mb-20"></div>

        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative z-10 animate-fade-in" id="login-card-container">
          <div className="p-8 border-b border-slate-100 bg-[#fbfbfb] text-center">
            {/* FlexHRM stylized logo */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff791a] to-[#ff981a] flex items-center justify-center text-white font-black text-2xl shadow-md transform rotate-12">
                F
              </div>
              <div className="text-left leading-none">
                <span className="text-slate-800 font-extrabold text-xl tracking-tight block">Flex <span className="text-[#ff791a]" id="logo-orange-text">HRM</span></span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mt-0.5">an Intelligic product</span>
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {loginView === "signin" && "Onboarding Portal Login"}
              {loginView === "forgot" && "Forgot Password"}
              {loginView === "reset" && "Reset Password"}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {loginView === "signin" && "Provide your credentials to access the bulk HRMS database"}
              {loginView === "forgot" && "Enter your username to receive a one-time reset code"}
              {loginView === "reset" && "Enter your reset code and choose a new password"}
            </p>
          </div>

          {loginView === "signin" && (
          <form onSubmit={handleLoginSubmit} className="p-8 space-y-4" id="login-credentials-form">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex gap-2 items-center animate-shake" id="login-error-toast">
                <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px]">🚩</span>
                <span className="font-semibold">{loginError}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-username-field" className="text-xs font-bold text-slate-600 block mb-1">Username</label>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. admin"
                className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition"
                id="login-username-field"
              />
            </div>

            <div>
              <label htmlFor="login-password-field" className="text-xs font-bold text-slate-600 block mb-1">Password</label>
              <PasswordInput
                name="password"
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition font-mono"
                id="login-password-field"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input id="login-keep-logged-in" name="keepLoggedIn" type="checkbox" className="rounded text-[#ff791a] focus:ring-[#ff791a] w-3.5 h-3.5" defaultChecked />
                <span className="text-xs text-slate-500">Keep me logged in</span>
              </label>
              <button
                type="button"
                className="text-xs text-[#ff791a] hover:underline font-semibold cursor-pointer"
                onClick={openForgotPassword}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-md shadow-orange-500/20 active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer"
              id="login-submit-button"
            >
              Sign In
            </button>
          </form>
          )}

          {loginView === "forgot" && (
          <form onSubmit={handleForgotPasswordSubmit} className="p-8 space-y-4" id="forgot-password-form">
            {forgotError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex gap-2 items-center animate-shake">
                <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px]">🚩</span>
                <span className="font-semibold">{forgotError}</span>
              </div>
            )}
            {forgotMessage && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-xs font-semibold">
                {forgotMessage}
              </div>
            )}

            <div>
              <label htmlFor="forgot-username-field" className="text-xs font-bold text-slate-600 block mb-1">Username</label>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={forgotUsername}
                onChange={(e) => setForgotUsername(e.target.value)}
                placeholder="Enter your administrator username"
                className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition"
                id="forgot-username-field"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-md shadow-orange-500/20 active:scale-98 transition cursor-pointer"
            >
              Send Reset Code
            </button>

            <button
              type="button"
              onClick={backToSignIn}
              className="w-full py-2 text-slate-500 hover:text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
            >
              ← Back to Sign In
            </button>
          </form>
          )}

          {loginView === "reset" && (
          <form onSubmit={handleResetPasswordSubmit} className="p-8 space-y-4" id="reset-password-form">
            {resetError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs flex gap-2 items-center animate-shake">
                <span className="p-1 bg-rose-100 text-rose-800 rounded-full text-[10px]">🚩</span>
                <span className="font-semibold">{resetError}</span>
              </div>
            )}
            {resetSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-xs font-semibold">
                {resetSuccess}
              </div>
            )}
            {issuedResetToken && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-900 text-xs">
                <span className="font-bold block mb-1">Your reset code (valid 15 minutes):</span>
                <span className="font-mono text-lg tracking-widest font-black">{issuedResetToken}</span>
              </div>
            )}

            <div>
              <label htmlFor="reset-username-field" className="text-xs font-bold text-slate-600 block mb-1">Username</label>
              <input
                type="text"
                name="username"
                value={forgotUsername || usernameInput}
                onChange={(e) => setForgotUsername(e.target.value)}
                readOnly={!!issuedResetToken}
                className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition disabled:bg-slate-50"
                id="reset-username-field"
              />
            </div>

            <div>
              <label htmlFor="reset-token-field" className="text-xs font-bold text-slate-600 block mb-1">Reset Code</label>
              <input
                type="text"
                name="resetToken"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={resetTokenInput}
                onChange={(e) => setResetTokenInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition font-mono tracking-widest"
                id="reset-token-field"
              />
            </div>

            <div>
              <label htmlFor="reset-new-password-field" className="text-xs font-bold text-slate-600 block mb-1">New Password</label>
              <PasswordInput
                name="newPassword"
                autoComplete="new-password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition font-mono"
                id="reset-new-password-field"
              />
            </div>

            <div>
              <label htmlFor="reset-confirm-password-field" className="text-xs font-bold text-slate-600 block mb-1">Confirm New Password</label>
              <PasswordInput
                name="confirmNewPassword"
                autoComplete="new-password"
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2 border border-slate-250 rounded-lg focus:border-[#ff791a] focus:outline-none text-xs text-slate-800 transition font-mono"
                id="reset-confirm-password-field"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-md shadow-orange-500/20 active:scale-98 transition cursor-pointer"
            >
              Update Password
            </button>

            <button
              type="button"
              onClick={() => setLoginView("forgot")}
              className="w-full py-2 text-slate-500 hover:text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
            >
              ← Request a new code
            </button>
          </form>
          )}

          <div className="p-4 bg-slate-50/70 border-t border-slate-100 text-center text-[10px] text-slate-400">
            🔒 Secured locally. CSV layout compatibility verification enabled.
          </div>
        </div>
      </div>
    );
  }

  // --- Main Full-Screen Layout Mode with LHS Sidebar + Top Header + Employees Submenu ---
  return (
    <div className="h-screen max-h-screen bg-slate-100/70 text-slate-800 font-sans flex flex-row overflow-hidden" id="management-shell">
      
      {/* Sidebar Backdrop overlay on mobile viewports */}
      {!isSidebarCollapsed && (
        <div 
          onClick={() => setIsSidebarCollapsed(true)} 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          id="sidebar-backdrop"
        />
      )}

      {/* 1. LEFT HAND SIDEBAR - Exact OrangeHRM Style */}
      <aside 
        className={`bg-white border-r border-slate-200 shrink-0 select-none flex flex-col fixed md:sticky top-0 h-screen transition-all duration-300 z-50 ${
          isSidebarCollapsed 
            ? "-translate-x-full md:translate-x-0 md:w-16" 
            : "translate-x-0 w-64 shadow-xl md:shadow-none"
        }`} 
        id="sidebar-container"
      >
        {/* Collapse arrow toggle overlay */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute top-1/2 -right-3 transform -translate-y-1/2 bg-[#ff791a] hover:bg-[#e4640c] text-white rounded-full p-0.5 border border-white cursor-pointer shadow z-40 hidden md:block"
          id="sidebar-toggle-overlay-btn"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Sidebar Header branding */}
        <div className="p-4 border-b border-slate-150 bg-white flex items-center gap-2.5 overflow-hidden" id="sidebar-header">
          <div className="w-8 h-8 rounded-lg bg-[#ff791a] flex items-center justify-center text-white font-bold text-lg shrink-0 shadow animate-pulse">
            F
          </div>
          {!isSidebarCollapsed && (
            <div className="text-left leading-none animate-fade-in">
              <span className="text-slate-800 font-extrabold tracking-tight block">Flex <span className="text-[#ff791a]">HRM</span></span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5 truncate max-w-full">an Intelligic product</span>
            </div>
          )}
        </div>

        {/* Sidebar Options Search Box */}
        {!isSidebarCollapsed ? (
          <div className="p-3 border-b border-slate-50" id="sidebar-search-box">
            <div className="relative">
              <input id="sidebar-search" name="sidebarSearch"
                type="text"
                placeholder="Search..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 transition"
              />
              <span className="absolute left-2.5 top-2 text-slate-400"><Search size={12} /></span>
            </div>
          </div>
        ) : (
          <div className="py-2 flex justify-center border-b border-slate-50">
            <span className="p-2 text-slate-400 bg-slate-50 rounded-full" title="Type to search in full view"><Search size={14} /></span>
          </div>
        )}

        {/* Sidebar Links Menu items */}
        <nav className="p-2 py-3 space-y-1 overflow-y-auto flex-1 scrollbar-thin" id="sidebar-navigation">
          {filteredSidebarItems.map((item) => {
            const IconComponent = item.icon;
            const isSelected = activeSidebarTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveSidebarTab(item.name);
                  triggerSuccess(`Switched module view to: ${item.name}`);
                  if (window.innerWidth < 768) {
                    setIsSidebarCollapsed(true);
                  }
                }}
                className={`w-full flex items-center text-left px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  isSelected 
                    ? "bg-[#ff791a] text-white shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#ff791a]"
                }`}
                id={`sidebar-tab-${item.name.toLowerCase()}`}
              >
                <span className={`shrink-0 ${isSelected ? "text-white" : "text-slate-400"}`}>
                  <IconComponent size={16} />
                </span>
                {!isSidebarCollapsed && (
                  <span className="ml-3 truncate flex-1 flex items-center justify-between animate-fade-in">
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                        isSelected ? "bg-white/20 text-white" : "bg-orange-50 text-orange-600"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer details */}
        {!isSidebarCollapsed && (
          <div className="p-3 border-t border-slate-150 bg-slate-50 text-[10px] text-slate-400 text-center space-y-1" id="sidebar-footer">
            <p className="font-bold">v3.5.24 EE Cloud</p>
            <p className="truncate">Node Dev Environment Active</p>
          </div>
        )}
      </aside>

      {/* 2. RIGHT HAND MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col overflow-hidden" id="main-content-layout">
        
        {/* TOP ORANGE HEADER BAR - OrangeHRM Classic Banner Style */}
        <header className="bg-gradient-to-r from-[#ff791a] to-[#ff981a] px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between text-white shrink-0 shadow-md sticky top-0 z-40 gap-2.5 md:gap-4" id="main-top-banner">
          {/* Top row: Hamburger + Title on left, Profile dropdown on right (on mobile) */}
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="flex items-center gap-2.5">
              {/* Hamburger button for mobile drawer or trigger toggle (hidden on desktop) */}
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                className="md:hidden p-1.5 bg-white/10 hover:bg-white/20 rounded text-white mr-1 transition cursor-pointer"
                id="hamburger-btn"
              >
                <Menu size={18} />
              </button>
              
              <div>
                <span className="text-[8px] uppercase tracking-widest font-black text-orange-100 opacity-90 block">
                  {activeSidebarTab} Module
                </span>
                <h1 className="text-sm md:text-lg font-black tracking-tight flex items-center gap-2" id="top-banner-title">
                  {activeSidebarTab === "Employees" ? "Employees" : activeSidebarTab}
                </h1>
              </div>
            </div>

            {/* Mobile Profile Dropdown (visible only on mobile) */}
            <div className="md:hidden relative shrink-0" ref={mobileProfileDropdownRef}>
              <button
                onClick={() => setIsMobileProfileOpen(!isMobileProfileOpen)}
                className="flex items-center gap-1.5 p-1 px-2.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/15 transition cursor-pointer"
                id="mobile-top-profile-selector"
              >
                <div className="w-6 h-6 rounded-full bg-orange-100 text-[#ff791a] flex items-center justify-center font-bold text-xs ring-2 ring-white/20 shrink-0">
                  {sessionUser.charAt(0).toUpperCase()}
                </div>
                <ChevronDown size={10} className={`transition duration-200 ${isMobileProfileOpen ? "rotate-180" : ""}`} />
              </button>

              {isMobileProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 font-medium animate-fade-in" id="mobile-profile-dropdown-wrapper">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Access Clearance</p>
                    <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{sessionUser}</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileProfileOpen(false);
                      setActiveSidebarTab("My Info");
                      triggerSuccess("Opened administrator account profile.");
                      setIsSidebarCollapsed(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
                  >
                    <UserCircle size={14} className="text-slate-400" />
                    My Account Profile
                  </button>
                  <button
                    onClick={() => {
                      triggerSuccess("Opened configuration mappings.");
                      setIsMobileProfileOpen(false);
                      setActiveSidebarTab("Employees");
                      setActivePimSubTab("Configuration");
                      setIsSidebarCollapsed(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
                  >
                    <Settings size={14} className="text-slate-400" />
                    Portal Settings
                  </button>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-red-50 text-left text-xs text-rose-600 font-bold transition"
                    id="mobile-logout-dropdown-btn"
                  >
                    <LogOut size={14} className="text-rose-500" />
                    Sign Out / Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-2.5 border-t border-white/10 pt-2 md:border-t-0 md:pt-0">
            {/* Universal Month & Year Selectors */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              {/* Universal Month Dropdown */}
              <div className="flex items-center gap-1 bg-white/10 hover:bg-white/20 rounded-full border border-white/15 px-2 py-1 md:px-3 md:py-1.5 transition flex-1 md:flex-initial justify-center md:justify-start">
                <Calendar size={12} className="text-orange-100 shrink-0" />
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-orange-100/90">Month:</span>
                <select id="active-month-name" name="activeMonthName"
                  value={activeMonthName}
                  onChange={(e) => {
                    const newMonth = e.target.value;
                    const calendarYear = getCalendarYearFromFYRange(newMonth, activeFYRange);
                    setSelectedMonth(`${newMonth} ${calendarYear}`);
                  }}
                  className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1 border-0"
                  title="Select Active Month"
                >
                  {[
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                  ].map(m => (
                    <option key={m} value={m} className="text-slate-800 font-bold">{m}</option>
                  ))}
                </select>
              </div>

              {/* Universal Year Dropdown */}
              <div className="flex items-center gap-1 bg-white/10 hover:bg-white/20 rounded-full border border-white/15 px-2 py-1 md:px-3 md:py-1.5 transition flex-1 md:flex-initial justify-center md:justify-start">
                <Calendar size={12} className="text-orange-100 shrink-0" />
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-orange-100/90">Year:</span>
                <select id="active-fyrange" name="activeFYRange"
                  value={activeFYRange}
                  onChange={(e) => {
                    const newFYRange = e.target.value;
                    const calendarYear = getCalendarYearFromFYRange(activeMonthName, newFYRange);
                    setSelectedMonth(`${activeMonthName} ${calendarYear}`);
                  }}
                  className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1 border-0"
                  title="Select Active Year"
                >
                  {["2022-2023", "2023-2024", "2024-2025", "2025-2026", "2026-2027", "2027-2028", "2028-2029", "2029-2030"].map(fy => (
                    <option key={fy} value={fy} className="text-slate-800 font-bold">{fy}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Desktop Profile Dropdown with Logout (Hidden on mobile) */}
            <div className="hidden md:block relative" ref={profileDropdownRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2.5 p-1 px-2.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/15 transition cursor-pointer"
                id="top-profile-selector"
              >
                <div className="w-7 h-7 rounded-full bg-orange-100 text-[#ff791a] flex items-center justify-center font-bold text-xs ring-2 ring-white/20 shrink-0">
                  {sessionUser.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:inline text-xs font-bold font-medium tracking-tight whitespace-nowrap">
                  {sessionUser}
                </span>
                <ChevronDown size={12} className={`transition duration-200 ${isProfileOpen ? "rotate-180" : ""}`} />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 font-medium animate-fade-in" id="profile-dropdown-wrapper">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Access Clearance</p>
                    <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{sessionUser}</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      setActiveSidebarTab("My Info");
                      triggerSuccess("Opened administrator account profile.");
                      if (window.innerWidth < 768) {
                        setIsSidebarCollapsed(true);
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
                  >
                    <UserCircle size={14} className="text-slate-400" />
                    My Account Profile
                  </button>
                  <button
                    onClick={() => {
                      triggerSuccess("Opened configuration mappings.");
                      setIsProfileOpen(false);
                      setActiveSidebarTab("Employees");
                      setActivePimSubTab("Configuration");
                      if (window.innerWidth < 768) {
                        setIsSidebarCollapsed(true);
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left text-xs text-slate-700 transition"
                  >
                    <Settings size={14} className="text-slate-400" />
                    Portal Settings
                  </button>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-red-50 text-left text-xs text-rose-600 transition font-bold"
                    id="logout-dropdown-btn"
                  >
                    <LogOut size={14} className="text-rose-500" />
                    Sign Out / Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. Employees SUB-HEADER BAND (Like OrangeHRM: Configuration, Employee List, Add Employee, Reports) */}
        {activeSidebarTab === "Employees" && (
          <div className="bg-white border-b border-slate-200 px-6 py-1.5 flex items-center gap-2 shrink-0 overflow-x-auto select-none relative z-30" id="pim-sub-menu-band">
            {["Configuration", "Employee List", "Add Employee", "Reports"].map((tab) => {
              const isActive = activePimSubTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => handlePimSubTabClick(tab)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isActive 
                      ? "bg-orange-50 text-[#ff791a] font-extrabold shadow-xs" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                  id={`pim-subtab-btn-${tab.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        )}

        {/* 4. MAIN INNER SCROLLABLE VIEWPORT CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 space-y-6 scrollbar-thin" id="viewport-scroll-shell">
          
          {/* Warning / Success Alerts */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border-l-4 border-rose-600 rounded-r-lg text-rose-900 text-xs flex items-start gap-2.5 shadow-xs animate-shake" id="error-toast-banner">
              <div className="p-1 bg-rose-100 text-rose-800 rounded-full shrink-0">🚩</div>
              <div>
                <p className="font-bold text-rose-950">System Operation Warning</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg text-emerald-900 text-xs flex items-start gap-2.5 shadow-xs animate-fade-in" id="success-toast-banner">
              <div className="p-1 bg-emerald-100 text-emerald-800 rounded-full shrink-0">✓</div>
              <div>
                <p className="font-bold text-emerald-950">Success Overview</p>
                <p className="mt-0.5">{successMessage}</p>
              </div>
            </div>
          )}

          {/* VIEW: ACTIVE SIDEBAR MODULES MAPPING */}
          {isModuleAccessDenied ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-lg mx-auto shadow-xs text-center space-y-4" id="module-access-denied-view">
              <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto text-2xl">
                <Lock size={24} />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-extrabold text-slate-800">{activeSidebarTab} access restricted</h2>
                <p className="text-sm text-slate-500">
                  Your role does not include view permission for the {activeSidebarTab} module. Contact an administrator if you need access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSidebarTab("Employees")}
                className="px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg transition cursor-pointer"
              >
                Go to Employees
              </button>
            </div>
          ) : activeSidebarTab === "My Info" ? (
            /* --- DETAILED ADMINISTRATOR PROFILE & PASSWORD SECURITY MODULE --- */
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in" id="my-info-view-container">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                    <UserCircle size={20} className="text-[#ff791a]" /> My Account & Profile Details
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage your personal login credentials, administrator access levels, and security configurations.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left: Profile Info Cards */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <User size={14} className="text-slate-400" /> Account Information
                    </h4>

                    {isFetchingProfile ? (
                      <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 border border-slate-150 rounded-xl">
                        <div className="animate-spin w-5 h-5 border-2 border-[#ff791a] border-t-transparent rounded-full mx-auto mb-2"></div>
                        Fetching authentic credentials...
                      </div>
                    ) : profileLoadingError ? (
                      <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-medium">
                        Could not synchronize details: {profileLoadingError}
                      </div>
                    ) : adminProfileInfo ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-100 text-[#ff791a] font-extrabold text-sm flex items-center justify-center shadow-xs">
                            {adminProfileInfo.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-slate-800">{adminProfileInfo.username}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">System Owner</p>
                          </div>
                        </div>

                        <div className="border-t border-slate-200/60 my-2"></div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs leading-relaxed">
                          <div>
                            <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Access Scope</span>
                            <span className="font-semibold text-slate-850 flex items-center gap-1 mt-0.5">
                              <Shield size={11} className="text-[#ff791a] shrink-0" /> Full System Admin
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Active Status</span>
                            <span className="font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span> Verified Session
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Invited By</span>
                            <span className="font-semibold text-slate-800 mt-0.5 mt-1 block">{adminProfileInfo.invitedBy || "System Bootstrap"}</span>
                          </div>

                          <div>
                            <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Account Created</span>
                            <span className="font-semibold text-slate-850 mt-0.5 mt-1 block">
                              {adminProfileInfo.createdAt ? new Date(adminProfileInfo.createdAt).toLocaleDateString() : "System Default"}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg text-[11px] text-blue-750 leading-relaxed mt-2">
                          💡 <strong>Security Note:</strong> Passwords are stored using secure one-way hashing. Sessions expire after 24 hours and all API routes require a valid authenticated session token.
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl text-center text-xs text-slate-400">
                        Admin data not yet processed.
                      </div>
                    )}
                  </div>

                  {/* Right: Change Password Form */}
                  <form onSubmit={handlePasswordChangeSubmit} className="space-y-4 p-5 bg-slate-50 border border-slate-200 rounded-xl relative">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={14} className="text-slate-400" /> Update Security Credentials
                    </h4>

                    {changePasswordError && (
                      <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-semibold animate-shake">
                        ⚠️ {changePasswordError}
                      </div>
                    )}

                    {changePasswordSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">
                        {changePasswordSuccess}
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">Current Password</label>
                      <PasswordInput id="old-password" name="oldPassword"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500 transition font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-550 block mb-1">New Password</label>
                      <PasswordInput id="new-password" name="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500 transition font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-550 block mb-1">Confirm New Password</label>
                      <PasswordInput id="confirm-new-password" name="confirmNewPassword"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500 transition font-medium"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-sm shadow-orange-500/10 transition active:scale-98 cursor-pointer mt-2"
                    >
                      Authenticate & Save Password
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : activeSidebarTab === "Admin" ? (
             /* --- INTERACTIVE ADMINISTRATOR INVITE & MANAGE MODULE --- */
             <div className="max-w-4xl mx-auto space-y-6 animate-fade-in" id="admin-module-view">
               <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                 <div className="border-b border-slate-100 pb-3">
                   <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                     <Shield size={18} className="text-[#ff791a]" /> System Administrator Accounts
                   </h3>
                   <p className="text-xs text-slate-400 mt-1">
                     Security overview of authorized logins. Administrators can explicitly register and invite other administrators, but public self-signup is strictly disabled.
                   </p>
                 </div>

                 {inviteError && (
                   <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-semibold animate-shake">
                     🚩 {inviteError}
                   </div>
                 )}

                 {inviteSuccess && (
                   <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">
                     ✓ {inviteSuccess}
                   </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Create / Invite Form */}
                   <form onSubmit={handleInviteAdminSubmit} className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                     <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                       Invite / Onboard New Admin
                     </h4>
                     
                     <div>
                       <label className="text-[11px] font-bold text-slate-500 block mb-1">New Admin Username</label>
                       <input id="invite-username" name="inviteUsername"
                         type="text"
                         value={inviteUsername}
                         onChange={(e) => setInviteUsername(e.target.value)}
                         placeholder="e.g. nikhil_admin"
                         className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500 transition font-medium"
                       />
                     </div>

                     <div>
                       <label className="text-[11px] font-bold text-slate-500 block mb-1">Temporary Password</label>
                       <PasswordInput id="invite-password" name="invitePassword"
                         value={invitePassword}
                         onChange={(e) => setInvitePassword(e.target.value)}
                         placeholder="e.g. securePass123"
                         className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500 transition font-medium"
                       />
                     </div>                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">Assigned Security Role</label>
                        <select id="invite-role" name="inviteRole"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500 transition font-medium"
                        >
                          <option value="admin">Super-Admin (Full Access)</option>
                          {rolesList.map((r) => (
                            <option key={r.name} value={r.name}>{r.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500 block mb-1">Assigned Worksite Locations</label>
                        <div className="border border-slate-200 rounded-lg p-2.5 bg-white max-h-36 overflow-y-auto space-y-1.5 shadow-inner">
                          {customLocations.map((loc) => {
                            const isChecked = inviteLocations.includes(loc);
                            return (
                              <label key={loc} className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 hover:text-slate-900 transition font-medium select-none">
                                <input id={`invite-loc-${loc}`} name={`inviteLocation_${loc}`}
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setInviteLocations(prev => prev.filter(l => l !== loc));
                                    } else {
                                      setInviteLocations(prev => [...prev, loc]);
                                    }
                                  }}
                                  className="rounded border-slate-350 text-orange-500 focus:ring-orange-500 h-3.5 w-3.5 cursor-pointer accent-orange-500"
                                />
                                <span>{loc}</span>
                              </label>
                            );
                          })}
                          {customLocations.length === 0 && (
                            <p className="text-[10px] text-slate-400 text-center py-1 font-medium">No locations registered.</p>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 italic">
                          If unchecked, administrator defaults to having full unrestricted access to all locations.
                        </p>
                      </div>
                     <button
                       type="submit"
                       className="w-full py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-sm transition active:scale-98 cursor-pointer"
                     >
                       Grant Administrator Credentials
                     </button>
                   </form>

                   {/* Administrators List */}
                   <div className="space-y-3">
                     <h4 className="text-xs font-black text-slate-705 uppercase tracking-wider">
                       Active Administrators ({isFetchingAdmins ? "..." : adminsList.length})
                     </h4>
                     
                     <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white max-h-64 overflow-y-auto">
                       {isFetchingAdmins ? (
                         <div className="p-4 text-center text-xs text-slate-400">Loading authorized administrators...</div>
                       ) : adminsList.length === 0 ? (
                         <div className="p-4 text-center text-xs text-slate-400">No administrators managed.</div>
                       ) : (                          adminsList.map((adm) => {
                            const isSelf = adm.username.toLowerCase() === sessionUser.toLowerCase();
                            const isRootAdmin = adm.username.toLowerCase() === "admin";
                            
                            if (editingAdminUsername === adm.username) {
                              return (
                                <div key={adm.username} className="p-3 bg-slate-50 space-y-3 transition text-xs border-b border-slate-100">
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-slate-800">⚙ Edit security: {adm.username}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">Onboarded: {adm.createdAt ? new Date(adm.createdAt).toLocaleDateString() : "Present"}</span>
                                  </div>
                                  
                                  <div className="space-y-2.5 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Assigned Security Role</label>
                                      <select id="edit-admin-role" name="editAdminRole"
                                        value={editAdminRole}
                                        onChange={(e) => setEditAdminRole(e.target.value)}
                                        className="w-full px-2 py-1 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500 transition font-medium"
                                      >
                                        <option value="admin">Super-Admin (Full Access)</option>
                                        {rolesList.map((r) => (
                                          <option key={r.name} value={r.name}>{r.name}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {!isRootAdmin && (
                                      <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Login Access Restrictions</label>
                                        <select id="editadmindisabled-disabled-active-4793" name="editadmindisabled-disabled-active"
                                          value={editAdminDisabled ? "disabled" : "active"}
                                          onChange={(e) => setEditAdminDisabled(e.target.value === "disabled")}
                                          className="w-full px-2 py-1 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500 transition font-medium"
                                        >
                                          <option value="active">🟢 Active (Login Allowed)</option>
                                          <option value="disabled">🔴 Restricted (Block Login Access)</option>
                                        </select>
                                      </div>
                                    )}

                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Assigned Worksite Locations</label>
                                      <div className="border border-slate-200 rounded-md p-2 bg-slate-50 max-h-28 overflow-y-auto space-y-1.5 shadow-inner">
                                        {rawCustomLocations.map((loc) => {
                                          const isChecked = editAdminLocations.includes(loc);
                                          return (
                                            <label key={loc} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700 hover:text-slate-900 transition font-medium select-none">
                                              <input id={`edit-admin-loc-${loc}`} name={`editAdminLocation_${loc}`}
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                  if (isChecked) {
                                                    setEditAdminLocations(prev => prev.filter(l => l !== loc));
                                                  } else {
                                                    setEditAdminLocations(prev => [...prev, loc]);
                                                  }
                                                }}
                                                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 h-3.5 w-3.5 cursor-pointer accent-orange-500"
                                              />
                                              <span className="text-[11px]">{loc}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => setEditingAdminUsername(null)}
                                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateAdminSubmit(adm.username)}
                                        className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#ff791a] hover:bg-[#e4640c] rounded shadow-sm transition cursor-pointer"
                                      >
                                        Save Rules
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={adm.username} className="p-3 hover:bg-slate-50/50 flex items-center justify-between transition text-xs">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-800 flex items-center gap-1 flex-wrap">
                                    <span>👤 {adm.username}</span>
                                    {adm.disabled ? (
                                      <span className="bg-rose-50 text-rose-700 border border-rose-200/50 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase scale-90">Restricted</span>
                                    ) : (
                                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-250/50 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase scale-90">Active</span>
                                    )}
                                    {adm.username === sessionUser && (
                                      <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded font-normal uppercase scale-90">Current</span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    Invited by: {adm.invitedBy || "System"} • Role: <span className="font-semibold text-slate-600 bg-slate-100 px-1 py-0.5 rounded text-[9px]">{adm.role === "admin" ? "Super-Admin" : adm.role || "Super-Admin"}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-medium">
                                    📍 Locations: {adm.locations && adm.locations.length > 0 ? adm.locations.join(", ") : "All (Unrestricted)"}
                                  </p>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1 text-[10px] text-slate-400">
                                  <p className="font-mono">{adm.createdAt ? new Date(adm.createdAt).toLocaleDateString() : "Present"}</p>
                                  {adm.username !== "admin" && (
                                    <button
                                      onClick={() => {
                                        setEditingAdminUsername(adm.username);
                                        setEditAdminRole(adm.role || "admin");
                                        setEditAdminLocations(adm.locations || []);
                                        setEditAdminDisabled(!!adm.disabled);
                                      }}
                                      className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded flex items-center gap-1 border border-slate-200 font-medium transition cursor-pointer"
                                    >
                                      ⚙ Configure
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                       )}
                     </div>
                   </div>
                 </div>
               </div>

               {/* --- CUSTOM ROLES & PERMISSIONS MATRIX --- */}
               <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6 text-left">
                 <div className="border-b border-slate-100 pb-3">
                   <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                     <Shield size={18} className="text-[#ff791a]" /> Custom Security Roles & Permissions Matrix
                   </h3>
                   <p className="text-xs text-slate-400 mt-1">
                     Define fine-grained view and edit access permissions for different admin ranks and assistants.
                   </p>
                 </div>

                 {roleError && (
                   <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-semibold animate-shake">
                     🚩 {roleError}
                   </div>
                 )}

                 {roleSuccess && (
                   <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">
                     ✓ {roleSuccess}
                   </div>
                 )}

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   {/* Role Creation / Editing Form */}
                   <div className="lg:col-span-2 space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                     <h4 className="text-xs font-black text-slate-705 uppercase tracking-wider">
                       Create / Modify Custom Role
                     </h4>
                     
                     <form onSubmit={handleSaveRoleSubmit} className="space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                           <label className="text-[11px] font-bold text-slate-500 block mb-1">Role Name</label>
                           <input id="role-name-input" name="roleNameInput"
                             type="text"
                             value={roleNameInput}
                             onChange={(e) => setRoleNameInput(e.target.value)}
                             placeholder="e.g. HR Assistant"
                             className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500 transition font-medium"
                           />
                         </div>

                         <div>
                           <label className="text-[11px] font-bold text-slate-500 block mb-1">Description</label>
                           <input id="role-desc-input" name="roleDescInput"
                             type="text"
                             value={roleDescInput}
                             onChange={(e) => setRoleDescInput(e.target.value)}
                             placeholder="e.g. Access to daily markings..."
                             className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500 transition font-medium"
                           />
                         </div>
                       </div>

                       {/* Permission Grid Table */}
                       <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                         <table className="w-full border-collapse text-left text-xs">
                           <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                             <tr>
                               <th className="p-2.5">Feature Module</th>
                               <th className="p-2.5 text-center w-24">View Module</th>
                               <th className="p-2.5 text-center w-24">Edit/Save</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                             {[
                               { key: "employees", name: "Employees Database" },
                               { key: "attendance", name: "Attendance Sheets" },
                               { key: "salary", name: "Salary Sheet" },
                               { key: "ledger", name: "Advance & Penalty Ledger" },
                               { key: "leave", name: "Leave Requests" },
                               { key: "birthdays", name: "Birthday Calendar" },
                               { key: "directory", name: "Directory Contacts" },
                               { key: "admin", name: "Admin Panel" }
                             ].map((mod) => (
                               <tr key={mod.key} className="hover:bg-slate-50/50">
                                 <td className="p-2.5 font-semibold text-slate-800">{mod.name}</td>
                                 <td className="p-2.5 text-center">
                                   <input id={`role-perm-view-${mod.key}`} name={`rolePermView_${mod.key}`}
                                     type="checkbox"
                                     checked={!!rolePermsInput[mod.key]?.view}
                                     onChange={(e) => {
                                       const val = e.target.checked;
                                       setRolePermsInput(prev => ({
                                         ...prev,
                                         [mod.key]: {
                                           ...prev[mod.key],
                                           view: val,
                                           // Automatically disable edit if view is disabled
                                           edit: val ? prev[mod.key]?.edit : false
                                         }
                                       }));
                                     }}
                                     className="rounded text-orange-600 focus:ring-orange-500 scale-110 cursor-pointer"
                                   />
                                 </td>
                                 <td className="p-2.5 text-center">
                                   <input id={`role-perm-view-${mod.key}`} name={`rolePermView_${mod.key}`}
                                     type="checkbox"
                                     checked={!!rolePermsInput[mod.key]?.edit}
                                     disabled={!rolePermsInput[mod.key]?.view}
                                     onChange={(e) => {
                                       setRolePermsInput(prev => ({
                                         ...prev,
                                         [mod.key]: {
                                           ...prev[mod.key],
                                           edit: e.target.checked
                                         }
                                       }));
                                     }}
                                     className="rounded text-orange-600 focus:ring-orange-500 scale-110 cursor-pointer disabled:opacity-40"
                                   />
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>

                       <button
                         type="submit"
                         className="w-full py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-sm transition active:scale-98 cursor-pointer"
                       >
                         Save Custom Role Matrix
                       </button>
                     </form>
                   </div>

                   {/* Roles Overview List */}
                   <div className="space-y-3">
                     <h4 className="text-xs font-black text-slate-705 uppercase tracking-wider">
                       Configured Roles ({isFetchingRoles ? "..." : rolesList.length})
                     </h4>

                     <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white max-h-96 overflow-y-auto">
                       {isFetchingRoles ? (
                         <div className="p-4 text-center text-xs text-slate-400">Loading custom roles...</div>
                       ) : rolesList.length === 0 ? (
                         <div className="p-4 text-center text-xs text-slate-400">No custom roles defined.</div>
                       ) : (
                         rolesList.map((role) => (
                           <div key={role.name} className="p-3 hover:bg-slate-50/50 space-y-1.5 transition text-xs relative group">
                             <div className="flex items-start justify-between">
                               <div className="space-y-0.5">
                                 <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                   🛡️ {role.name}
                                 </p>
                                 <p className="text-[10px] text-slate-400">{role.description || "No description provided."}</p>
                               </div>                               <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRoleNameInput(role.name);
                                      setRoleDescInput(role.description || "");
                                      setRolePermsInput(role.permissions || {
                                        employees: { view: false, edit: false },
                                        salary: { view: false, edit: false },
                                        ledger: { view: false, edit: false },
                                        attendance: { view: false, edit: false },
                                        leave: { view: false, edit: false },
                                        birthdays: { view: false, edit: false },
                                        directory: { view: false, edit: false },
                                        admin: { view: false, edit: false }
                                      });
                                      triggerSuccess(`Loaded security mappings for "${role.name}" into editor.`);
                                    }}
                                    className="text-slate-500 hover:text-slate-800 p-1 transition cursor-pointer text-xs"
                                    title="Edit security mappings"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRole(role.name)}
                                    className="text-rose-600 hover:text-rose-800 p-1 transition cursor-pointer text-xs"
                                    title="Delete custom role"
                                  >
                                    🗑️
                                  </button>
                                </div>
                             </div>
                             
                             {/* Quick permissions badges */}
                             <div className="flex flex-wrap gap-1 mt-1">
                               {Object.entries(role.permissions || {}).map(([mod, perm]: any) => {
                                 if (!perm.view) return null;
                                 return (
                                   <span key={mod} className={`text-[9px] px-1.5 py-0.5 rounded font-bold capitalize ${perm.edit ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                     {mod}: {perm.edit ? "Edit" : "View"}
                                   </span>
                                 );
                               })}
                             </div>
                           </div>
                         ))
                       )}
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           ) : activeSidebarTab === "Audit Logs" ? (
              /* --- ENTERPRISE SECURITY AUDIT TRAIL & EVENT LOGS --- */
              <div className="max-w-7xl mx-auto space-y-6 animate-fade-in text-left" id="audit-trail-viewport">
                
                {/* 1. Page Header & Clear Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                      <FileText size={20} className="text-[#ff791a]" /> Enterprise Security Audit Trail
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Persistent database-backed records of administrative operations, security breaches, logins, status locks, and system telemetry.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchAuditLogs}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition flex items-center gap-1 cursor-pointer"
                      title="Reload Audit Logs"
                    >
                      <RotateCw size={13} className={isFetchingAuditLogs ? "animate-spin" : ""} /> Refresh Logs
                    </button>
                    
                    {sessionUser.toLowerCase() === "admin" && (
                      <button
                        onClick={handleFlushAuditLogs}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold text-rose-700 transition flex items-center gap-1 cursor-pointer"
                        title="Permanently Flush Security Logs"
                      >
                        <Trash2 size={13} /> Flush Security Trail
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Advanced High-End Visual Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1: Total Security Events */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Total Logged Events</p>
                      <p className="text-2xl font-black text-slate-800">{auditLogsList.length}</p>
                      <p className="text-[10px] text-slate-400">Max limit of 2000 active records</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-50 text-[#ff791a] rounded-xl flex items-center justify-center font-bold text-lg shadow-xs">
                      <FileText size={22} />
                    </div>
                  </div>

                  {/* Card 2: Performing Operators */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Active Performers</p>
                      <p className="text-2xl font-black text-slate-800">
                        {new Set(auditLogsList.map(l => l.username || "System")).size}
                      </p>
                      <p className="text-[10px] text-slate-400">Authorized administrators & system</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs">
                      <Users size={22} />
                    </div>
                  </div>

                  {/* Card 3: Mutated Entity Payload Diffs */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Mutated Operations</p>
                      <p className="text-2xl font-black text-slate-800">
                        {auditLogsList.filter(l => l.action !== 'LOGIN_SUCCESS' && l.action !== 'LOGIN_FAILURE').length}
                      </p>
                      <p className="text-[10px] text-slate-400">Registry changes with payload diffs</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs">
                      <Wrench size={22} />
                    </div>
                  </div>
                </div>

                {/* 3. Advanced Filtering Control Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Filter size={14} className="text-[#ff791a]" /> Interactive Filter Dashboard
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportAuditExcel}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-700 font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer"
                        title="Download Trail in Green Excel Sheet"
                      >
                        <FileSpreadsheet size={13} /> Export to Excel
                      </button>
                      <button
                        onClick={handleExportAuditPDF}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-250 text-rose-700 font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer"
                        title="Download Trail in High-Fidelity PDF Document"
                      >
                        <FileText size={13} /> Export to PDF
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {/* Filter 1: Full Payload Search */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Search Registry Event Logs</label>
                      <div className="relative">
                        <input id="audit-search" name="auditSearch"
                          type="text"
                          value={auditSearch}
                          onChange={(e) => setAuditSearch(e.target.value)}
                          placeholder="e.g. employeeCode, admin, update..."
                          className="w-full pl-8 pr-3 py-2 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-orange-500 transition"
                        />
                        <span className="absolute left-2.5 top-2.5 text-slate-400"><Search size={13} /></span>
                      </div>
                    </div>

                    {/* Filter 2: Performing Operator */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Filter Performer</label>
                      <select id="audit-filter-admin" name="auditFilterAdmin"
                        value={auditFilterAdmin}
                        onChange={(e) => setAuditFilterAdmin(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white focus:outline-none focus:border-orange-500 transition"
                      >
                        <option value="">All Administrators</option>
                        {Array.from(new Set(auditLogsList.map(l => l.username || "System")))
                          .filter(Boolean)
                          .map((user: string) => (
                            <option key={user} value={user}>{user}</option>
                          ))
                        }
                      </select>
                    </div>

                    {/* Filter 3: Action Type */}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Filter Action Category</label>
                      <select id="audit-filter-action" name="auditFilterAction"
                        value={auditFilterAction}
                        onChange={(e) => setAuditFilterAction(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs bg-white focus:outline-none focus:border-orange-500 transition"
                      >
                        <option value="">All Security Actions</option>
                        {Array.from(new Set(auditLogsList.map(l => l.action)))
                          .filter(Boolean)
                          .map((act: string) => (
                            <option key={act} value={act}>{act}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Results Database Grid */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-slate-700 text-left">
                      <thead className="bg-[#fbfbfb] text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 font-black">Event ID</th>
                          <th className="px-6 py-4 font-black">Date & Time</th>
                          <th className="px-6 py-4 font-black">Performer</th>
                          <th className="px-6 py-4 font-black">Action Category</th>
                          <th className="px-6 py-4 font-black">Target Entity</th>
                          <th className="px-6 py-4 text-center font-black">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {isFetchingAuditLogs ? (
                          <tr>
                            <td colSpan={6} className="text-center py-10">
                              <div className="flex flex-col items-center gap-2">
                                <RotateCw className="animate-spin text-orange-500 shrink-0" size={20} />
                                <span className="text-xs text-slate-400 font-bold">Querying local secure logs database...</span>
                              </div>
                            </td>
                          </tr>
                        ) : filteredAuditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-10 text-slate-400 font-bold">
                              No security audit events matched active dashboard filters.
                            </td>
                          </tr>
                        ) : (
                          filteredAuditLogs.map((log: any) => {
                            const isExpanded = expandedLogId === log.id;
                            
                            // Dynamic Action Badges Colors
                            let badgeStyle = "bg-blue-50 text-blue-700 border-blue-100";
                            const act = log.action || "";
                            if (act.includes("ADD") || act.includes("IMPORT") || act.includes("INVITE")) {
                              badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
                            } else if (act.includes("DELETE") || act.includes("SCRUB")) {
                              badgeStyle = "bg-rose-50 text-rose-700 border-rose-100";
                            } else if (act.includes("UPDATE") || act.includes("SAVE") || act.includes("RENAME")) {
                              badgeStyle = "bg-amber-50 text-amber-700 border-amber-100";
                            }

                            return (
                              <React.Fragment key={log.id}>
                                <tr className="hover:bg-slate-50/50 transition">
                                  <td className="px-6 py-4 font-mono font-bold text-slate-400">#{log.id || "N/A"}</td>
                                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                  <td className="px-6 py-4 font-bold text-slate-800">{log.username || "System"}</td>
                                  <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 border text-[10px] rounded-full uppercase font-bold ${badgeStyle}`}>
                                      {act}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-slate-600 whitespace-normal min-w-[300px]" title={log.target}>{log.target || "N/A"}</td>
                                  <td className="px-6 py-4 text-center">
                                    <button
                                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[10px] transition cursor-pointer"
                                    >
                                      {isExpanded ? "Collapse" : "Inspect Payload"}
                                    </button>
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr>
                                    <td colSpan={6} className="bg-slate-50 px-8 py-4 border-y border-slate-200">
                                      <div className="space-y-2 animate-fade-in">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Forensic Payload Investigation Drawer
                                          </p>
                                          <span className="text-[9px] font-mono text-slate-400">JSON Format schema</span>
                                        </div>
                                        
                                        <div className="bg-[#1e293b] rounded-lg p-4 border border-slate-800 text-slate-100 font-mono text-xs overflow-x-auto shadow-inner max-h-[350px] relative">
                                          <pre className="text-left text-orange-200">
                                            {JSON.stringify(log.details, null, 2)}
                                          </pre>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : activeSidebarTab === "Salary" ? (
              /* --- SALARY CALCULATION SHEET & PERK ALLOCATION --- */
              <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="salary-calculations-module-view">
                {/* 1. Dynamic Premium Advanced Filters Panel */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6 text-left">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Filter size={16} className="text-[#f57416]" /> Custom Salary Filters (Advanced)
                      </h4>
                      <p className="text-[11px] text-slate-450 mt-0.5">
                        Configure targeted custom payroll filters, matching employee demographics, statutory status, and month-wise ledger scopes.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      {/* Payroll Month Select */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">🗓️ Month:</span>
                        <select id="salary-month-select" name="selectedMonth"
                          value={MONTHS_LIST.includes(selectedMonth) ? selectedMonth : (MONTHS_LIST[0] || selectedMonth)}
                          onChange={(e) => setSelectedMonth(normalizeMonthKey(e.target.value))}
                          className="px-2.5 py-1 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 shadow-sm transition"
                        >
                          {MONTHS_LIST.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quick Balance segmented filter */}
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {[
                          { id: "all", label: "All Balances" },
                          { id: "advances", label: "Advances Only" },
                          { id: "penalties", label: "Penalties Only" },
                          { id: "perks", label: "Perks Only" }
                        ].map((t) => {
                          const isSel = salaryFilterType === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSalaryFilterType(t.id as any)}
                              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                isSel ? "bg-[#ff791a] text-white shadow-sm" : "text-slate-650 hover:text-slate-900"
                              }`}
                            >
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Criteria Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
                    {/* Search query input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search Employee</label>
                      <div className="relative">
                        <input id="salary-search-query" name="salarySearchQuery"
                          type="text"
                          value={salarySearchQuery}
                          onChange={(e) => setSalarySearchQuery(e.target.value)}
                          placeholder="Search code or name..."
                          className="w-full pl-8 pr-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-[#f57416]"
                        />
                        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                      </div>
                    </div>

                    {/* Location Filter */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Branch/Work Location</label>
                      <select id="salary-location-filter" name="salaryLocationFilter"
                        value={salaryLocationFilter}
                        onChange={(e) => setSalaryLocationFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416]"
                      >
                        <option value="All">All Locations</option>
                        {salaryUniqueLocations.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>

                    {/* PF Joining Date Range */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">PF Joining Date Range</label>
                      <div className="grid grid-cols-2 gap-1 items-center">
                        <input id="salary-join-start-filter" name="salaryJoinStartFilter"
                          type="date"
                          value={salaryJoinStartFilter}
                          onChange={(e) => setSalaryJoinStartFilter(e.target.value)}
                          className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                        />
                        <input id="salary-join-end-filter" name="salaryJoinEndFilter"
                          type="date"
                          value={salaryJoinEndFilter}
                          onChange={(e) => setSalaryJoinEndFilter(e.target.value)}
                          className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                        />
                      </div>
                    </div>

                    {/* Exit Date Range */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Exit/Leaving Date Range</label>
                      <div className="grid grid-cols-2 gap-1 items-center">
                        <input id="salary-exit-start-filter" name="salaryExitStartFilter"
                          type="date"
                          value={salaryExitStartFilter}
                          onChange={(e) => setSalaryExitStartFilter(e.target.value)}
                          className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                        />
                        <input id="salary-exit-end-filter" name="salaryExitEndFilter"
                          type="date"
                          value={salaryExitEndFilter}
                          onChange={(e) => setSalaryExitEndFilter(e.target.value)}
                          className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                        />
                      </div>
                    </div>

                    {/* Monthly Gross Salary Range */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Monthly Gross Salary (Rs.)</label>
                      <div className="grid grid-cols-2 gap-1 items-center">
                        <input id="salary-min-salary-filter" name="salaryMinSalaryFilter"
                          type="number"
                          placeholder="Min"
                          value={salaryMinSalaryFilter}
                          onChange={(e) => setSalaryMinSalaryFilter(e.target.value)}
                          className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                        />
                        <input id="salary-max-salary-filter" name="salaryMaxSalaryFilter"
                          type="number"
                          placeholder="Max"
                          value={salaryMaxSalaryFilter}
                          onChange={(e) => setSalaryMaxSalaryFilter(e.target.value)}
                          className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                        />
                      </div>
                    </div>

                    {/* Gender Filter */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gender</label>
                      <select id="salary-gender-filter" name="salaryGenderFilter"
                        value={salaryGenderFilter}
                        onChange={(e) => setSalaryGenderFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416]"
                      >
                        <option value="All">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Marital Status Filter */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Marital Status</label>
                      <select id="salary-marital-filter" name="salaryMaritalFilter"
                        value={salaryMaritalFilter}
                        onChange={(e) => setSalaryMaritalFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416]"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>

                    {/* ESIC Coverage Filter */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ESIC Insured Status</label>
                      <select id="salary-esic-filter" name="salaryEsicFilter"
                        value={salaryEsicFilter}
                        onChange={(e) => setSalaryEsicFilter(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416]"
                      >
                        <option value="All">All Coverage</option>
                        <option value="Yes">Yes (Insured)</option>
                        <option value="No">No (Exempt/Excluded)</option>
                      </select>
                    </div>

                    {/* Skill Category Filter */}
                    <div className="space-y-1.5 relative" id="salary-skill-multiselect-container">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Skill Category</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSalarySkillDropdownOpen(!isSalarySkillDropdownOpen);
                            setIsSalaryRoleDropdownOpen(false);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                        >
                          <span className="truncate">
                            {salarySkillFilters.length === 0 
                              ? "All Categories" 
                              : `${salarySkillFilters.length} Selected`}
                          </span>
                          <span className="text-[10px] text-slate-400">▼</span>
                        </button>
                        
                        {isSalarySkillDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                              <span className="text-[10px] text-slate-400 font-bold">Categories</span>
                              <button
                                type="button"
                                onClick={() => setSalarySkillFilters([])}
                                className="text-[9px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                              >
                                Clear All
                              </button>
                            </div>
                            {["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"].map(cat => {
                              const isChecked = salarySkillFilters.includes(cat);
                              const toggle = () => {
                                if (isChecked) {
                                  setSalarySkillFilters(prev => prev.filter(c => c !== cat));
                                } else {
                                  setSalarySkillFilters(prev => [...prev, cat]);
                                }
                              };
                              return (
                                <label key={cat} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                  <input id="checkbox-field-5587" name="checkbox_5587"
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={toggle}
                                    className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                  />
                                  <span className="font-medium">{cat}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Job Role Filter */}
                    <div className="space-y-1.5 relative" id="salary-role-multiselect-container">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Job Role</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSalaryRoleDropdownOpen(!isSalaryRoleDropdownOpen);
                            setIsSalarySkillDropdownOpen(false);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                        >
                          <span className="truncate">
                            {salaryRoleFilters.length === 0 
                              ? "All Roles" 
                              : `${salaryRoleFilters.length} Selected`}
                          </span>
                          <span className="text-[10px] text-slate-400">▼</span>
                        </button>
                        
                        {isSalaryRoleDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-56 overflow-y-auto">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                              <span className="text-[10px] text-slate-400 font-bold">Roles</span>
                              <button
                                type="button"
                                onClick={() => setSalaryRoleFilters([])}
                                className="text-[9px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                              >
                                Clear All
                              </button>
                            </div>
                            {customRoles.map(role => {
                              const isChecked = salaryRoleFilters.includes(role);
                              const toggle = () => {
                                if (isChecked) {
                                  setSalaryRoleFilters(prev => prev.filter(r => r !== role));
                                } else {
                                  setSalaryRoleFilters(prev => [...prev, role]);
                                }
                              };
                              return (
                                <label key={role} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                  <input id="checkbox-field-5645" name="checkbox_5645"
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={toggle}
                                    className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                  />
                                  <span className="font-medium">{role}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Payment Status Filter */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Payment Status</label>
                      <select id="salary-payment-status-filter" name="salaryPaymentStatusFilter"
                        value={salaryPaymentStatusFilter}
                        onChange={(e) => setSalaryPaymentStatusFilter(e.target.value as "All" | "Unpaid" | "Paid" | "Hold")}
                        className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416]"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Paid">Paid</option>
                        <option value="Hold">Hold</option>
                      </select>
                    </div>

                    {/* Action Result / Matched Employees Box */}
                    <div className="col-span-1 sm:col-span-2 md:col-span-4 flex justify-between items-center bg-[#f57416]/10 border border-[#f57416]/20 rounded-xl p-3 mt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-[#f57416] rounded-full animate-pulse"></span>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Active Criteria Applied</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Matched Personnel</span>
                        <span className="text-sm font-black text-[#f57416]">{filteredSalaryEmployees.length} records</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Summary Dashboard Metrics (Reactive to Active Month & Filters) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="payroll-overview-bento">
                  <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#ff791a] flex items-center justify-center text-lg shadow-xs shrink-0">
                      💰
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Gross Payroll</span>
                      <span className="text-sm font-extrabold text-slate-800 block truncate mt-0.5">
                        ₹{filteredSalaryEmployees.reduce((sum, e) => sum + (Number(getSalaryColumnValue(e, "Gross Salary (Monthly)", selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtAmounts)) || 0), 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-xs shrink-0">
                      🏦
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Net Payable</span>
                      <span className="text-sm font-extrabold text-emerald-700 block truncate mt-0.5">
                        ₹{filteredSalaryEmployees.reduce((sum, e) => sum + (Number(getSalaryColumnValue(e, "Net Payable", selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtAmounts)) || 0), 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center text-lg shadow-xs shrink-0">
                      📉
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Deductions ({selectedMonth})</span>
                      <span className="text-sm font-extrabold text-rose-700 block truncate mt-0.5">
                        ₹{filteredSalaryEmployees.reduce((sum, e) => sum + (Number(getSalaryColumnValue(e, "Total Deductions", selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtAmounts)) || 0), 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shadow-xs shrink-0">
                      🏢
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Employer Liability</span>
                      <span className="text-sm font-extrabold text-indigo-700 block truncate mt-0.5">
                        ₹{filteredSalaryEmployees.reduce((sum, e) => {
                          const erPf = Number(getSalaryColumnValue(e, "Employer PF (13%)", selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtAmounts)) || 0;
                          const erEsic = Number(getSalaryColumnValue(e, "Employer ESIC (3.25%)", selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtAmounts)) || 0;
                          return sum + erPf + erEsic;
                        }, 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Scrollable Payroll Sheet Table & Action Buttons */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4 text-left">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Payroll Calculation Sheet — {selectedMonth}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Live computations based on active filters ({filteredSalaryEmployees.length} shown). Double-click or select perks to edit values dynamically.
                      </p>
                      {selectedSalaryEmployeeIds.length > 0 && (
                        <div className="flex items-center gap-2 mt-1.5 animate-fade-in">
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200/50 shadow-2xs">
                            {selectedSalaryEmployeeIds.length} employee{selectedSalaryEmployeeIds.length > 1 ? 's' : ''} selected
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedSalaryEmployeeIds([])}
                            className="text-[10px] font-extrabold text-slate-400 hover:text-slate-600 underline cursor-pointer transition uppercase"
                          >
                            Clear Selection
                          </button>

                          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200/60 pl-3">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Bulk Status:</span>
                            <button
                              type="button"
                              onClick={() => handleBulkUpdatePaymentStatus("Paid")}
                              disabled={!userPermissions.salary?.edit}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-[9px] rounded-md shadow-2xs transition cursor-pointer"
                            >
                              Mark Paid
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkUpdatePaymentStatus("Hold")}
                              disabled={!userPermissions.salary?.edit}
                              className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-[9px] rounded-md shadow-2xs transition cursor-pointer"
                            >
                              Hold Salary
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBulkUpdatePaymentStatus("Unpaid")}
                              disabled={!userPermissions.salary?.edit}
                              className="px-2 py-0.5 bg-slate-550 hover:bg-slate-600 disabled:opacity-40 text-white font-bold text-[9px] rounded-md shadow-2xs transition cursor-pointer"
                            >
                              Mark Unpaid
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const dataToDownload = selectedSalaryEmployeeIds.length > 0
                            ? filteredSalaryEmployees.filter(emp => selectedSalaryEmployeeIds.includes(emp.id))
                            : filteredSalaryEmployees;
                          const headers = [
                            "Employee Code",
                            "Employee Name",
                            "Total Salary",
                            "Gross Salary (Monthly)",
                            "Employer PF (13%)",
                            "Employer ESIC (3.25%)",
                            "Employee PF (12%)",
                            "Employee ESIC (0.75%)",
                            "Professional Tax (PT)",
                            "Advance Bal. (" + selectedMonth + ")",
                            "Uniform Bal. (" + selectedMonth + ")",
                            "Penalty Bal. (" + selectedMonth + ")",
                            "Net Salary",
                            "Total Deductions",
                            "Food Perk",
                            "Accommodation Perk",
                            "Conveyance Perk",
                            "Net Payable",
                            "Payment Status"
                          ];
                          const rows = dataToDownload.map(e => {
                            const monthData = attendanceDb[selectedMonth] || {};
                            const empData = monthData[e.id] || {};
                            const daysInMonth = getDaysInSelectedMonth(selectedMonth);
                            let presents = 0;
                            for (let i = 1; i <= daysInMonth; i++) {
                              if (isEmployeeExitedOnDayStatic(e, selectedMonth, i)) {
                                continue;
                              }
                              if (empData[i] === "P") presents++;
                            }

                            const rawGross = safeNumber(e.grossSalary);
                            const rawBasic = safeNumber(e.basicSalary);
                            const gross = prorateSalaryByAttendance(rawGross, daysInMonth, presents, empData);
                            const basic = prorateSalaryByAttendance(rawBasic, daysInMonth, presents, empData);

                            const isLocCompliant = e.location ? !!locationCompliance[e.location] : false;
                            const isEmpCompliant = e.complianceEnabled !== false;
                            const isCompliant = isLocCompliant && isEmpCompliant;

                            const { employeePf: empPf, employerPf: erPf } = calculatePfAmounts(gross, {
                              mode: e.pfCalculationMode,
                              isCompliant,
                            });
                            const isEsicCovered = isEmployeeEsicCovered(gross, esicEligibilityLimit, isCompliant, e.esic);
                            const erEsic = isEsicCovered ? (gross * 0.0325) : 0;
                            const empEsic = isEsicCovered ? (gross * 0.0075) : 0;
                            const pt = calculateProfessionalTax(gross, {
                              isCompliant,
                              locationPtAmount: resolveLocationPtAmount(e.location, locationPtAmounts),
                            });
                            
                            const ledger = e.monthlyLedger?.[selectedMonth];
                            const adv = ledger ? safeNumber(ledger.advance) : 0;
                            const pen = ledger ? safeNumber(ledger.penalty) : 0;
                            const uniform = ledger ? safeNumber(ledger.uniform) : 0;
                            
                            const food = ledger ? safeNumber(ledger.foodPerk) : 0;
                            const acc = ledger ? safeNumber(ledger.accommodationPerk) : 0;
                            const conv = ledger ? safeNumber(ledger.conveyancePerk) : 0;
                            
                            const netSalaryVal = safeNumber(gross) - safeNumber(empPf) - safeNumber(empEsic) - safeNumber(pt);
                            const totalDeductionsVal = safeNumber(empPf) + safeNumber(empEsic) + safeNumber(pt) + safeNumber(adv) + safeNumber(pen) + safeNumber(uniform);
                            const netPayableVal = safeNumber(netSalaryVal) - safeNumber(adv) - safeNumber(pen) - safeNumber(uniform) + safeNumber(food) + safeNumber(acc) + safeNumber(conv);
                            return [
                              e.employeeCode,
                              e.nameAsPerAadharColumn || e.nameAsPerAadhar,
                              rawGross,
                              gross,
                              isCompliant ? Math.round(erPf) : "",
                              isCompliant ? Math.round(erEsic) : "",
                              isCompliant ? Math.round(empPf) : "",
                              isCompliant ? Math.round(empEsic) : "",
                              isCompliant ? pt : "",
                              adv,
                              uniform,
                              pen,
                              Math.round(netSalaryVal),
                              Math.round(totalDeductionsVal),
                              food,
                              acc,
                              conv,
                              Math.round(Math.max(0, netPayableVal)),
                              ledger?.paymentStatus || "Unpaid"
                            ];
                          });
                          const csvContent = "data:text/csv;charset=utf-8," 
                            + [headers.map(h => quoteCSVValue(h)).join(","), ...rows.map(r => r.map(c => quoteCSVValue(c)).join(","))].join("\n");
                          const encodedUri = encodeURI(csvContent);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", `FlexHRM_Salary_${selectedMonth.replace(/\s+/g, '_')}_Sheet_${new Date().toISOString().split('T')[0]}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          triggerSuccess(`Payroll sheet for ${selectedMonth} exported successfully.`);

                          fetch("/api/audit-logs", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "DOWNLOAD_SALARY_CSV",
                              target: `Salary CSV Sheet: Downloaded payroll calculations CSV sheet for ${selectedMonth} containing details of ${dataToDownload.length} employees.`,
                              details: { month: selectedMonth, recordCount: dataToDownload.length, format: "CSV" }
                            })
                          }).then(() => fetchAuditLogs()).catch(err => console.error("Audit log error:", err));
                        }}
                        className="px-3.5 py-1.5 bg-[#f57416] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <FileSpreadsheet size={13} className="stroke-[2.5]" /> Export CSV {selectedSalaryEmployeeIds.length > 0 && `(${selectedSalaryEmployeeIds.length})`}
                      </button>

                      <button
                        type="button"
                        disabled={filteredSalaryEmployees.length === 0 || selectedSalaryColumns.length === 0}
                        onClick={() => {
                          const dataToDownload = selectedSalaryEmployeeIds.length > 0
                            ? filteredSalaryEmployees.filter(emp => selectedSalaryEmployeeIds.includes(emp.id))
                            : filteredSalaryEmployees;
                          downloadSalaryExcel(dataToDownload, selectedSalaryColumns, salaryLocationFilter, selectedMonth);
                        }}
                        className="px-3.5 py-1.5 bg-[#107c41] hover:bg-[#0d6233] disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <FileSpreadsheet size={13} className="stroke-[2.5]" /> Export Excel {selectedSalaryEmployeeIds.length > 0 && `(${selectedSalaryEmployeeIds.length})`}
                      </button>

                      <button
                        type="button"
                        disabled={filteredSalaryEmployees.length === 0 || selectedSalaryColumns.length === 0}
                        onClick={() => {
                          const dataToDownload = selectedSalaryEmployeeIds.length > 0
                            ? filteredSalaryEmployees.filter(emp => selectedSalaryEmployeeIds.includes(emp.id))
                            : filteredSalaryEmployees;
                          downloadSalaryPDF(dataToDownload, selectedSalaryColumns, salaryLocationFilter, selectedMonth);
                        }}
                        className="px-3.5 py-1.5 bg-[#d62222] hover:bg-[#b51c1c] disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <FileText size={13} className="stroke-[2.5]" /> Export PDF {selectedSalaryEmployeeIds.length > 0 && `(${selectedSalaryEmployeeIds.length})`}
                      </button>

                      <button
                        type="button"
                        disabled={filteredSalaryEmployees.length === 0 || isExportingBulkPay}
                        onClick={() => {
                          const dataToDownload = selectedSalaryEmployeeIds.length > 0
                            ? filteredSalaryEmployees.filter(emp => selectedSalaryEmployeeIds.includes(emp.id))
                            : filteredSalaryEmployees;
                          handleExportAxisBulkPay(dataToDownload.map((e) => e.id));
                        }}
                        className="px-3.5 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                        title="Generate, download, and save Axis Bank Bulk Pay file (Excel 97–2003)"
                      >
                        {isExportingBulkPay ? (
                          <><RotateCw size={13} className="stroke-[2.5] animate-spin" /> Saving...</>
                        ) : (
                          <><IndianRupee size={13} className="stroke-[2.5]" /> Bulk Pay {selectedSalaryEmployeeIds.length > 0 && `(${selectedSalaryEmployeeIds.length})`}</>
                        )}
                      </button>
                    </div>
                  </div>

                  {lastSavedBulkPay && activeSidebarTab === "Salary" && (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                      <div>
                        <p className="text-xs font-black text-violet-800 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Bulk Pay Saved
                        </p>
                        <p className="text-[11px] text-violet-700 mt-1 font-mono truncate" title={lastSavedBulkPay.filename}>
                          {lastSavedBulkPay.filename}
                        </p>
                        <p className="text-[10px] text-violet-500 mt-0.5">
                          {lastSavedBulkPay.month} {lastSavedBulkPay.year} · {lastSavedBulkPay.recordCount} records · ₹{Number(lastSavedBulkPay.totalAmount || 0).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadBulkPayArchive(lastSavedBulkPay.id, lastSavedBulkPay.filename)}
                          className="px-3 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Download size={11} /> Re-download
                        </button>
                        {userPermissions.salary?.edit && (
                          <button
                            type="button"
                            onClick={() => handleDeleteBulkPayArchive(lastSavedBulkPay.id)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveSidebarTab("Saved Bulk Pay")}
                          className="px-3 py-1.5 bg-white hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          View All
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Calculation Columns & Templates Configuration Panel */}
                  <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 space-y-4 text-left animate-fade-in">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/60 pb-3">
                      <div>
                        <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Wrench size={13} className="text-[#f57416]" /> Configure Calculations Columns & Templates
                        </h5>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Customize columns displayed in the calculation sheet and export documents. Save layouts as custom templates for future use.
                        </p>
                      </div>

                      {/* Template Management (Unified) */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-lg shrink-0 max-w-full">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">📋 Template:</span>
                          <select id="active-salary-template-name" name="activeSalaryTemplateName"
                            value={activeSalaryTemplateName}
                            onChange={(e) => handleLoadSalaryTemplate(e.target.value)}
                            className="px-2 py-0.5 border border-slate-200 bg-white rounded text-[10px] font-bold text-slate-800 focus:outline-none min-w-[110px] max-w-[140px] truncate"
                          >
                            <option value="">-- Layout --</option>
                            {savedSalaryTemplates.map((t: any) => (
                              <option key={t.name} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                          {activeSalaryTemplateName && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSalaryTemplate(activeSalaryTemplateName)}
                              className="text-red-500 hover:text-red-700 font-extrabold text-[9px] hover:bg-red-50 px-1 py-0.5 rounded cursor-pointer transition uppercase"
                              title="Delete template"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <span className="hidden sm:inline text-slate-350">|</span>

                        <form onSubmit={handleSaveSalaryTemplate} className="flex items-center gap-1">
                          <input id="new-salary-template-name" name="newSalaryTemplateName"
                            type="text"
                            placeholder="Save layout name..."
                            value={newSalaryTemplateName}
                            onChange={(e) => setNewSalaryTemplateName(e.target.value)}
                            className="px-2 py-0.5 border border-slate-200 bg-white rounded text-[10px] font-medium text-slate-700 focus:outline-none focus:border-[#f57416] w-[110px]"
                          />
                          <button
                            type="submit"
                            disabled={!newSalaryTemplateName.trim()}
                            className="px-2 py-0.5 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-40 text-white font-extrabold text-[9px] uppercase tracking-wider rounded transition cursor-pointer shrink-0"
                          >
                            Save
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Dynamic Bento Box Categories */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                      {[
                        {
                          name: "Details",
                          color: "bg-slate-100/75 text-slate-750 border-slate-200",
                          headers: ["Employee Code", "Employee Name", "Skill Category", "Job Role", "Present Days", "Payment Status"]
                        },
                        {
                          name: "Gross Pay",
                          color: "bg-slate-100/75 text-slate-750 border-slate-200",
                          headers: ["Total Salary", "Gross Salary (Monthly)", "Basic Salary"]
                        },
                        {
                          name: "Employer Liability",
                          color: "bg-blue-50/80 text-blue-700 border-blue-200",
                          headers: ["Employer PF (13%)", "Employer ESIC (3.25%)"]
                        },
                        {
                          name: "Employee Deductions",
                          color: "bg-rose-50/80 text-rose-700 border-rose-200",
                          headers: ["Employee PF (12%)", "Employee ESIC (0.75%)", "Professional Tax (PT)", "Advance Balance", "Uniform Deductions", "Penalty Balance"]
                        },
                        {
                          name: "Net Salary",
                          color: "bg-amber-50/80 text-amber-700 border-amber-200",
                          headers: ["Net Salary"]
                        },
                        {
                          name: "Total Deductions",
                          color: "bg-rose-100/60 text-rose-800 border-rose-200",
                          headers: ["Total Deductions"]
                        },
                        {
                          name: "Extra Perks",
                          color: "bg-indigo-50/80 text-indigo-700 border-indigo-200",
                          headers: ["Food Perk", "Accommodation Perk", "Conveyance Perk"]
                        },
                        {
                          name: "Net Payable",
                          color: "bg-emerald-50/80 text-emerald-800 border-emerald-250",
                          headers: ["Net Payable"]
                        }
                      ].map(group => {
                        const groupCheckedCount = group.headers.filter(h => selectedSalaryColumns.includes(h)).length;
                        const isAllGroupChecked = groupCheckedCount === group.headers.length;
                        const isSomeGroupChecked = groupCheckedCount > 0 && !isAllGroupChecked;

                        const toggleGroup = () => {
                          if (isAllGroupChecked) {
                            setSelectedSalaryColumns(prev => prev.filter(h => !group.headers.includes(h)));
                          } else {
                            setSelectedSalaryColumns(prev => Array.from(new Set([...prev, ...group.headers])));
                          }
                        };

                        return (
                          <div key={group.name} className="border border-slate-200 rounded-lg overflow-hidden bg-white flex flex-col text-left text-[11px] shadow-2xs">
                            {/* Group Header Checkbox */}
                            <div className={`px-2 py-1 border-b border-inherit flex items-center justify-between font-bold ${group.color}`}>
                              <label className="flex items-center gap-1.5 min-w-0 cursor-pointer select-none w-full">
                                <input id="checkbox-field-6083" name="checkbox_6083"
                                  type="checkbox"
                                  ref={el => {
                                    if (el) el.indeterminate = isSomeGroupChecked;
                                  }}
                                  checked={isAllGroupChecked}
                                  onChange={toggleGroup}
                                  className="w-3 h-3 rounded border-slate-300 text-[#f57416] focus:ring-[#f57416] cursor-pointer"
                                />
                                <span className="text-[9px] font-black uppercase tracking-wider truncate">{group.name}</span>
                              </label>
                            </div>

                            {/* Group Sub-headers (Children Checkboxes) */}
                            <div className="p-2 space-y-1 grow bg-white">
                              {group.headers.map(header => {
                                const isChecked = selectedSalaryColumns.includes(header);
                                const toggleHeader = () => {
                                  if (isChecked) {
                                    setSelectedSalaryColumns(prev => prev.filter(h => h !== header));
                                  } else {
                                    setSelectedSalaryColumns(prev => [...prev, header]);
                                  }
                                };
                                
                                // Shorten names for clean fit inside small columns
                                let displayName = header;
                                if (header === "Skill Category") displayName = "Skill Cat.";
                                else if (header === "Job Role") displayName = "Role";
                                else if (header === "Total Salary") displayName = "Total Sal";
                                else if (header === "Gross Salary (Monthly)") displayName = "Gross";
                                else if (header === "Basic Salary") displayName = "Basic";
                                else if (header === "Employer PF (13%)") displayName = "PF (13%)";
                                else if (header === "Employer ESIC (3.25%)") displayName = "ESIC (3.25%)";
                                else if (header === "Employee PF (12%)") displayName = "PF (12%)";
                                else if (header === "Employee ESIC (0.75%)") displayName = "ESIC (0.75%)";
                                else if (header === "Professional Tax (PT)") displayName = "PT";
                                else if (header === "Advance Balance") displayName = "Advance";
                                else if (header === "Uniform Deductions") displayName = "Uniform";
                                else if (header === "Penalty Balance") displayName = "Penalty";
                                else if (header === "Food Perk") displayName = "Food";
                                else if (header === "Accommodation Perk") displayName = "Accom.";
                                else if (header === "Conveyance Perk") displayName = "Conv.";
                                else if (header === "Payment Status") displayName = "Status";
                                
                                return (
                                  <label key={header} className="flex items-start gap-1.5 text-[10px] text-slate-650 hover:text-slate-900 cursor-pointer select-none">
                                    <input id="checkbox-field-6130" name="checkbox_6130"
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={toggleHeader}
                                      className="w-3 h-3 mt-0.5 rounded border-slate-300 text-[#f57416] focus:ring-[#f57416]"
                                    />
                                    <span className="font-semibold text-slate-700 leading-tight break-words">{displayName}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Responsive Scrollable Table Container */}
                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[480px] overflow-y-auto shadow-sm" id="salary-sheet-scroller">
                    <table className="w-full text-xs text-left border-collapse bg-white table-fixed">
                      <colgroup>
                        <col className="w-[48px]" />
                        {(selectedSalaryColumns.includes("Employee Code") || selectedSalaryColumns.includes("Employee Name")) && (
                          <col className="w-[200px]" />
                        )}
                        {selectedSalaryColumns.includes("Skill Category") && (
                          <col className="w-[120px]" />
                        )}
                        {selectedSalaryColumns.includes("Job Role") && (
                          <col className="w-[120px]" />
                        )}
                        {selectedSalaryColumns.includes("Present Days") && (
                          <col className="w-[85px]" />
                        )}
                        {selectedSalaryColumns.includes("Total Salary") && (
                          <col className="w-[125px]" />
                        )}
                        {selectedSalaryColumns.includes("Gross Salary (Monthly)") && (
                          <col className="w-[125px]" />
                        )}
                        {selectedSalaryColumns.includes("Basic Salary") && (
                          <col className="w-[125px]" />
                        )}
                        {selectedSalaryColumns.includes("Employer PF (13%)") && (
                          <col className="w-[110px]" />
                        )}
                        {selectedSalaryColumns.includes("Employer ESIC (3.25%)") && (
                          <col className="w-[110px]" />
                        )}
                        {selectedSalaryColumns.includes("Employee PF (12%)") && (
                          <col className="w-[110px]" />
                        )}
                        {selectedSalaryColumns.includes("Employee ESIC (0.75%)") && (
                          <col className="w-[110px]" />
                        )}
                        {selectedSalaryColumns.includes("Professional Tax (PT)") && (
                          <col className="w-[95px]" />
                        )}
                        {selectedSalaryColumns.includes("Advance Balance") && (
                          <col className="w-[100px]" />
                        )}
                        {selectedSalaryColumns.includes("Uniform Deductions") && (
                          <col className="w-[100px]" />
                        )}
                        {selectedSalaryColumns.includes("Penalty Balance") && (
                          <col className="w-[100px]" />
                        )}
                        {selectedSalaryColumns.includes("Net Salary") && (
                          <col className="w-[125px]" />
                        )}
                        {selectedSalaryColumns.includes("Total Deductions") && (
                          <col className="w-[125px]" />
                        )}
                        {selectedSalaryColumns.includes("Food Perk") && (
                          <col className="w-[105px]" />
                        )}
                        {selectedSalaryColumns.includes("Accommodation Perk") && (
                          <col className="w-[105px]" />
                        )}
                        {selectedSalaryColumns.includes("Conveyance Perk") && (
                          <col className="w-[105px]" />
                        )}
                        {selectedSalaryColumns.includes("Net Payable") && (
                          <col className="w-[140px]" />
                        )}
                      </colgroup>
                      <thead className="sticky top-0 bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-wider select-none border-b border-slate-200 z-10">
                        <tr>
                          <th rowSpan={2} className="px-2.5 py-2.5 border-r border-slate-200 bg-slate-100 text-center w-[48px] align-middle">
                            <input
                              id="salary-select-all"
                              name="salarySelectAll"
                              type="checkbox"
                              checked={filteredSalaryEmployees.length > 0 && selectedSalaryEmployeeIds.length === filteredSalaryEmployees.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSalaryEmployeeIds(filteredSalaryEmployees.map(emp => emp.id));
                                } else {
                                  setSelectedSalaryEmployeeIds([]);
                                }
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416] cursor-pointer"
                              title="Select All Employees"
                            />
                          </th>
                          {(selectedSalaryColumns.includes("Employee Code") || selectedSalaryColumns.includes("Employee Name")) && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Employee Details</th>
                          )}
                          {selectedSalaryColumns.includes("Skill Category") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Skill Category</th>
                          )}
                          {selectedSalaryColumns.includes("Job Role") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Job Role</th>
                          )}
                          {selectedSalaryColumns.includes("Present Days") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Days</th>
                          )}
                          {selectedSalaryColumns.includes("Total Salary") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Total Salary</th>
                          )}
                          {selectedSalaryColumns.includes("Gross Salary (Monthly)") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Gross Pay</th>
                          )}
                          {selectedSalaryColumns.includes("Basic Salary") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100 text-center">Basic Pay</th>
                          )}
                          {(() => {
                            const count = ["Employer PF (13%)", "Employer ESIC (3.25%)"].filter(c => selectedSalaryColumns.includes(c)).length;
                            return count > 0 ? (
                              <th className="px-3 py-2.5 border-r border-slate-200 bg-blue-50 text-blue-700 text-center" colSpan={count}>Employer Liability</th>
                            ) : null;
                          })()}
                          {(() => {
                            const count = ["Employee PF (12%)", "Employee ESIC (0.75%)", "Professional Tax (PT)", "Advance Balance", "Uniform Deductions", "Penalty Balance"].filter(c => selectedSalaryColumns.includes(c)).length;
                            return count > 0 ? (
                              <th className="px-3 py-2.5 border-r border-slate-200 bg-rose-50 text-rose-700 text-center" colSpan={count}>Employee Deductions</th>
                            ) : null;
                          })()}
                          {selectedSalaryColumns.includes("Net Salary") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-amber-50 text-amber-700 text-center">Net Salary</th>
                          )}
                          {selectedSalaryColumns.includes("Total Deductions") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-rose-100 text-rose-800 text-center">Total Deductions</th>
                          )}
                          {(() => {
                            const count = ["Food Perk", "Accommodation Perk", "Conveyance Perk"].filter(c => selectedSalaryColumns.includes(c)).length;
                            return count > 0 ? (
                              <th className="px-3 py-2.5 border-r border-slate-200 bg-indigo-50 text-indigo-700 text-center" colSpan={count}>Extra Perks (Click to Edit)</th>
                            ) : null;
                          })()}
                          {selectedSalaryColumns.includes("Net Payable") && (
                            <th className="px-3 py-2.5 bg-emerald-50 text-emerald-800 text-right">Net Payable</th>
                          )}
                        </tr>
                        <tr className="border-t border-slate-200">
                          {(selectedSalaryColumns.includes("Employee Code") || selectedSalaryColumns.includes("Employee Name")) && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100 font-bold">Code & Name</th>
                          )}
                          {selectedSalaryColumns.includes("Skill Category") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold">Skill Category</th>
                          )}
                          {selectedSalaryColumns.includes("Job Role") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold">Job Role</th>
                          )}
                          {selectedSalaryColumns.includes("Present Days") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold">Present Days</th>
                          )}
                          {selectedSalaryColumns.includes("Total Salary") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold">Total Salary (Full Month)</th>
                          )}
                          {selectedSalaryColumns.includes("Gross Salary (Monthly)") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold">Gross (Monthly)</th>
                          )}
                          {selectedSalaryColumns.includes("Basic Salary") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold">Basic Salary</th>
                          )}
                          
                          {selectedSalaryColumns.includes("Employer PF (13%)") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-blue-50/40 text-blue-800">PF</th>
                          )}
                          {selectedSalaryColumns.includes("Employer ESIC (3.25%)") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-blue-50/40 text-blue-800">ESIC</th>
                          )}
                          
                          {selectedSalaryColumns.includes("Employee PF (12%)") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50/40 text-rose-800">PF</th>
                          )}
                          {selectedSalaryColumns.includes("Employee ESIC (0.75%)") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50/40 text-rose-800">ESIC</th>
                          )}
                          {selectedSalaryColumns.includes("Professional Tax (PT)") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50/40 text-rose-800">PT</th>
                          )}
                          {selectedSalaryColumns.includes("Advance Balance") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50/40 text-rose-800">Adv</th>
                          )}
                          {selectedSalaryColumns.includes("Uniform Deductions") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50/40 text-rose-800">Uniform</th>
                          )}
                          {selectedSalaryColumns.includes("Penalty Balance") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-rose-50/40 text-rose-800">Pen</th>
                          )}
                          
                          {selectedSalaryColumns.includes("Net Salary") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-amber-50/40 text-amber-800 text-center font-bold">Net Salary</th>
                          )}
                          {selectedSalaryColumns.includes("Total Deductions") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-rose-100/40 text-rose-900 text-center font-bold">Total Ded.</th>
                          )}
                          
                          {selectedSalaryColumns.includes("Food Perk") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-indigo-50/40 text-indigo-800">Food</th>
                          )}
                          {selectedSalaryColumns.includes("Accommodation Perk") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-indigo-50/40 text-indigo-800">Accom</th>
                          )}
                          {selectedSalaryColumns.includes("Conveyance Perk") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 text-center font-bold bg-indigo-50/40 text-indigo-800">Conv</th>
                          )}
                          
                          {selectedSalaryColumns.includes("Net Payable") && (
                            <th className="px-3 py-2.5 border-r border-slate-200 bg-emerald-50/40 text-emerald-800 text-right font-black">Net Payable</th>
                          )}
                          {selectedSalaryColumns.includes("Payment Status") && (
                            <th className="px-3 py-2.5 border-l border-slate-200 bg-violet-50 text-violet-900 text-center font-bold">Status</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {filteredSalaryEmployees.length === 0 ? (
                          <tr>
                            <td 
                              colSpan={
                                1 +
                                ((selectedSalaryColumns.includes("Employee Code") || selectedSalaryColumns.includes("Employee Name")) ? 1 : 0) +
                                ["Skill Category", "Job Role", "Present Days", "Total Salary", "Gross Salary (Monthly)", "Basic Salary", "Employer PF (13%)", "Employer ESIC (3.25%)", "Employee PF (12%)", "Employee ESIC (0.75%)", "Professional Tax (PT)", "Advance Balance", "Uniform Deductions", "Penalty Balance", "Net Salary", "Total Deductions", "Food Perk", "Accommodation Perk", "Conveyance Perk", "Net Payable", "Payment Status"].filter(c => selectedSalaryColumns.includes(c)).length
                              } 
                              className="p-8 text-center text-xs text-slate-400 font-medium"
                            >
                              No employee calculation data available matching filters.
                            </td>
                          </tr>
                        ) : (
                          filteredSalaryEmployees.map((emp) => {
                            const monthData = attendanceDb[selectedMonth] || {};
                            const empData = monthData[emp.id] || {};
                            const daysInMonth = getDaysInSelectedMonth(selectedMonth);
                            let presents = 0;
                            for (let i = 1; i <= daysInMonth; i++) {
                              if (isEmployeeExitedOnDayStatic(emp, selectedMonth, i)) {
                                continue;
                              }
                              if (empData[i] === "P") presents++;
                            }

                             const rawGross = safeNumber(emp.grossSalary);
                             const rawBasic = safeNumber(emp.basicSalary);

                             const gross = prorateSalaryByAttendance(rawGross, daysInMonth, presents, empData);
                             const basic = prorateSalaryByAttendance(rawBasic, daysInMonth, presents, empData);

                             const isLocCompliant = emp.location ? !!locationCompliance[emp.location] : false;
                             const isEmpCompliant = emp.complianceEnabled !== false;
                             const isCompliant = isLocCompliant && isEmpCompliant;

                             const { employeePf: empPf, employerPf: erPf } = calculatePfAmounts(gross, {
                               mode: emp.pfCalculationMode,
                               isCompliant,
                             });
                             const isEsicCovered = isEmployeeEsicCovered(gross, esicEligibilityLimit, isCompliant, emp.esic);
                             const erEsic = isEsicCovered ? (gross * 0.0325) : 0;
                             const ledger = emp.monthlyLedger?.[selectedMonth];
                             const adv = ledger ? safeNumber(ledger.advance) : 0;
                             const pen = ledger ? safeNumber(ledger.penalty) : 0;
                             const uniform = ledger ? safeNumber(ledger.uniform) : 0;
                             
                             const food = ledger ? safeNumber(ledger.foodPerk) : 0;
                             const acc = ledger ? safeNumber(ledger.accommodationPerk) : 0;
                             const conv = ledger ? safeNumber(ledger.conveyancePerk) : 0;
                             
                             const empEsic = isEsicCovered ? (gross * 0.0075) : 0;
                             const pt = calculateProfessionalTax(gross, {
                               isCompliant,
                               locationPtAmount: resolveLocationPtAmount(emp.location, locationPtAmounts),
                             });
                             
                             const netSalaryValue = safeNumber(gross) - safeNumber(empPf) - safeNumber(empEsic) - safeNumber(pt);
                             const totalDeductionsValue = safeNumber(empPf) + safeNumber(empEsic) + safeNumber(pt) + safeNumber(adv) + safeNumber(pen) + safeNumber(uniform);
                             const netPayableValue = safeNumber(netSalaryValue) - safeNumber(adv) - safeNumber(pen) - safeNumber(uniform) + safeNumber(food) + safeNumber(acc) + safeNumber(conv);
                            
                            const isSelected = selectedSalaryEmployeeIds.includes(emp.id);
                            
                            return (
                              <tr 
                                key={emp.id} 
                                className={`hover:bg-slate-50/40 transition border-b border-slate-150 align-middle ${
                                  isSelected ? "bg-orange-50/20 hover:bg-orange-50/30" : ""
                                }`}
                              >
                                <td className="px-2.5 py-2.5 border-r border-slate-150 text-center w-[48px] align-middle bg-slate-50/10">
                                  <input id={`salary-select-${emp.id}`} name={`salarySelect_${emp.id}`}
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setSelectedSalaryEmployeeIds(prev => 
                                        prev.includes(emp.id)
                                          ? prev.filter(id => id !== emp.id)
                                          : [...prev, emp.id]
                                      );
                                    }}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#f57416] focus:ring-[#f57416] cursor-pointer"
                                  />
                                </td>
                                {(selectedSalaryColumns.includes("Employee Code") || selectedSalaryColumns.includes("Employee Name")) && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 font-bold text-slate-700 bg-slate-50/20 text-left truncate">
                                    {selectedSalaryColumns.includes("Employee Name") && (
                                      <div className="truncate" title={emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}>{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</div>
                                    )}
                                    {selectedSalaryColumns.includes("Employee Code") && (
                                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate" title={`${emp.employeeCode} • ${emp.location || "No Site"}`}>{emp.employeeCode} • {emp.location || "No Site"}</div>
                                    )}
                                  </td>
                                )}

                                {selectedSalaryColumns.includes("Skill Category") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center font-medium bg-slate-50/10 truncate" title={emp.skillCategory || "-"}>
                                    {emp.skillCategory || "-"}
                                  </td>
                                )}
                                {selectedSalaryColumns.includes("Job Role") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center font-medium bg-slate-50/10 truncate" title={emp.role || "-"}>
                                    {emp.role || "-"}
                                  </td>
                                )}
                                
                                {selectedSalaryColumns.includes("Present Days") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center font-semibold text-[#f57416] bg-orange-50/10">
                                    {presents}
                                  </td>
                                )}
                                
                                {selectedSalaryColumns.includes("Total Salary") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center font-semibold text-slate-700 bg-slate-50/10">₹{rawGross.toLocaleString("en-IN")}</td>
                                )}
                                {selectedSalaryColumns.includes("Gross Salary (Monthly)") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center font-medium">₹{gross.toLocaleString("en-IN")}</td>
                                )}
                                
                                {selectedSalaryColumns.includes("Basic Salary") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center font-medium text-slate-655 bg-slate-50/10">₹{basic.toLocaleString("en-IN")}</td>
                                )}
                                
                                {selectedSalaryColumns.includes("Employer PF (13%)") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center text-blue-800 bg-blue-50/10 font-semibold">{isCompliant ? `₹${Math.round(erPf).toLocaleString("en-IN")}` : ""}</td>
                                )}
                                {selectedSalaryColumns.includes("Employer ESIC (3.25%)") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center text-blue-800 bg-blue-50/10 font-semibold">{isCompliant ? `₹${Math.round(erEsic).toLocaleString("en-IN")}` : ""}</td>
                                )}
                                
                                {selectedSalaryColumns.includes("Employee PF (12%)") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center text-rose-800 bg-rose-50/10 font-semibold">{isCompliant ? `₹${Math.round(empPf).toLocaleString("en-IN")}` : ""}</td>
                                )}
                                {selectedSalaryColumns.includes("Employee ESIC (0.75%)") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center text-rose-800 bg-rose-50/10 font-semibold">{isCompliant ? `₹${Math.round(empEsic).toLocaleString("en-IN")}` : ""}</td>
                                )}
                                {selectedSalaryColumns.includes("Professional Tax (PT)") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center text-rose-800 bg-rose-50/10 font-medium">{isCompliant ? `₹${pt}` : ""}</td>
                                )}
                                {selectedSalaryColumns.includes("Advance Balance") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center text-rose-900 bg-rose-50/10">
                                    {adv > 0 ? <span className="font-semibold text-blue-700">₹{adv}</span> : "-"}
                                  </td>
                                )}
                                {selectedSalaryColumns.includes("Uniform Deductions") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center text-rose-900 bg-rose-50/10">
                                    {uniform > 0 ? <span className="font-semibold text-rose-600">₹{uniform}</span> : "-"}
                                  </td>
                                )}
                                {selectedSalaryColumns.includes("Penalty Balance") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center text-rose-900 bg-rose-50/10">
                                    {pen > 0 ? <span className="font-semibold text-rose-600">₹{pen}</span> : "-"}
                                  </td>
                                )}
                                
                                {selectedSalaryColumns.includes("Net Salary") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center text-amber-800 bg-amber-50/10 font-semibold">
                                    ₹{Math.round(netSalaryValue).toLocaleString("en-IN")}
                                  </td>
                                )}
                                
                                {selectedSalaryColumns.includes("Total Deductions") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 text-center text-rose-900 bg-rose-100/10 font-semibold">
                                    ₹{Math.round(totalDeductionsValue).toLocaleString("en-IN")}
                                  </td>
                                )}
                                
                                {selectedSalaryColumns.includes("Food Perk") && (
                                  <td className="px-2 py-1.5 border-r border-slate-150 text-center bg-indigo-50/10 align-middle">
                                    <input id={`salary-food-${emp.id}`} name={`salaryFood_${emp.id}`}
                                      key={`food-${emp.id}-${selectedMonth}-${food}`}
                                      type="number"
                                      defaultValue={food || ""}
                                      onBlur={(e) => handleUpdatePerkValue(emp.id, "foodPerk", e.target.value)}
                                      disabled={!userPermissions.salary?.edit}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      placeholder="0"
                                      className="w-full px-2 py-1 border border-slate-200 bg-white rounded font-semibold text-center text-indigo-700 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 text-xs shadow-2xs"
                                    />
                                  </td>
                                )}
                                {selectedSalaryColumns.includes("Accommodation Perk") && (
                                  <td className="px-2 py-1.5 border-r border-slate-150 text-center bg-indigo-50/10 align-middle">
                                    <input id={`salary-accom-${emp.id}`} name={`salaryAccom_${emp.id}`}
                                      key={`accom-${emp.id}-${selectedMonth}-${acc}`}
                                      type="number"
                                      defaultValue={acc || ""}
                                      onBlur={(e) => handleUpdatePerkValue(emp.id, "accommodationPerk", e.target.value)}
                                      disabled={!userPermissions.salary?.edit}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      placeholder="0"
                                      className="w-full px-2 py-1 border border-slate-200 bg-white rounded font-semibold text-center text-indigo-700 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 text-xs shadow-2xs"
                                    />
                                  </td>
                                )}
                                {selectedSalaryColumns.includes("Conveyance Perk") && (
                                  <td className="px-2 py-1.5 border-r border-slate-150 text-center bg-indigo-50/10 align-middle">
                                    <input id={`salary-conv-${emp.id}`} name={`salaryConv_${emp.id}`}
                                      key={`conv-${emp.id}-${selectedMonth}-${conv}`}
                                      type="number"
                                      defaultValue={conv || ""}
                                      onBlur={(e) => handleUpdatePerkValue(emp.id, "conveyancePerk", e.target.value)}
                                      disabled={!userPermissions.salary?.edit}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      placeholder="0"
                                      className="w-full px-2 py-1 border border-slate-200 bg-white rounded font-semibold text-center text-[#ff791a] focus:outline-none focus:border-orange-450 focus:ring-1 focus:ring-orange-450 text-xs shadow-2xs"
                                    />
                                  </td>
                                )}
                                
                                {selectedSalaryColumns.includes("Net Payable") && (
                                  <td className="px-3 py-2.5 border-r border-slate-150 bg-emerald-50 text-emerald-800 text-right font-black text-xs">
                                    ₹{Math.round(Math.max(0, netPayableValue)).toLocaleString("en-IN")}
                                  </td>
                                )}
                                {selectedSalaryColumns.includes("Payment Status") && (
                                  <td className={`px-2 py-1.5 border-l border-r border-slate-150 text-center align-middle bg-violet-50 ${isSelected ? "!bg-orange-50" : ""}`}>
                                    <select id={`payment-status-${emp.id}`} name={`paymentStatus_${emp.id}`}
                                      value={ledger?.paymentStatus || "Unpaid"}
                                      disabled={!userPermissions.salary?.edit}
                                      onChange={(e) => handleUpdatePaymentStatus(emp.id, e.target.value as "Unpaid" | "Paid" | "Hold")}
                                      className={`px-2 py-1 rounded text-xs font-bold focus:outline-none transition border cursor-pointer ${
                                        (ledger?.paymentStatus || "Unpaid") === "Paid"
                                          ? "bg-emerald-55 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                          : (ledger?.paymentStatus || "Unpaid") === "Hold"
                                          ? "bg-amber-50 border-amber-250 text-amber-700 hover:bg-amber-100"
                                          : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                                      }`}
                                    >
                                      <option value="Unpaid">Unpaid</option>
                                      <option value="Paid">Paid</option>
                                      <option value="Hold">Hold</option>
                                    </select>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : activeSidebarTab === "Saved Bulk Pay" ? (
              <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="saved-bulk-pay-module-view">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                        <Archive size={20} className="text-[#7c3aed]" /> Saved Bulk Pay Files
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Axis Bank bulk pay Excel files archived on the server — stored with filename, month, and year for easy lookup and re-download.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {bulkPayArchiveYears.length > 0 && (
                        <select
                          id="bulk-pay-year-filter"
                          value={bulkPayArchiveYearFilter}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBulkPayArchiveYearFilter(value);
                            fetchBulkPayArchives(value);
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:border-[#7c3aed] transition"
                        >
                          <option value="">All Years</option>
                          {bulkPayArchiveYears.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => fetchBulkPayArchives()}
                        className="px-3.5 py-1.5 bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <RotateCw size={13} /> Refresh
                      </button>
                    </div>
                  </div>

                  {lastSavedBulkPay && highlightedBulkPayId === lastSavedBulkPay.id && (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-violet-800 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Just Saved
                        </p>
                        <p className="text-[11px] text-violet-700 mt-1 font-mono truncate" title={lastSavedBulkPay.filename}>
                          {lastSavedBulkPay.filename}
                        </p>
                        <p className="text-[10px] text-violet-500 mt-0.5">
                          {lastSavedBulkPay.month} {lastSavedBulkPay.year} · {lastSavedBulkPay.recordCount} records · ₹{Number(lastSavedBulkPay.totalAmount || 0).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadBulkPayArchive(lastSavedBulkPay.id, lastSavedBulkPay.filename)}
                          className="px-3 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Download size={11} /> Re-download
                        </button>
                        {userPermissions.salary?.edit && (
                          <button
                            type="button"
                            onClick={() => handleDeleteBulkPayArchive(lastSavedBulkPay.id)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isFetchingBulkPayArchives ? (
                    <p className="text-sm text-slate-500">Loading saved files...</p>
                  ) : filteredBulkPayArchives.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <Archive size={32} className="mx-auto text-slate-300" />
                      <p className="text-sm text-slate-500 font-semibold">No bulk pay files saved yet</p>
                      <p className="text-xs text-slate-400">
                        Export bulk pay from the Salary module to automatically archive the Excel sheet here.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveSidebarTab("Salary")}
                        className="mt-2 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold text-xs rounded-lg cursor-pointer transition"
                      >
                        Go to Salary
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-500 uppercase tracking-wide border-b border-slate-200">
                            <th className="py-2.5 pr-4 font-bold">Saved On</th>
                            <th className="py-2.5 pr-4 font-bold">Month</th>
                            <th className="py-2.5 pr-4 font-bold">Year</th>
                            <th className="py-2.5 pr-4 font-bold">Filename</th>
                            <th className="py-2.5 pr-4 font-bold">Records</th>
                            <th className="py-2.5 pr-4 font-bold">Total Amount</th>
                            <th className="py-2.5 pr-4 font-bold">Exported By</th>
                            <th className="py-2.5 font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBulkPayArchives.map((item: any) => {
                            const displayMonth = item.year
                              ? item.month
                              : parseMonthYear(item.month).month;
                            const displayYear = item.year || parseMonthYear(item.month).year;
                            const isHighlighted = highlightedBulkPayId === item.id;
                            return (
                              <tr
                                key={item.id}
                                className={`border-b border-slate-50 hover:bg-slate-50/70 ${isHighlighted ? "bg-violet-50 ring-1 ring-inset ring-violet-200" : ""}`}
                              >
                                <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600">
                                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                                </td>
                                <td className="py-2.5 pr-4 font-semibold text-slate-700">{displayMonth || "—"}</td>
                                <td className="py-2.5 pr-4 font-semibold text-slate-700">{displayYear || "—"}</td>
                                <td className="py-2.5 pr-4 max-w-[260px]" title={item.filename}>
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <FileSpreadsheet size={14} className="text-emerald-600 shrink-0" />
                                    <span className="truncate font-mono text-[11px] text-slate-700">{item.filename}</span>
                                  </span>
                                </td>
                                <td className="py-2.5 pr-4">{item.recordCount ?? 0}</td>
                                <td className="py-2.5 pr-4 font-mono">
                                  ₹{Number(item.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2.5 pr-4">{item.username || "—"}</td>
                                <td className="py-2.5 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadBulkPayArchive(item.id, item.filename)}
                                      className="px-2.5 py-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Download size={11} /> Re-download
                                    </button>
                                    {userPermissions.salary?.edit && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteBulkPayArchive(item.id)}
                                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
           ) : activeSidebarTab === "Advance & Penalty" ? (
              /* --- ADVANCE & PENALTY LEDGER VIEW --- */
              <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="advance-penalty-module-view">
                {/* 1. Module Header */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="text-left">
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                      <Calculator size={20} className="text-[#ff791a]" /> Monthly Settlement & Penalty Ledger
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Perform batch monthly settlements for advances, penalties, and perks. All entries are keyed and saved per-month dynamically.
                    </p>
                  </div>
                  
                  {/* Month Selection Sync */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-slate-500">Active Month:</span>
                    <select id="ledger-month-select" name="selectedMonth"
                      value={MONTHS_LIST.includes(selectedMonth) ? selectedMonth : (MONTHS_LIST[0] || selectedMonth)}
                      onChange={(e) => setSelectedMonth(normalizeMonthKey(e.target.value))}
                      className="px-3.5 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:border-orange-500 transition"
                    >
                      {MONTHS_LIST.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Top Summary metrics computed for the selected Month */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs text-left">
                    <span className="text-[9px] text-blue-500 font-bold uppercase tracking-wider block">Advances ({selectedMonth})</span>
                    <span className="text-base font-extrabold text-blue-800 block mt-0.5">
                      ₹{employees.reduce((sum, e) => sum + (Number(e.monthlyLedger?.[selectedMonth]?.advance || 0)), 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs text-left">
                    <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider block">Penalties ({selectedMonth})</span>
                    <span className="text-base font-extrabold text-rose-800 block mt-0.5">
                      ₹{employees.reduce((sum, e) => sum + (Number(e.monthlyLedger?.[selectedMonth]?.penalty || 0)), 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs text-left">
                    <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider block">Food Perks ({selectedMonth})</span>
                    <span className="text-base font-extrabold text-indigo-800 block mt-0.5">
                      ₹{employees.reduce((sum, e) => sum + (Number(e.monthlyLedger?.[selectedMonth]?.foodPerk || 0)), 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs text-left">
                    <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider block">Accom. Perks ({selectedMonth})</span>
                    <span className="text-base font-extrabold text-indigo-800 block mt-0.5">
                      ₹{employees.reduce((sum, e) => sum + (Number(e.monthlyLedger?.[selectedMonth]?.accommodationPerk || 0)), 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs text-left col-span-2 lg:col-span-1">
                    <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider block">Conv. Perks ({selectedMonth})</span>
                    <span className="text-base font-extrabold text-indigo-800 block mt-0.5">
                      ₹{employees.reduce((sum, e) => sum + (Number(e.monthlyLedger?.[selectedMonth]?.conveyancePerk || 0)), 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
                {/* 3. Grid split: 2/5 Interactive Search & Checklist and 3/5 Ledger Entry rows */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Left Column: Interactive Employee checklist with search */}
                  <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col space-y-4 h-[640px]">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        1. Select Employees
                      </h4>
                      <div className="flex gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            const matchedIds = employees
                              .filter(emp => {
                                if (isEmployeeExitedForMonth(emp, selectedMonth)) return false;
                                const q = ledgerSearchQuery.toLowerCase().trim();
                                const matchesSearch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "").toLowerCase().includes(q);
                                const matchesLocation = ledgerLocationFilters.length === 0 || ledgerLocationFilters.some(f => (emp.location || "").toLowerCase() === f.toLowerCase());
                                const matchesSkill = employeeMatchesSkillFilters(emp, ledgerSkillFilters);
                                const matchesRole = ledgerRoleFilters.length === 0 || ledgerRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase());
                                return matchesSearch && matchesLocation && matchesSkill && matchesRole;
                              })
                              .map(e => e.id);
                            setLedgerSelectedEmployeeIds(prev => Array.from(new Set([...prev, ...matchedIds])));
                          }}
                          className="text-orange-600 hover:text-orange-700 font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-350">|</span>
                        <button
                          type="button"
                          onClick={() => setLedgerSelectedEmployeeIds([])}
                          className="text-slate-500 hover:text-slate-650 font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Premium Spacious Dynamic Filters Grid */}
                    <div className="grid grid-cols-1 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-150 text-[10px] text-left">
                      {/* Location Filter */}
                      <div className="space-y-1 relative" id="ledger-location-multiselect-container">
                        <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Branch/Site</span>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setIsLedgerLocationDropdownOpen(!isLedgerLocationDropdownOpen);
                              setIsLedgerSkillDropdownOpen(false);
                              setIsLedgerRoleDropdownOpen(false);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-250 bg-white rounded text-[10px] font-bold text-slate-700 focus:outline-none focus:border-[#ff791a] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                          >
                            <span className="truncate">
                              {ledgerLocationFilters.length === 0 
                                ? "All Sites" 
                                : `${ledgerLocationFilters.length} Selected`}
                            </span>
                            <span className="text-[8px] text-slate-400">▼</span>
                          </button>
                          
                          {isLedgerLocationDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                <span className="text-[9px] text-slate-400 font-bold">Branches</span>
                                <button
                                  type="button"
                                  onClick={() => setLedgerLocationFilters([])}
                                  className="text-[9px] font-black uppercase text-slate-500 hover:text-[#ff791a] cursor-pointer"
                                >
                                  Clear All
                                </button>
                              </div>
                              {ledgerUniqueLocations.map(loc => {
                                const isChecked = ledgerLocationFilters.some(f => f.toLowerCase() === loc.toLowerCase());
                                const toggle = () => {
                                  if (isChecked) {
                                    setLedgerLocationFilters(prev => prev.filter(c => c.toLowerCase() !== loc.toLowerCase()));
                                  } else {
                                    setLedgerLocationFilters(prev => [...prev, loc]);
                                  }
                                };
                                return (
                                  <label key={loc} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-[10px] text-slate-700 cursor-pointer select-none">
                                    <input id="checkbox-field-6761" name="checkbox_6761"
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={toggle}
                                      className="w-3.5 h-3.5 rounded border-slate-350 text-[#ff791a] focus:ring-[#ff791a]"
                                    />
                                    <span className="font-semibold">{loc}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Skill Filter */}
                      <div className="space-y-1 relative" id="ledger-skill-multiselect-container">
                        <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Skill Category</span>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setIsLedgerSkillDropdownOpen(!isLedgerSkillDropdownOpen);
                              setIsLedgerLocationDropdownOpen(false);
                              setIsLedgerRoleDropdownOpen(false);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-250 bg-white rounded text-[10px] font-bold text-slate-700 focus:outline-none focus:border-[#ff791a] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                          >
                            <span className="truncate">
                              {ledgerSkillFilters.length === 0 
                                ? "All Categories" 
                                : `${ledgerSkillFilters.length} Selected`}
                            </span>
                            <span className="text-[8px] text-slate-400">▼</span>
                          </button>
                          
                          {isLedgerSkillDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                <span className="text-[9px] text-slate-400 font-bold">Categories</span>
                                <button
                                  type="button"
                                  onClick={() => setLedgerSkillFilters([])}
                                  className="text-[9px] font-black uppercase text-slate-500 hover:text-[#ff791a] cursor-pointer"
                                >
                                  Clear All
                                </button>
                              </div>
                              {ledgerUniqueSkills.map(sk => {
                                const isChecked = ledgerSkillFilters.some(f => f.toLowerCase() === sk.toLowerCase());
                                const toggle = () => {
                                  if (isChecked) {
                                    setLedgerSkillFilters(prev => prev.filter(c => c.toLowerCase() !== sk.toLowerCase()));
                                  } else {
                                    setLedgerSkillFilters(prev => [...prev, sk]);
                                  }
                                };
                                return (
                                  <label key={sk} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-[10px] text-slate-700 cursor-pointer select-none">
                                    <input id="checkbox-field-6820" name="checkbox_6820"
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={toggle}
                                      className="w-3.5 h-3.5 rounded border-slate-350 text-[#ff791a] focus:ring-[#ff791a]"
                                    />
                                    <span className="font-semibold">{sk}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Role Filter */}
                      <div className="space-y-1 relative" id="ledger-role-multiselect-container">
                        <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Job Role</span>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setIsLedgerRoleDropdownOpen(!isLedgerRoleDropdownOpen);
                              setIsLedgerLocationDropdownOpen(false);
                              setIsLedgerSkillDropdownOpen(false);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-250 bg-white rounded text-[10px] font-bold text-slate-700 focus:outline-none focus:border-[#ff791a] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                          >
                            <span className="truncate">
                              {ledgerRoleFilters.length === 0 
                                ? "All Roles" 
                                : `${ledgerRoleFilters.length} Selected`}
                            </span>
                            <span className="text-[8px] text-slate-400">▼</span>
                          </button>
                          
                          {isLedgerRoleDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                <span className="text-[9px] text-slate-400 font-bold">Roles</span>
                                <button
                                  type="button"
                                  onClick={() => setLedgerRoleFilters([])}
                                  className="text-[9px] font-black uppercase text-slate-500 hover:text-[#ff791a] cursor-pointer"
                                >
                                  Clear All
                                </button>
                              </div>
                              {ledgerUniqueRoles.map(role => {
                                const isChecked = ledgerRoleFilters.some(f => f.toLowerCase() === role.toLowerCase());
                                const toggle = () => {
                                  if (isChecked) {
                                    setLedgerRoleFilters(prev => prev.filter(c => c.toLowerCase() !== role.toLowerCase()));
                                  } else {
                                    setLedgerRoleFilters(prev => [...prev, role]);
                                  }
                                };
                                return (
                                  <label key={role} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-[10px] text-slate-700 cursor-pointer select-none">
                                    <input id="checkbox-field-6879" name="checkbox_6879"
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={toggle}
                                      className="w-3.5 h-3.5 rounded border-slate-350 text-[#ff791a] focus:ring-[#ff791a]"
                                    />
                                    <span className="font-semibold">{role}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Search box for checklist */}
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                      <input id="ledger-search-query" name="ledgerSearchQuery"
                        type="text"
                        placeholder="Search by code or name..."
                        value={ledgerSearchQuery}
                        onChange={(e) => setLedgerSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    {/* Employees list checkboxes */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg p-2 bg-slate-50/30">
                      {employees.filter(emp => {
                        if (isEmployeeExitedForMonth(emp, selectedMonth)) return false;
                        const q = ledgerSearchQuery.toLowerCase().trim();
                        const matchesSearch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "").toLowerCase().includes(q);
                        const matchesLocation = ledgerLocationFilters.length === 0 || ledgerLocationFilters.some(f => (emp.location || "").toLowerCase() === f.toLowerCase());
                        const matchesSkill = employeeMatchesSkillFilters(emp, ledgerSkillFilters);
                        const matchesRole = ledgerRoleFilters.length === 0 || ledgerRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase());
                        return matchesSearch && matchesLocation && matchesSkill && matchesRole;
                      }).length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-450">No matching employees found.</div>
                      ) : (
                        employees.filter(emp => {
                          if (isEmployeeExitedForMonth(emp, selectedMonth)) return false;
                          const q = ledgerSearchQuery.toLowerCase().trim();
                          const matchesSearch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "").toLowerCase().includes(q);
                          const matchesLocation = ledgerLocationFilters.length === 0 || ledgerLocationFilters.some(f => (emp.location || "").toLowerCase() === f.toLowerCase());
                          const matchesSkill = employeeMatchesSkillFilters(emp, ledgerSkillFilters);
                          const matchesRole = ledgerRoleFilters.length === 0 || ledgerRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase());
                          return matchesSearch && matchesLocation && matchesSkill && matchesRole;
                        }).map((emp) => {
                          const isChecked = ledgerSelectedEmployeeIds.includes(emp.id);
                          return (
                            <label key={emp.id} className="flex items-center gap-3 py-2 px-1.5 hover:bg-white rounded-md cursor-pointer transition select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setLedgerSelectedEmployeeIds(prev => [...prev, emp.id]);
                                  } else {
                                    setLedgerSelectedEmployeeIds(prev => prev.filter(id => id !== emp.id));
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded text-[#ff791a] focus:ring-orange-500 accent-orange-500 border-slate-300"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-700 truncate text-left">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</p>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5 text-left">{emp.employeeCode} • {emp.location || "No site"}</p>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Column: Dynamic inputs for each selected employee */}
                  <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col space-y-4 h-[640px]">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center justify-between">
                      <span>2. Record Monthly Settled Ledger Rows</span>
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{ledgerSelectedEmployeeIds.length} Selected</span>
                    </h4>

                    {ledgerSelectedEmployeeIds.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                        <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center text-2xl">
                          ✍️
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-600">Settlement Workspace Empty</p>
                          <p className="text-[11px] text-slate-400 max-w-xs">
                            Select one or multiple employees from the list on the left to record monthly advances, penalties, perks, and reasons for {selectedMonth}.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveBatchLedgerRecords} className="flex flex-col flex-1 overflow-hidden">
                        {/* Scrollable list of employee rows */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 scrollbar-thin">
                          {ledgerSelectedEmployeeIds.map((empId) => {
                            const emp = employees.find(e => e.id === empId);
                            if (!emp) return null;

                            const entry = tempLedgerEntries[empId] || {
                              advance: "0",
                              penalty: "0",
                              foodPerk: "0",
                              accommodationPerk: "0",
                              conveyancePerk: "0",
                              penaltyReason: ""
                            };

                            const updateField = (field: keyof typeof entry, val: string) => {
                              setTempLedgerEntries(prev => ({
                                ...prev,
                                [empId]: {
                                  ...(prev[empId] || entry),
                                  [field]: val
                                }
                              }));
                            };

                            return (
                              <div key={empId} className="p-3 bg-slate-50/50 border border-slate-200 rounded-xl space-y-2.5 relative text-left">
                                <button
                                  type="button"
                                  onClick={() => setLedgerSelectedEmployeeIds(prev => prev.filter(id => id !== empId))}
                                  className="absolute top-2 right-2 text-slate-400 hover:text-red-500 font-extrabold text-xs cursor-pointer"
                                  title="Remove from settlement list"
                                >
                                  ✕
                                </button>

                                <div className="pr-6">
                                  <span className="text-xs font-black text-slate-800">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</span>
                                  <span className="text-[9px] font-mono text-slate-400 ml-1.5">({emp.employeeCode})</span>
                                </div>

                                {/* Ledger inputs grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">💰 Advance</label>
                                    <input id={`ledger-advance-${empId}`} name={`ledgerAdvance_${empId}`}
                                      type="number"
                                      value={entry.advance}
                                      onChange={(e) => updateField("advance", e.target.value)}
                                      placeholder="0"
                                      className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-slate-800 focus:outline-none focus:border-orange-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">👕 Uniform</label>
                                    <input id={`ledger-uniform-${empId}`} name={`ledgerUniform_${empId}`}
                                      type="number"
                                      value={entry.uniform}
                                      onChange={(e) => updateField("uniform", e.target.value)}
                                      placeholder="0"
                                      className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-[#f57416] focus:outline-none focus:border-orange-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">⚠️ Penalty</label>
                                    <input id={`ledger-penalty-${empId}`} name={`ledgerPenalty_${empId}`}
                                      type="number"
                                      value={entry.penalty}
                                      onChange={(e) => updateField("penalty", e.target.value)}
                                      placeholder="0"
                                      className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-slate-800 focus:outline-none focus:border-orange-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">🍔 Food</label>
                                    <input id={`ledger-food-${empId}`} name={`ledgerFood_${empId}`}
                                      type="number"
                                      value={entry.foodPerk}
                                      onChange={(e) => updateField("foodPerk", e.target.value)}
                                      placeholder="0"
                                      className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-indigo-700 focus:outline-none focus:border-orange-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">🏠 Accom.</label>
                                    <input id={`ledger-accom-${empId}`} name={`ledgerAccom_${empId}`}
                                      type="number"
                                      value={entry.accommodationPerk}
                                      onChange={(e) => updateField("accommodationPerk", e.target.value)}
                                      placeholder="0"
                                      className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-indigo-700 focus:outline-none focus:border-orange-400"
                                    />
                                  </div>
                                  <div className="col-span-2 sm:col-span-1">
                                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">🚗 Conv.</label>
                                    <input id={`ledger-conv-${empId}`} name={`ledgerConv_${empId}`}
                                      type="number"
                                      value={entry.conveyancePerk}
                                      onChange={(e) => updateField("conveyancePerk", e.target.value)}
                                      placeholder="0"
                                      className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-[11px] font-bold text-indigo-700 focus:outline-none focus:border-orange-400"
                                    />
                                  </div>
                                </div>

                                {/* Textfield to remember penalty reason */}
                                <div>
                                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">📝 Settlement Reason / Penalty Notes</label>
                                  <input id={`ledger-penalty-reason-${empId}`} name={`ledgerPenaltyReason_${empId}`}
                                    type="text"
                                    value={entry.penaltyReason}
                                    onChange={(e) => updateField("penaltyReason", e.target.value)}
                                    placeholder="Enter reason for penalty, advance remarks, or perk approvals..."
                                    className="w-full px-2.5 py-1 border border-slate-200 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-orange-400"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Save Button */}
                        <div className="pt-3 border-t border-slate-100 flex gap-2">
                          <button
                            type="submit"
                            disabled={!userPermissions.ledger?.edit}
                            className="w-full py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold rounded-lg text-xs shadow-md transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            💾 Save Monthly Ledger Rows ({selectedMonth})
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>

                {/* 4. Bottom Section: Statement Overview Table for the Selected Month */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col space-y-4">
                  <div className="text-left">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Ledger Overview Sheet for {selectedMonth}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Visual registry of all recorded ledger records settled for the active month. Click [Clear] next to any component to reset individual fields dynamically.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                    <div className="bg-slate-100/50 px-4 py-2 border-b border-slate-200 grid grid-cols-10 text-[10px] font-black text-slate-500 uppercase tracking-wider text-left select-none">
                      <span className="col-span-2">Employee</span>
                      <span>Advance</span>
                      <span>Uniform</span>
                      <span>Penalty</span>
                      <span>Food</span>
                      <span>Accom.</span>
                      <span>Conv.</span>
                      <span className="col-span-2 text-center">Settlement Reason / Notes</span>
                    </div>

                    <div className="divide-y divide-slate-150 max-h-[350px] overflow-y-auto" id="ledger-records-container">
                      {employees.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-450 font-medium">No employees registered in the system database.</div>
                      ) : (
                        employees.map((emp) => {
                          const monthLedger = emp.monthlyLedger?.[selectedMonth];
                          const adv = monthLedger ? safeNumber(monthLedger.advance) : 0;
                          const uniform = monthLedger ? safeNumber(monthLedger.uniform) : 0;
                          const pen = monthLedger ? safeNumber(monthLedger.penalty) : 0;
                          const food = monthLedger ? safeNumber(monthLedger.foodPerk) : 0;
                          const acc = monthLedger ? safeNumber(monthLedger.accommodationPerk) : 0;
                          const conv = monthLedger ? safeNumber(monthLedger.conveyancePerk) : 0;
                          const reason = monthLedger ? monthLedger.penaltyReason : "";

                          const hasAnyEntry = adv > 0 || uniform > 0 || pen > 0 || food > 0 || acc > 0 || conv > 0 || reason;

                          return (
                            <div key={emp.id} className={`px-4 py-3 grid grid-cols-10 items-center hover:bg-slate-50/50 transition text-xs border-b border-slate-100 text-left ${hasAnyEntry ? "bg-orange-50/15" : ""}`}>
                              <div className="col-span-2 space-y-0.5 pr-2">
                                <p className="font-bold text-slate-800 truncate">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</p>
                                <p className="font-mono text-[9px] text-slate-450">{emp.employeeCode} • {emp.location || "Unassigned"}</p>
                              </div>

                              {/* Advance */}
                              <div>
                                {adv > 0 ? (
                                  renderClearButtonOrConfirm(emp.id, "advance", adv, "text-blue-700")
                                ) : (
                                  <span className="text-slate-350 font-mono">-</span>
                                )}
                              </div>

                              {/* Uniform */}
                              <div>
                                {uniform > 0 ? (
                                  renderClearButtonOrConfirm(emp.id, "uniform", uniform, "text-rose-600")
                                ) : (
                                  <span className="text-slate-350 font-mono">-</span>
                                )}
                              </div>

                              {/* Penalty */}
                              <div>
                                {pen > 0 ? (
                                  renderClearButtonOrConfirm(emp.id, "penalty", pen, "text-rose-600")
                                ) : (
                                  <span className="text-slate-350 font-mono">-</span>
                                )}
                              </div>

                              {/* Food */}
                              <div>
                                {food > 0 ? (
                                  renderClearButtonOrConfirm(emp.id, "foodPerk", food, "text-indigo-700")
                                ) : (
                                  <span className="text-slate-350 font-mono">-</span>
                                )}
                              </div>

                              {/* Accommodation */}
                              <div>
                                {acc > 0 ? (
                                  renderClearButtonOrConfirm(emp.id, "accommodationPerk", acc, "text-indigo-700")
                                ) : (
                                  <span className="text-slate-350 font-mono">-</span>
                                )}
                              </div>

                              {/* Conveyance */}
                              <div>
                                {conv > 0 ? (
                                  renderClearButtonOrConfirm(emp.id, "conveyancePerk", conv, "text-indigo-700")
                                ) : (
                                  <span className="text-slate-350 font-mono">-</span>
                                )}
                              </div>

                              {/* Reason Column */}
                              <div className="col-span-2 text-slate-500 italic pr-2 font-medium truncate text-center" title={reason || "No remarks"}>
                                {reason ? (
                                  <span className="not-italic text-slate-700 font-semibold text-[11px] block truncate">{reason}</span>
                                ) : (
                                  <span className="text-slate-300 font-normal">None recorded</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeSidebarTab === "Birthdays" ? (
              /* --- BIRTHDAYS CELEBRATION VIEW --- */
              <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="birthdays-celebration-tab-view">
                {/* 1. Header Bento Card */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
                  <div className="space-y-1.5 relative z-10">
                    <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                      <Cake size={22} className="animate-bounce" /> Enterprise Birthday Celebration Hub
                    </h3>
                    <p className="text-xs text-orange-50 mt-1">
                      Strengthening corporate bonds and employee wellness through personal milestones. Send greetings instantly.
                    </p>
                  </div>
                  
                  {/* Month Selection */}
                  <div className="flex items-center gap-2 shrink-0 relative z-10">
                    <span className="text-xs font-bold text-orange-50">Filter Month:</span>
                    <select id="birthday-search-month" name="birthdaySearchMonth"
                      value={birthdaySearchMonth}
                      onChange={(e) => setBirthdaySearchMonth(e.target.value)}
                      className="px-3.5 py-1.5 bg-white/20 border border-white/30 backdrop-blur-md rounded-lg text-xs font-bold text-white shadow-sm focus:outline-none focus:bg-white focus:text-slate-800 transition"
                    >
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m) => (
                        <option key={m} value={m} className="text-slate-800 font-medium">{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Today's Birthdays & Celebration Bento */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Celebrating Today Left Bento Card (Glowing and pulsing) */}
                  <div className="bg-white border-2 border-orange-500/30 rounded-2xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between text-left col-span-1 min-h-[300px]">
                    <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-orange-50 blur-xl pointer-events-none" />
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#ff791a] bg-orange-50 px-2.5 py-1 rounded-full">
                          🎉 Celebrating Today
                        </span>
                        <span className="text-xs font-bold text-slate-400">May 31</span>
                      </div>

                      {/* Filter active celebrating employees */}
                      {(() => {
                        const todayMonth = 5; // May
                        const todayDay = 31;  // 31st
                        const parseDOB = (dobStr: string | undefined | null) => {
                          if (!dobStr) return null;
                          const str = String(dobStr).trim();
                          let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
                          if (match) return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };
                          match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
                          if (match) return { year: parseInt(match[3]), month: parseInt(match[2]), day: parseInt(match[1]) };
                          const d = new Date(str);
                          if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
                          const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
                          const lower = str.toLowerCase();
                          for (let i = 0; i < 12; i++) {
                            if (lower.includes(months[i])) {
                              const dayMatch = lower.match(/\b(\d{1,2})\b/);
                              return { year: 1990, month: i + 1, day: dayMatch ? parseInt(dayMatch[1]) : 1 };
                            }
                          }
                          return null;
                        };

                        const todayBirthdays = employees.filter(emp => {
                          if (simulatedBirthdayEmpIds.includes(emp.id)) return true;
                          const dob = parseDOB(emp.dateOfBirth);
                          return dob ? (dob.month === todayMonth && dob.day === todayDay) : false;
                        });

                        if (todayBirthdays.length === 0) {
                          return (
                            <div className="space-y-4 py-4">
                              <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center text-2xl">
                                🍰
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-700">No birthdays recorded today</p>
                                <p className="text-[11px] text-slate-450 leading-relaxed">
                                  No employees have registered birth records for today, May 31. Want to test the dynamic birthday greeting screen?
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (employees.length > 0) {
                                    setSimulatedBirthdayEmpIds([employees[0].id, employees[1]?.id].filter(Boolean));
                                    triggerSuccess("🎉 Simulation active! Celebrating simulated birthdays today.");
                                  } else {
                                    setErrorMessage("No employees registered to simulate birthdays.");
                                  }
                                }}
                                className="px-3 py-1.5 border border-orange-500/20 hover:border-orange-500/50 bg-orange-50/20 hover:bg-orange-50/50 text-[#ff791a] font-bold text-[10px] rounded-lg shadow-sm transition uppercase tracking-wider cursor-pointer"
                              >
                                ✨ Simulate Birthdays Today
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3.5 py-2">
                            {todayBirthdays.map(emp => {
                              const dob = parseDOB(emp.dateOfBirth);
                              const currentYear = new Date().getFullYear();
                              const age = dob ? (currentYear - dob.year) : 28;
                              return (
                                <div key={emp.id} className="p-3 bg-gradient-to-r from-orange-50/50 to-amber-50/30 border border-orange-100 rounded-xl flex items-center gap-3 relative animate-pulse">
                                  <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center shadow-md">
                                    {emp.nameAsPerAadharColumn?.charAt(0) || emp.nameAsPerAadhar?.charAt(0) || "🎁"}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-xs font-black text-slate-800 truncate">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</h4>
                                    <p className="text-[10px] font-bold text-[#ff791a]">{emp.employeeCode} • {emp.location || "Branch office"}</p>
                                    <p className="text-[9px] text-slate-450 font-bold mt-0.5 uppercase tracking-wider font-mono">Turning {age} Today!</p>
                                  </div>
                                  <span className="text-xl">🎂</span>
                                </div>
                              );
                            })}

                            <div className="pt-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowConfetti(true);
                                  setTimeout(() => setShowConfetti(false), 4000);
                                  triggerSuccess("🎉 Virtual birthday greetings, balloons and gift vouchers successfully dispatched to celebrating employees!");
                                }}
                                className="w-full py-2.5 bg-[#ff791a] hover:bg-[#e4640c] text-white font-extrabold rounded-xl text-[10px] uppercase tracking-wider shadow-md hover:shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Gift size={12} /> Dispatch Gifts & Confetti 🎁
                              </button>
                              {simulatedBirthdayEmpIds.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSimulatedBirthdayEmpIds([])}
                                  className="w-full text-center text-[9px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider mt-2.5 cursor-pointer block"
                                >
                                  Reset Simulation
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Monthly Birthdays Grid Column (2/3 size) */}
                  <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col space-y-4 text-left">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Birthdays in {birthdaySearchMonth}
                      </h4>
                      <p className="text-[11px] text-slate-450 mt-0.5">
                        Directory registry of all personnel sharing an upcoming birthday this month. Send virtual cards to appreciate them.
                      </p>
                    </div>

                    {/* Birthdays scroll grid */}
                    <div className="flex-1 min-h-[300px] overflow-y-auto max-h-[420px] pr-1.5 scrollbar-thin">
                      {(() => {
                        const parseDOB = (dobStr: string | undefined | null) => {
                          if (!dobStr) return null;
                          const str = String(dobStr).trim();
                          let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
                          if (match) return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };
                          match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
                          if (match) return { year: parseInt(match[3]), month: parseInt(match[2]), day: parseInt(match[1]) };
                          const d = new Date(str);
                          if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
                          const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
                          const lower = str.toLowerCase();
                          for (let i = 0; i < 12; i++) {
                            if (lower.includes(months[i])) {
                              const dayMatch = lower.match(/\b(\d{1,2})\b/);
                              return { year: 1990, month: i + 1, day: dayMatch ? parseInt(dayMatch[1]) : 1 };
                            }
                          }
                          return null;
                        };

                        const birthdayMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                        const targetMonthNum = birthdayMonths.indexOf(birthdaySearchMonth) + 1;

                        const monthBirthdays = employees
                          .filter(emp => {
                            const dob = parseDOB(emp.dateOfBirth);
                            return dob ? dob.month === targetMonthNum : false;
                          })
                          .map(emp => {
                            const dob = parseDOB(emp.dateOfBirth);
                            return { emp, day: dob ? dob.day : 1 };
                          })
                          .sort((a, b) => a.day - b.day);

                        if (monthBirthdays.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center text-center py-16 space-y-3">
                              <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center text-2xl">
                                📅
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-600">No birthdays recorded in {birthdaySearchMonth}</p>
                                <p className="text-[11px] text-slate-450 max-w-xs">Amend employee date of birth metrics to update this schedule dynamically.</p>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {monthBirthdays.map(({ emp, day }) => {
                              const getOrdinal = (n: number) => {
                                const s = ["th", "st", "nd", "rd"];
                                const v = n % 100;
                                return n + (s[(v - 20) % 10] || s[v] || s[0]);
                              };

                              return (
                                <div key={emp.id} className="p-3 bg-white border border-slate-200 rounded-xl hover:-translate-y-1 hover:shadow-md transition-all flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs relative">
                                    {emp.nameAsPerAadharColumn?.charAt(0) || emp.nameAsPerAadhar?.charAt(0) || "U"}
                                    <div className="absolute -bottom-1 -right-1 text-xs">🎈</div>
                                  </div>
                                  <div className="min-w-0 flex-1 flex flex-col items-start">
                                    <h4 className="text-xs font-bold text-slate-800 truncate w-full text-left">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</h4>
                                    <p className="text-[9px] font-mono text-slate-450 mt-0.5">{emp.employeeCode} • {emp.location || "No Site"}</p>
                                    <p className="text-[10px] font-black text-[#ff791a] mt-0.5">{getOrdinal(day)} {birthdaySearchMonth}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowConfetti(true);
                                      setTimeout(() => setShowConfetti(false), 4000);
                                      triggerSuccess(`🎉 Dispatched a virtual birthday greeting card to ${emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}!`);
                                    }}
                                    className="p-2 bg-orange-50 hover:bg-orange-100 text-[#ff791a] rounded-lg shadow-sm transition active:scale-95 cursor-pointer shrink-0"
                                    title="Send Greeting"
                                  >
                                    <Gift size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeSidebarTab === "Directory" ? (
              /* --- ENTERPRISE DIRECTORY VIEW --- */
              <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="directory-tab-view">
                {/* 1. Sub navigation controls & Header */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                      <Contact size={20} className="text-[#ff791a]" /> HRMS Corporate Contacts Directory
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Lookup team profiles, department hierarchies, or official client/support desk numbers instantly.
                    </p>
                  </div>

                  {/* Sub tab selectors */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveDirectorySubTab("employees")}
                      className={`px-4 py-1.5 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                        activeDirectorySubTab === "employees" ? "bg-[#ff791a] text-white shadow-sm" : "text-slate-650 hover:text-slate-900"
                      }`}
                    >
                      👥 Employee Profiles
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDirectorySubTab("contacts")}
                      className={`px-4 py-1.5 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                        activeDirectorySubTab === "contacts" ? "bg-[#ff791a] text-white shadow-sm" : "text-slate-650 hover:text-slate-900"
                      }`}
                    >
                      ☎️ Important Helplines
                    </button>
                  </div>
                </div>

                {/* 2. EMPLOYEE PROFILES VIEW */}
                {activeDirectorySubTab === "employees" ? (
                  <div className="space-y-6 animate-fade-in">
                    {/* Filters bar for directory */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                      {/* Search */}
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Search Directory</label>
                        <div className="relative">
                          <input id="directory-search" name="directorySearch"
                            type="text"
                            value={directorySearch}
                            onChange={(e) => setDirectorySearch(e.target.value)}
                            placeholder="Search by code, name or phone..."
                            className="w-full pl-8 pr-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                          />
                          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                        </div>
                      </div>

                      {/* Location Filter */}
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Location / Site</label>
                        <select id="directory-location" name="directoryLocation"
                          value={directoryLocation}
                          onChange={(e) => setDirectoryLocation(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                        >
                          <option value="">All Locations</option>
                          {salaryUniqueLocations.map((loc) => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>

                      {/* Gender Filter */}
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Gender</label>
                        <select id="directory-gender" name="directoryGender"
                          value={directoryGender}
                          onChange={(e) => setDirectoryGender(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                        >
                          <option value="">All Genders</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Employees card grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(() => {
                        const filtered = employees.filter(emp => {
                          const q = directorySearch.toLowerCase().trim();
                          if (q) {
                            const codeMatch = emp.employeeCode.toLowerCase().includes(q);
                            const nameMatch = (emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "").toLowerCase().includes(q);
                            const phoneMatch = (emp.mobileNumberColumn || emp.mobileNumber || "").toLowerCase().includes(q);
                            if (!codeMatch && !nameMatch && !phoneMatch) return false;
                          }
                          if (directoryLocation && emp.location !== directoryLocation) return false;
                          if (directoryGender && emp.gender?.toLowerCase() !== directoryGender.toLowerCase()) return false;
                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="col-span-full bg-white border border-slate-200 rounded-xl p-16 text-center space-y-3">
                              <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center text-2xl mx-auto">
                                🕵️
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-600">No matching employee records found</p>
                                <p className="text-[11px] text-slate-400">Try modifying your text query or location/gender filter criteria.</p>
                              </div>
                            </div>
                          );
                        }

                        return filtered.map(emp => {
                          const name = emp.nameAsPerAadharColumn || emp.nameAsPerAadhar || "Unknown";
                          const phone = emp.mobileNumberColumn || emp.mobileNumber || "Not Provided";
                          const location = emp.location || "Unassigned Site";
                          const gender = emp.gender || "Not Specified";
                          const address = emp.presentAddressColumn || emp.presentAddress || "Not Provided";
                          const bank = emp.bankNameColumn || emp.bankName || "Not Linked";

                          const initials = name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();

                          return (
                            <div key={emp.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left flex flex-col justify-between space-y-4">
                              <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-full bg-orange-100 text-[#ff791a] font-black flex items-center justify-center shadow-inner text-sm shrink-0">
                                  {initials || "HR"}
                                </div>
                                <div className="min-w-0 flex-1 space-y-0.5 flex flex-col items-start">
                                  <h4 className="text-xs font-black text-slate-800 truncate w-full text-left" title={name}>{name}</h4>
                                  <p className="text-[10px] font-mono font-bold text-slate-400">{emp.employeeCode}</p>
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    <span className="text-[9px] font-extrabold px-2 py-0.5 bg-orange-50 text-[#ff791a] rounded-full border border-orange-100/50">{location}</span>
                                    <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full border border-slate-200/50">{gender}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="border-t border-slate-100 pt-3 space-y-2 text-[11px] text-slate-500">
                                <p className="truncate text-left"><strong className="text-slate-700">Bank:</strong> {bank}</p>
                                <p className="line-clamp-2 text-left" title={address}><strong className="text-slate-700">Address:</strong> {address}</p>
                              </div>

                              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                                <div className="min-w-0 text-left">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Mobile Number</p>
                                  <p className="text-xs font-mono font-bold text-slate-700">{phone}</p>
                                </div>
                                {phone !== "Not Provided" && (
                                  <button
                                    type="button"
                                    onClick={() => handleCallInitiate(name, phone, "Active Employee")}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
                                  >
                                    <Phone size={11} className="stroke-[2.5]" /> Call Now
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ) : (
                  /* 3. IMPORTANT OFFICIAL CONTACTS HELPLINES WITH DYNAMIC LOCATION-MAPPED HELP DESKS */
                  <div className="space-y-6 animate-fade-in" id="helplines-workspace">
                    {/* Top action bar with search, location filter, and add drawer */}
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex flex-col sm:flex-row gap-3 flex-1">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                          <input id="helpline-search-query" name="helplineSearchQuery"
                            type="text"
                            placeholder="Search helplines by name, role or desk..."
                            value={helplineSearchQuery}
                            onChange={(e) => setHelplineSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-250 text-xs rounded-lg text-slate-800 focus:outline-none focus:border-orange-500 font-semibold"
                          />
                        </div>
                        <select id="helpline-location-filter" name="helplineLocationFilter"
                          value={helplineLocationFilter}
                          onChange={(e) => setHelplineLocationFilter(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-250 text-xs rounded-lg text-slate-800 font-bold focus:outline-none"
                        >
                          <option value="All Locations">All Work Locations</option>
                          {customLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>

                      {/* Add Inline card button trigger */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Help Desk Registry</span>
                      </div>
                    </div>

                    {/* Quick Onboarding Form for new Helplines */}
                    <form onSubmit={handleAddHelpline} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desk Name / Facility</label>
                        <input id="new-helpline-name" name="newHelplineName"
                          type="text"
                          required
                          placeholder="e.g. Pune Help Desk"
                          value={newHelplineName}
                          onChange={(e) => setNewHelplineName(e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 text-xs rounded bg-slate-50 focus:outline-none focus:bg-white text-slate-800 font-semibold"
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Official Helpline Phone</label>
                        <input id="new-helpline-phone" name="newHelplinePhone"
                          type="text"
                          required
                          placeholder="e.g. +91 98765 00000"
                          value={newHelplinePhone}
                          onChange={(e) => setNewHelplinePhone(e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 text-xs rounded bg-slate-50 focus:outline-none focus:bg-white text-slate-850 font-mono font-bold"
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Specific Role / Scope</label>
                        <input id="new-helpline-role" name="newHelplineRole"
                          type="text"
                          placeholder="e.g. Network infrastructure"
                          value={newHelplineRole}
                          onChange={(e) => setNewHelplineRole(e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 text-xs rounded bg-slate-50 focus:outline-none focus:bg-white text-slate-800 font-semibold"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desk Category</label>
                          <select id="new-helpline-category" name="newHelplineCategory"
                            value={newHelplineCategory}
                            onChange={(e) => setNewHelplineCategory(e.target.value)}
                            className="px-2.5 py-1.5 border border-slate-200 text-xs rounded bg-slate-50 focus:outline-none focus:bg-white text-slate-800 font-bold"
                          >
                            <option value="IT Helpdesk">IT Desk</option>
                            <option value="Corporate Support">Corporate</option>
                            <option value="Client Office">Site Office</option>
                            <option value="Operations Desk">Operations</option>
                            <option value="⚠️ Emergency Desk">Emergency</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 text-left">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Branch Location</label>
                          <select id="new-helpline-location" name="newHelplineLocation"
                            value={newHelplineLocation}
                            onChange={(e) => setNewHelplineLocation(e.target.value)}
                            className="px-2.5 py-1.5 border border-slate-200 text-xs rounded bg-slate-50 focus:outline-none focus:bg-white text-slate-800 font-bold"
                          >
                            <option value="All Locations">All Locations</option>
                            {customLocations.map(loc => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full px-3.5 py-2 bg-[#f57416] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <Plus size={14} className="stroke-[2.5]" /> Register Helpline
                      </button>
                    </form>

                    {/* Helplines Display Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(() => {
                        const filtered = helplines.filter(contact => {
                          const q = helplineSearchQuery.toLowerCase().trim();
                          if (q) {
                            const nameMatch = contact.name.toLowerCase().includes(q);
                            const roleMatch = contact.role.toLowerCase().includes(q);
                            const catMatch = contact.category.toLowerCase().includes(q);
                            if (!nameMatch && !roleMatch && !catMatch) return false;
                          }
                          if (helplineLocationFilter !== "All Locations" && contact.location !== "All Locations" && contact.location !== helplineLocationFilter) {
                            return false;
                          }
                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="col-span-full bg-slate-50 border border-dashed border-slate-250 rounded-2xl p-10 text-center text-slate-450 font-medium text-xs">
                              No official support helplines match your current search queries or location parameters.
                            </div>
                          );
                        }

                        return filtered.map((contact, idx) => (
                          <div key={contact.name + idx} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg transition-all text-left flex flex-col justify-between space-y-4 relative group">
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  contact.category.includes("Emergency")
                                    ? "bg-rose-50 text-rose-600 border-rose-100"
                                    : contact.category.includes("IT")
                                    ? "bg-blue-50 text-blue-600 border-blue-100"
                                    : contact.category.includes("Client")
                                    ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                                    : "bg-orange-50 text-[#ff791a] border-orange-100"
                                }`}>
                                  {contact.category}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    {contact.location === "All Locations" ? "Global" : contact.location}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteHelpline(contact.name)}
                                    className="p-1 text-slate-350 hover:text-red-500 rounded hover:bg-slate-50 transition cursor-pointer"
                                    title={`Delete "${contact.name}"`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              <h4 className="text-xs font-black text-slate-800 pt-1.5">{contact.name}</h4>
                              <p className="text-[11px] text-slate-450 leading-relaxed min-h-[32px]">{contact.role}</p>
                            </div>

                            <div className="border-t border-slate-100 pt-3.5 flex items-center justify-between">
                              <div className="min-w-0 text-left">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Official Number</p>
                                <p className="text-xs font-mono font-bold text-slate-700">{contact.phone}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCallInitiate(contact.name, contact.phone, contact.category)}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
                              >
                                <Phone size={11} className="stroke-[2.5]" /> Call Now
                              </button>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ) : activeSidebarTab === "Attendance" ? (
              /* --- ENTERPRISE ATTENDANCE WORKSPACE ("TIME" MODULE) --- */
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6 animate-fade-in" id="attendance-workspace-panel">
                {attendanceSubView === "wizard" ? (
                  /* --- NEW SCREEN: INTERACTIVE WIZARD VIEW --- */
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="text-left">
                        <button
                          type="button"
                          onClick={() => setAttendanceSubView("grid")}
                          className="flex items-center gap-1 text-slate-500 hover:text-[#ff791a] text-xs font-bold transition cursor-pointer mb-2"
                        >
                          ← Back to Daily Attendance Sheet
                        </button>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mt-1">
                          ⚡ Bulk Mark Attendance Wizard
                        </h4>
                        <p className="text-[11px] text-slate-455 mt-0.5">
                          Mark large cohorts as present across multiple worksite locations, cycle months, and custom calendar dates quickly.
                        </p>
                      </div>
                      
                      {/* Navigation tabs styled premium */}
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                        {[
                          { id: "employees", label: "1. Select Staff", icon: Users },
                          { id: "dates", label: "2. Select Dates", icon: Calendar },
                          { id: "review", label: "3. Review & Submit", icon: CheckCircle }
                        ].map((stepItem) => {
                          const Icon = stepItem.icon;
                          const isDone = (stepItem.id === "employees" && (bulkWizardStep === "dates" || bulkWizardStep === "review")) || (stepItem.id === "dates" && bulkWizardStep === "review");
                          const isActive = bulkWizardStep === stepItem.id;
                          return (
                            <button
                              key={stepItem.id}
                              type="button"
                              onClick={() => {
                                if (stepItem.id === "employees") setBulkWizardStep("employees");
                                else if (stepItem.id === "dates" && bulkSelEmployees.length > 0) setBulkWizardStep("dates");
                                else if (stepItem.id === "review" && bulkSelEmployees.length > 0 && bulkSelDates.length > 0) setBulkWizardStep("review");
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                                isActive ? "bg-[#ff791a] text-white shadow-xs" : isDone ? "text-emerald-700 bg-emerald-50 border border-emerald-100" : "text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              <Icon size={14} className={isDone ? "text-emerald-600 animate-bounce" : ""} />
                              {stepItem.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {bulkWizardStep === "employees" && (
                          <div className="space-y-5 animate-fade-in">
                            {/* Grid for Locations & Months */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              
                              {/* 1. Locations Selection Panel */}
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    🏢 Select Worksite Location(s)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (bulkSelLocations.length === customLocations.length) {
                                        setBulkSelLocations([]);
                                      } else {
                                        setBulkSelLocations([...customLocations]);
                                      }
                                    }}
                                    className="text-[10px] font-bold text-orange-600 hover:text-orange-850 cursor-pointer"
                                  >
                                    {bulkSelLocations.length === customLocations.length ? "Deselect All" : "Select All"}
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                  {customLocations.map(loc => {
                                    const isSel = bulkSelLocations.includes(loc);
                                    const toggle = () => {
                                      if (isSel) setBulkSelLocations(prev => prev.filter(x => x !== loc));
                                      else setBulkSelLocations(prev => [...prev, loc]);
                                    };
                                    return (
                                      <button
                                        key={loc}
                                        type="button"
                                        onClick={toggle}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer select-none ${
                                          isSel 
                                            ? "bg-orange-50 border-orange-200 text-[#e4640c]" 
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                        }`}
                                      >
                                        {loc}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 2. Months Selection Panel */}
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    📅 Select Cycle Month(s)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (bulkSelMonths.length === MONTHS_LIST.length) {
                                        setBulkSelMonths([]);
                                      } else {
                                        setBulkSelMonths([...MONTHS_LIST]);
                                      }
                                    }}
                                    className="text-[10px] font-bold text-orange-600 hover:text-orange-850 cursor-pointer"
                                  >
                                    {bulkSelMonths.length === MONTHS_LIST.length ? "Deselect All" : "Select All"}
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                  {MONTHS_LIST.map(m => {
                                    const isSel = bulkSelMonths.includes(m);
                                    const toggle = () => {
                                      if (isSel) setBulkSelMonths(prev => prev.filter(x => x !== m));
                                      else setBulkSelMonths(prev => [...prev, m]);
                                    };
                                    return (
                                      <button
                                        key={m}
                                        type="button"
                                        onClick={toggle}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer select-none ${
                                          isSel 
                                            ? "bg-orange-50 border-orange-200 text-[#e4640c]" 
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                        }`}
                                      >
                                        {m}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                            </div>

                            {/* 3. Targeted Employees List */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-slate-200 gap-2 text-left">
                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                  👥 Targeted Employees ({bulkSelEmployees.length} Selected)
                                </span>
                                <div className="flex flex-wrap items-center gap-3">
                                  
                                  {/* Bulk Wizard Role Filter */}
                                  <div className="flex items-center gap-1.5 text-xs relative" id="bulk-wizard-role-multiselect-container">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role:</span>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsBulkWizardRoleDropdownOpen(!isBulkWizardRoleDropdownOpen);
                                          setIsBulkWizardSkillDropdownOpen(false);
                                        }}
                                        className="px-2.5 py-1 bg-white border border-slate-250 text-[11px] rounded-lg font-bold focus:outline-none flex justify-between items-center min-w-[130px] hover:bg-slate-50 transition cursor-pointer"
                                      >
                                        <span className="truncate">
                                          {bulkWizardRoleFilters.length === 0 
                                            ? "All Job Roles" 
                                            : `${bulkWizardRoleFilters.length} Selected`}
                                        </span>
                                        <span className="text-[9px] text-slate-400 ml-1">▼</span>
                                      </button>
                                      
                                      {isBulkWizardRoleDropdownOpen && (
                                        <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto w-48 text-left">
                                          <div className="flex justify-between items-center border-b border-slate-100 pb-1 mb-1">
                                            <span className="text-[9px] text-slate-400 font-bold">Roles</span>
                                            <button
                                              type="button"
                                              onClick={() => setBulkWizardRoleFilters([])}
                                              className="text-[8px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                                            >
                                              Clear All
                                            </button>
                                          </div>
                                          {customRoles.map(role => {
                                            const isChecked = bulkWizardRoleFilters.includes(role);
                                            const toggle = () => {
                                              if (isChecked) {
                                                setBulkWizardRoleFilters(prev => prev.filter(r => r !== role));
                                              } else {
                                                setBulkWizardRoleFilters(prev => [...prev, role]);
                                              }
                                            };
                                            return (
                                              <label key={role} className="flex items-center gap-2 px-1.5 py-0.5 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                                <input id="checkbox-field-8039" name="checkbox_8039"
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={toggle}
                                                  className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                                />
                                                <span className="font-medium text-[11px]">{role}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Bulk Wizard Skill Filter */}
                                  <div className="flex items-center gap-1.5 text-xs relative" id="bulk-wizard-skill-multiselect-container">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Skill:</span>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsBulkWizardSkillDropdownOpen(!isBulkWizardSkillDropdownOpen);
                                          setIsBulkWizardRoleDropdownOpen(false);
                                        }}
                                        className="px-2.5 py-1 bg-white border border-slate-250 text-[11px] rounded-lg font-bold focus:outline-none flex justify-between items-center min-w-[130px] hover:bg-slate-50 transition cursor-pointer"
                                      >
                                        <span className="truncate">
                                          {bulkWizardSkillFilters.length === 0 
                                            ? "All Categories" 
                                            : `${bulkWizardSkillFilters.length} Selected`}
                                        </span>
                                        <span className="text-[9px] text-slate-400 ml-1">▼</span>
                                      </button>
                                      
                                      {isBulkWizardSkillDropdownOpen && (
                                        <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto w-44 text-left">
                                          <div className="flex justify-between items-center border-b border-slate-100 pb-1 mb-1">
                                            <span className="text-[9px] text-slate-400 font-bold">Categories</span>
                                            <button
                                              type="button"
                                              onClick={() => setBulkWizardSkillFilters([])}
                                              className="text-[8px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                                            >
                                              Clear All
                                            </button>
                                          </div>
                                          {["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"].map(cat => {
                                            const isChecked = bulkWizardSkillFilters.includes(cat);
                                            const toggle = () => {
                                              if (isChecked) {
                                                setBulkWizardSkillFilters(prev => prev.filter(c => c !== cat));
                                              } else {
                                                setBulkWizardSkillFilters(prev => [...prev, cat]);
                                              }
                                            };
                                            return (
                                              <label key={cat} className="flex items-center gap-2 px-1.5 py-0.5 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                                <input id="checkbox-field-8097" name="checkbox_8097"
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={toggle}
                                                  className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                                />
                                                <span className="font-medium text-[11px]">{cat}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const matching = employees
                                        .filter(e => bulkSelLocations.includes(e.location || ""))
                                        .filter(e => bulkWizardRoleFilters.length === 0 || bulkWizardRoleFilters.some(f => (e.role || "").toLowerCase() === f.toLowerCase()))
                                        .filter(e => employeeMatchesSkillFilters(e, bulkWizardSkillFilters))
                                        .map(e => e.id);
                                      setBulkSelEmployees(matching);
                                    }}
                                    className="text-[10px] font-bold text-orange-600 hover:text-orange-850 cursor-pointer"
                                  >
                                    Select Matching
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBulkSelEmployees([])}
                                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                                  >
                                    Deselect All
                                  </button>
                                </div>
                              </div>

                              {bulkSelLocations.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-400 font-medium">
                                  💡 Please select at least one worksite location above to filter targeted employees.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1 pt-1">
                                  {employees
                                    .filter(emp => bulkSelLocations.includes(emp.location || ""))
                                    .filter(emp => bulkWizardRoleFilters.length === 0 || bulkWizardRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase()))
                                    .filter(emp => employeeMatchesSkillFilters(emp, bulkWizardSkillFilters))
                                    .map(emp => {
                                      const isSel = bulkSelEmployees.includes(emp.id);
                                      const toggle = () => {
                                        if (isSel) setBulkSelEmployees(prev => prev.filter(id => id !== emp.id));
                                        else setBulkSelEmployees(prev => [...prev, emp.id]);
                                      };
                                      return (
                                        <div 
                                          key={emp.id}
                                          onClick={toggle}
                                          className={`p-2.5 border rounded-lg flex items-center gap-2 cursor-pointer transition select-none ${
                                            isSel 
                                              ? "bg-orange-50/60 border-orange-200" 
                                              : "bg-white border-slate-200 hover:bg-slate-50/55"
                                          }`}
                                        >
                                          <input id="checkbox-field-8162" name="checkbox_8162"
                                            type="checkbox"
                                            checked={isSel}
                                            onChange={() => {}} // toggled by parent div click
                                            className="w-3.5 h-3.5 rounded text-[#f57416] focus:ring-[#f57416] shrink-0"
                                          />
                                          <div className="min-w-0 text-left">
                                            <p className="text-xs font-bold text-slate-700 truncate">{emp.nameAsPerAadharColumn || emp.nameAsPerAadhar}</p>
                                            <p className="text-[10px] font-mono text-slate-400 truncate">{emp.employeeCode} • {emp.location}</p>
                                          </div>
                                        </div>
                                      );
                                    })
                                  }
                                </div>
                              )}
                            </div>

                            {/* Navigation button for Step 1 */}
                            <div className="flex justify-end pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                disabled={bulkSelEmployees.length === 0}
                                onClick={() => setBulkWizardStep("dates")}
                                className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                                  bulkSelEmployees.length > 0 
                                    ? "bg-[#ff791a] hover:bg-[#e4640c] text-white" 
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                }`}
                              >
                                Continue to Date Selection →
                              </button>
                            </div>
                          </div>
                        )}

                        {bulkWizardStep === "dates" && (
                          <div className="space-y-5 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              
                              {/* Selection Info */}
                              <div className="md:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 text-left">
                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block pb-1 border-b border-slate-200">
                                  📋 Selection Summary
                                </span>
                                <div className="space-y-2 text-xs">
                                  <p className="text-slate-500 font-semibold">Location(s): <strong className="text-slate-800">{bulkSelLocations.join(", ")}</strong></p>
                                  <p className="text-slate-500 font-semibold">Months(s): <strong className="text-slate-800">{bulkSelMonths.join(", ")}</strong></p>
                                  <p className="text-slate-500 font-semibold">Staff Enrolled: <strong className="text-slate-800">{bulkSelEmployees.length} employee(s)</strong></p>
                                  <p className="text-slate-500 font-semibold">Dates Selected: <strong className="text-[#f57416]">{bulkSelDates.length} day(s)</strong></p>
                                </div>
                                
                                <div className="pt-2 border-t border-slate-200 space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                      const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                                      setBulkSelDates(allDays);
                                    }}
                                    className="w-full py-1.5 bg-orange-50 hover:bg-orange-100 text-[#e4640c] border border-orange-100 font-extrabold text-[10.5px] uppercase tracking-wider rounded-lg transition cursor-pointer"
                                  >
                                    Select All Month Days
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBulkSelDates([])}
                                    className="w-full py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-extrabold text-[10.5px] uppercase tracking-wider rounded-lg transition cursor-pointer"
                                  >
                                    Reset Dates
                                  </button>
                                </div>

                                {/* Smart range selection presets */}
                                <div className="pt-2.5 border-t border-slate-200 space-y-2">
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                    ⚡ Smart Presets
                                  </span>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                        const matching = Array.from({ length: Math.min(15, daysInMonth) }, (_, i) => i + 1);
                                        setBulkSelDates(prev => [...new Set([...prev, ...matching])].sort((a,b)=>a-b));
                                      }}
                                      className="py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                                    >
                                      First 15 Days
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                        const matching = Array.from({ length: daysInMonth - 15 }, (_, i) => i + 16);
                                        setBulkSelDates(prev => [...new Set([...prev, ...matching])].sort((a,b)=>a-b));
                                      }}
                                      className="py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                                    >
                                      Last 15 Days
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                        const matching = Array.from({ length: Math.min(7, daysInMonth) }, (_, i) => i + 1);
                                        setBulkSelDates(prev => [...new Set([...prev, ...matching])].sort((a,b)=>a-b));
                                      }}
                                      className="py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                                    >
                                      First Week
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                        const matching = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => d % 2 !== 0);
                                        setBulkSelDates(matching);
                                      }}
                                      className="py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer text-center"
                                    >
                                      Odd Days
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                        const matching = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => d % 2 === 0);
                                        setBulkSelDates(matching);
                                      }}
                                      className="py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer text-center col-span-2"
                                    >
                                      Even Days
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Interactive Calendar for Date Selection */}
                              <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
                                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    📅 Calendar Date Picker
                                  </span>
                                  {/* Sync month picker for calendar display */}
                                  <select id="bulk-calendar-month" name="bulkCalendarMonth"
                                    value={bulkCalendarMonth}
                                    onChange={(e) => setBulkCalendarMonth(e.target.value)}
                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-3xs cursor-pointer focus:outline-none"
                                  >
                                    {bulkSelMonths.map(m => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Calendar grid of numbers */}
                                <div>
                                  <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-1 mb-2 text-left">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Click dates below to select/deselect them:</p>
                                    <span className="text-orange-500 font-extrabold text-[9px]">⚡ Click C1-C7 (Columns) or W1-W5 (Weeks) to bulk toggle</span>
                                  </div>
                                  
                                  {/* Main grid with week togglers on the left and column togglers on top */}
                                  <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1.5 items-center">
                                    {/* Empty corner space */}
                                    <div className="w-8"></div>
                                    
                                    {/* Column Toggles */}
                                    <div className="grid grid-cols-7 gap-1.5">
                                      {Array.from({ length: 7 }, (_, colIdx) => {
                                        const colNum = colIdx + 1;
                                        const handleColumnToggle = () => {
                                          const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                          const colDays: number[] = [];
                                          for (let d = colNum; d <= daysInMonth; d += 7) {
                                            colDays.push(d);
                                          }
                                          const allSelected = colDays.every(d => bulkSelDates.includes(d));
                                          if (allSelected) {
                                            setBulkSelDates(prev => prev.filter(d => !colDays.includes(d)));
                                          } else {
                                            setBulkSelDates(prev => [...new Set([...prev, ...colDays])].sort((a,b)=>a-b));
                                          }
                                        };
                                        return (
                                          <button
                                            key={colIdx}
                                            type="button"
                                            onClick={handleColumnToggle}
                                            className="h-6 w-full text-[9px] font-black bg-slate-200 hover:bg-slate-350 text-slate-600 rounded-md transition cursor-pointer select-none"
                                            title={`Toggle all days in Column ${colNum}`}
                                          >
                                            C{colNum}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {/* Calendar rows and row-wise / week-wise toggles */}
                                    {(() => {
                                      const daysInMonth = getDaysInSelectedMonth(bulkCalendarMonth || selectedMonth);
                                      const weeks: number[][] = [];
                                      let currentWeek: number[] = [];
                                      for (let d = 1; d <= daysInMonth; d++) {
                                        currentWeek.push(d);
                                        if (currentWeek.length === 7 || d === daysInMonth) {
                                          weeks.push(currentWeek);
                                          currentWeek = [];
                                        }
                                      }

                                      return weeks.map((weekDays, weekIdx) => {
                                        const weekNum = weekIdx + 1;
                                        const handleWeekToggle = () => {
                                          const allSelected = weekDays.every(d => bulkSelDates.includes(d));
                                          if (allSelected) {
                                            setBulkSelDates(prev => prev.filter(d => !weekDays.includes(d)));
                                          } else {
                                            setBulkSelDates(prev => [...new Set([...prev, ...weekDays])].sort((a,b)=>a-b));
                                          }
                                        };

                                        return (
                                          <React.Fragment key={weekIdx}>
                                            <button
                                              type="button"
                                              onClick={handleWeekToggle}
                                              className="h-9 w-8 text-[9px] font-black bg-orange-100/60 hover:bg-orange-100 text-[#e4640c] rounded-lg transition cursor-pointer select-none"
                                              title={`Toggle all days in Week ${weekNum}`}
                                            >
                                              W{weekNum}
                                            </button>
                                            
                                            <div className="grid grid-cols-7 gap-1.5">
                                              {weekDays.map(dayNum => {
                                                const isSel = bulkSelDates.includes(dayNum);
                                                const toggle = () => {
                                                  if (isSel) setBulkSelDates(prev => prev.filter(x => x !== dayNum));
                                                  else setBulkSelDates(prev => [...prev, dayNum]);
                                                };
                                                return (
                                                  <button
                                                    key={dayNum}
                                                    type="button"
                                                    onClick={toggle}
                                                    className={`h-9 w-full flex items-center justify-center font-bold text-xs rounded-lg border transition cursor-pointer select-none ${
                                                      isSel 
                                                        ? "bg-[#ff791a] border-orange-500 text-white shadow-xs" 
                                                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                                    }`}
                                                  >
                                                    {dayNum}
                                                  </button>
                                                );
                                              })}
                                              {weekDays.length < 7 && Array.from({ length: 7 - weekDays.length }).map((_, i) => (
                                                <div key={`empty-${i}`} className="h-9 w-full"></div>
                                              ))}
                                            </div>
                                          </React.Fragment>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              </div>

                            </div>

                            {/* Bottom navigation footer for Step 2 */}
                            <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-3 mt-4">
                              <button
                                type="button"
                                onClick={() => setBulkWizardStep("employees")}
                                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
                              >
                                ← Back to Staff Selection
                              </button>
                              
                              <button
                                type="button"
                                disabled={bulkSelDates.length === 0}
                                onClick={() => setBulkWizardStep("review")}
                                className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                                  bulkSelDates.length > 0 
                                    ? "bg-[#ff791a] hover:bg-[#e4640c] text-white" 
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                }`}
                              >
                                Continue to Review & Submit →
                              </button>
                            </div>
                          </div>
                        )}

                        {bulkWizardStep === "review" && (
                          <div className="space-y-5 animate-fade-in">
                            {/* Confirmation Grid Details */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                              <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-200 text-left">
                                📝 Verification & Cohort summary
                              </h5>

                              {/* List of Targeted Months & Staff Names (Collapsible / Badges) */}
                              <div className="space-y-2 text-xs font-semibold text-slate-755 text-left">
                                <div>
                                  <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px] block mb-1">Target Months:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {bulkSelMonths.map(m => (
                                      <span key={m} className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-md font-bold text-[10.5px]">{m}</span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px] block mb-1">Employees ({bulkSelEmployees.length}):</span>
                                  <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto pr-1">
                                    {employees.filter(e => bulkSelEmployees.includes(e.id)).map(e => (
                                      <span key={e.id} className="px-2 py-0.5 bg-orange-50 border border-orange-100 text-[#e4640c] rounded-md font-bold text-[10px]">{e.nameAsPerAadharColumn || e.nameAsPerAadhar} ({e.employeeCode})</span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[9px] block mb-1">Target Days ({bulkSelDates.length}):</span>
                                  <div className="flex flex-wrap gap-0.5">
                                    {bulkSelDates.sort((a,b)=>a-b).map(d => (
                                      <span key={d} className="w-5 h-5 flex items-center justify-center bg-slate-200 border border-slate-300 text-slate-700 rounded font-bold text-[10px]">{d}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Bottom navigation footer for Step 3 */}
                            <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-4">
                              <button
                                type="button"
                                onClick={() => setBulkWizardStep("dates")}
                                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
                              >
                                ← Back to Date Selection
                              </button>
                              
                              <button
                                type="button"
                                onClick={handleApplyBulkWizardAttendance}
                                className="px-6 py-2.5 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5 bg-[#ff791a] hover:bg-[#e4640c] text-white scale-105"
                              >
                                ⚡ Confirm & Mark Bulk Present
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                  /* --- STANDARD DAILY ATTENDANCE GRID SHEET VIEW --- */
                  <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5">
                          <Clock className="text-orange-500" size={18} /> Enterprise Attendance & Worksite Workspace
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Track daily staff rosters, assign status codes, and execute bulk presence stamping.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setAttendanceSubView("wizard");
                            setBulkWizardStep("employees");
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-[#ff791a] hover:from-orange-600 hover:to-[#e4640c] text-white text-xs font-extrabold rounded-lg transition cursor-pointer shadow-md hover:shadow-lg active:scale-95 animate-pulse-once"
                        >
                          <Clock size={13} className="stroke-[2.5]" /> Bulk Mark Attendance
                        </button>
                        <button
                          onClick={downloadAttendanceExcel}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer shadow-xs"
                        >
                          <FileSpreadsheet size={13} className="text-green-600" /> Export Excel (Landscape)
                        </button>
                        <button
                          onClick={downloadAttendancePDF}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f57416] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-sm"
                        >
                          <FileText size={13} /> Export PDF (Landscape)
                        </button>
                      </div>
                    </div>

                    {/* Grid controls: Worksite branch & Search filters */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Employees</label>
                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                          <input id="attendance-search-query" name="attendanceSearchQuery"
                            type="text"
                            placeholder="Search by code or name..."
                            value={attendanceSearchQuery}
                            onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-250 text-xs rounded-lg text-slate-800 font-semibold focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Worksite Branch Location</label>
                        <select id="attendance-location-filter" name="attendanceLocationFilter"
                          value={attendanceLocationFilter}
                          onChange={(e) => setAttendanceLocationFilter(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-250 text-xs rounded-lg text-slate-800 font-bold focus:outline-none animate-none"
                        >
                          <option value="All">All Corporate Branches</option>
                          {customLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      </div>

                      {/* Attendance Job Role Filter */}
                      <div className="flex flex-col gap-1 text-left relative" id="attendance-role-multiselect-container">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Job Role</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAttendanceRoleDropdownOpen(!isAttendanceRoleDropdownOpen);
                              setIsAttendanceSkillDropdownOpen(false);
                            }}
                            className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-bold text-slate-800 focus:outline-none text-left flex justify-between items-center hover:bg-slate-50 transition cursor-pointer"
                          >
                            <span className="truncate">
                              {attendanceRoleFilters.length === 0 
                                ? "All Job Roles" 
                                : `${attendanceRoleFilters.length} Selected`}
                            </span>
                            <span className="text-[10px] text-slate-400">▼</span>
                          </button>
                          
                          {isAttendanceRoleDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto w-full text-left">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                <span className="text-[10px] text-slate-400 font-bold">Roles</span>
                                <button
                                  type="button"
                                  onClick={() => setAttendanceRoleFilters([])}
                                  className="text-[9px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                                >
                                  Clear All
                                </button>
                              </div>
                              {customRoles.map(role => {
                                const isChecked = attendanceRoleFilters.includes(role);
                                const toggle = () => {
                                  if (isChecked) {
                                    setAttendanceRoleFilters(prev => prev.filter(r => r !== role));
                                  } else {
                                    setAttendanceRoleFilters(prev => [...prev, role]);
                                  }
                                };
                                return (
                                  <label key={role} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                    <input id="checkbox-field-8623" name="checkbox_8623"
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={toggle}
                                      className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                    />
                                    <span className="font-medium">{role}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Attendance Skill Category Filter */}
                      <div className="flex flex-col gap-1 text-left relative" id="attendance-skill-multiselect-container">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Skill Category</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAttendanceSkillDropdownOpen(!isAttendanceSkillDropdownOpen);
                              setIsAttendanceRoleDropdownOpen(false);
                            }}
                            className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-bold text-slate-800 focus:outline-none text-left flex justify-between items-center hover:bg-slate-50 transition cursor-pointer"
                          >
                            <span className="truncate">
                              {attendanceSkillFilters.length === 0 
                                ? "All Categories" 
                                : `${attendanceSkillFilters.length} Selected`}
                            </span>
                            <span className="text-[10px] text-slate-400">▼</span>
                          </button>
                          
                          {isAttendanceSkillDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto w-full text-left">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                <span className="text-[10px] text-slate-400 font-bold">Categories</span>
                                <button
                                  type="button"
                                  onClick={() => setAttendanceSkillFilters([])}
                                  className="text-[9px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                                >
                                  Clear All
                                </button>
                              </div>
                              {["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"].map(cat => {
                                const isChecked = attendanceSkillFilters.includes(cat);
                                const toggle = () => {
                                  if (isChecked) {
                                    setAttendanceSkillFilters(prev => prev.filter(c => c !== cat));
                                  } else {
                                    setAttendanceSkillFilters(prev => [...prev, cat]);
                                  }
                                };
                                return (
                                  <label key={cat} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                    <input id="checkbox-field-8681" name="checkbox_8681"
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={toggle}
                                      className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                    />
                                    <span className="font-medium">{cat}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Cycle Month</label>
                        <select id="attendance-month-select" name="selectedMonth"
                          value={MONTHS_LIST.includes(selectedMonth) ? selectedMonth : (MONTHS_LIST[0] || selectedMonth)}
                          onChange={(e) => setSelectedMonth(normalizeMonthKey(e.target.value))}
                          className="w-full px-3 py-1.5 bg-white border border-slate-250 text-xs rounded-lg text-slate-800 font-bold focus:outline-none"
                        >
                          {MONTHS_LIST.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Interactive Grid Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="overflow-x-auto max-w-full">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                      <thead>
                        <tr className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <th className="px-3 py-2 w-12 text-center">SR</th>
                          <th className="px-3 py-2 w-28">Emp Code</th>
                          <th className="px-3 py-2 w-48">Employee Name</th>
                          <th className="px-3 py-2 w-36">Worksite Location</th>
                          {Array.from({ length: getDaysInSelectedMonth(selectedMonth) }, (_, i) => (
                            <th key={i} className="px-1 py-2 text-center w-8 font-mono">{i + 1}</th>
                          ))}
                          <th className="px-3 py-2 text-center w-16">P</th>
                          <th className="px-3 py-2 text-center w-16">A</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {(() => {
                          const filtered = employees.filter(emp => {
                            if (isEmployeeExitedForMonth(emp, selectedMonth)) return false;
                            const locMatch = attendanceLocationFilter === "All" || emp.location === attendanceLocationFilter;
                            const roleMatch = attendanceRoleFilters.length === 0 || attendanceRoleFilters.some(f => (emp.role || "").toLowerCase() === f.toLowerCase());
                            const skillMatch = employeeMatchesSkillFilters(emp, attendanceSkillFilters);
                            const q = attendanceSearchQuery.toLowerCase().trim();
                            const searchMatch = !q || emp.employeeCode.toLowerCase().includes(q) || (emp.nameAsPerAadhar || "").toLowerCase().includes(q);
                            return locMatch && searchMatch && roleMatch && skillMatch;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={getDaysInSelectedMonth(selectedMonth) + 6} className="px-6 py-10 text-center text-slate-400">
                                  No onboarded staff detected under active worksite location or search criteria.
                                </td>
                              </tr>
                            );
                          }

                          return filtered.map((emp, index) => {
                            const monthData = attendanceDb[selectedMonth] || {};
                            const empData = monthData[emp.id] || {};
                            const daysCount = getDaysInSelectedMonth(selectedMonth);

                            let presents = 0;
                            let absents = 0;
                            for (let d = 1; d <= daysCount; d++) {
                              if (isEmployeeExitedOnDayStatic(emp, selectedMonth, d)) {
                                continue;
                              }
                              const status = empData[d] || "";
                              if (status === "P") presents++;
                              else if (status === "A") absents++;
                            }

                            return (
                              <tr key={emp.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 text-center text-slate-400 font-bold">{index + 1}</td>
                                <td className="px-3 py-2 font-mono font-bold text-slate-800">{emp.employeeCode}</td>
                                <td className="px-3 py-2 font-semibold text-slate-700">{emp.nameAsPerAadhar}</td>
                                <td className="px-3 py-2 text-slate-500 font-medium truncate max-w-[120px]" title={emp.location || "Unassigned"}>
                                  {emp.location || "—"}
                                </td>
                                {Array.from({ length: daysCount }, (_, i) => {
                                  const dayNum = i + 1;
                                  const currentStatus = empData[dayNum] || "";
                                  const isExitedToday = isEmployeeExitedOnDayStatic(emp, selectedMonth, dayNum);
                                  return (
                                    <td key={i} className="px-0.5 py-1 text-center">
                                      {isExitedToday ? (
                                        <span 
                                          className="text-[9px] font-bold text-slate-400 select-none bg-slate-100 rounded px-1.5 py-0.5 border border-slate-200"
                                          title="Exited / Inactive"
                                        >
                                          —
                                        </span>
                                      ) : (
                                        <select id={`attendance-${emp.id}-day-${dayNum}`} name={`attendance_${emp.id}_day_${dayNum}`}
                                          value={currentStatus}
                                          onChange={(e) => handleCellAttendanceChange(emp.id, dayNum, e.target.value)}
                                          disabled={!userPermissions.attendance?.edit}
                                          className={`text-[9px] font-black text-center border-0 rounded px-1 py-0.5 focus:ring-0 focus:outline-none cursor-pointer ${
                                            currentStatus === "P" ? "bg-emerald-100 text-emerald-800" :
                                            currentStatus === "A" ? "bg-rose-100 text-rose-800" :
                                            currentStatus === "L" ? "bg-amber-100 text-amber-800" :
                                            currentStatus === "H" ? "bg-blue-100 text-blue-800" :
                                            "bg-slate-100 text-slate-400 font-semibold"
                                          }`}
                                        >
                                          <option value="">—</option>
                                          <option value="P">P</option>
                                          <option value="A">A</option>
                                          <option value="L">L</option>
                                          <option value="H">H</option>
                                        </select>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2 text-center font-bold text-emerald-600">{presents}</td>
                                <td className="px-3 py-2 text-center font-bold text-rose-600">{absents}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
                  </>
                )}
              </div>
            ) : activeSidebarTab !== "Employees" ? (
             /* --- OTHER TABS VIEW: Dashboard, Recruitment, Leave, etc. --- */
             <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-4xl mx-auto shadow-xs text-center space-y-6" id="incoming-tab-view">
              <div className="w-16 h-16 bg-orange-50 text-[#ff791a] rounded-full flex items-center justify-center mx-auto text-3xl shadow-sm">
                ⚡
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                  {activeSidebarTab} Module clearance Active
                </h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  You are logged into FlexHRM enterprise as <strong className="text-slate-800">{sessionUser}</strong>. All employee datasets, CSV bulk tools, and exports remain fully loaded in the Employees module.
                </p>
              </div>
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-150 inline-block text-left text-xs max-w-md w-full">
                <span className="font-bold text-slate-700 block mb-2 flex items-center gap-1">
                  <Info size={14} className="text-blue-500" /> Executive Metadata Overview
                </span>
                <ul className="text-slate-500 space-y-1 font-mono">
                  <li>• Total Employee Records: {employees.length}</li>
                  <li>• Mapped Locations: {dashboardStats.uniqueLocsCount}</li>
                  <li>• Base Branch: {companyBranch}</li>
                </ul>
              </div>
              <div>
                <button
                  onClick={() => setActiveSidebarTab("Employees")}
                  className="px-5 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg shadow transition cursor-pointer"
                >
                  Return to Employees Module
                </button>
              </div>
            </div>
          ) : (
            /* --- CENTRAL EMPLOYEES MODULE ACTIVE --- */
            <>
              {/* Employees SUB-TAB 1: CONFIGURATION PLAYGROUND PANEL */}
              {activePimSubTab === "Configuration" && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6 animate-fade-in" id="view-configuration-panel">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight">HRMS System Rules Configurations</h3>
                    <p className="text-xs text-slate-400 mt-1">Amend systemic ESIC thresholds and payroll allocation matrices</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,1.35fr)_minmax(0,1fr)] gap-6 pt-2">
                    {/* Left side: Rules, Percent, and Mapped Branch */}
                    <div className="space-y-6 flex flex-col">
                      <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-150 flex-1">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <IndianRupee size={14} className="text-orange-500" /> ESIC Ceiling Limit (INR)
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Specify the salary ceiling threshold. Employees earning Gross Salary below or equal to this ceiling will automatically be enrolled.
                        </p>
                        <div className="pt-2 flex items-center gap-3">
                          <input id="esic-eligibility-limit" name="esicEligibilityLimit"
                            type="number"
                            value={esicEligibilityLimit}
                            onChange={(e) => setEsicEligibilityLimit(Math.max(0, parseInt(e.target.value) || 0))}
                            className="px-3 py-1.5 border border-slate-250 bg-white rounded text-xs font-mono font-bold text-slate-800 w-36 focus:outline-none focus:border-orange-500"
                          />
                          <span className="text-[11px] font-semibold text-slate-500">Currently: Gross ≤ Rs. {esicEligibilityLimit.toLocaleString("en-IN")}</span>
                        </div>
                      </div>

                      <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-150 flex-1">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <PercentIcon size={14} className="text-orange-500" /> Basic Salary Computation (% of Gross)
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Control how the Basic Salary component is evaluated on manual addition. The industry standard maps this as 50% of the Monthly Gross.
                        </p>
                        <div className="pt-2 flex items-center gap-3">
                          <select id="basic-salary-percentage" name="basicSalaryPercentage"
                            value={basicSalaryPercentage}
                            onChange={(e) => setBasicSalaryPercentage(parseInt(e.target.value))}
                            className="px-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 font-bold focus:outline-none"
                          >
                            <option value="40">40% of Gross Salary</option>
                            <option value="50">50% of Gross Salary (Default)</option>
                            <option value="60">60% of Gross Salary</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-150 flex-1">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Building size={14} className="text-orange-500" /> Mapped Branch Office
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Default corporate branch for new, manual employee registration.
                        </p>
                        <input id="company-branch" name="companyBranch"
                          type="text"
                          value={companyBranch}
                          onChange={(e) => setCompanyBranch(e.target.value)}
                          placeholder="e.g. Hyderabad Branch"
                          className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded text-xs text-slate-800 font-semibold focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Middle: Office Locations Registry */}
                    <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-150 flex flex-col h-full">
                      <div>
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Map size={14} className="text-orange-500" /> Office Locations Registry
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Create, maintain, and edit corporate branch office designations. Renaming a branch updates all associated employee records in bulk automatically.
                        </p>
                      </div>

                      {/* Add new branch option row */}
                      <div className="space-y-2.5 w-full">
                        <div className="flex flex-col gap-2">
                          <input id="new-loc-name-input" name="newLocNameInput"
                            type="text"
                            placeholder="Enter a brand new office location name..."
                            value={newLocNameInput}
                            onChange={(e) => setNewLocNameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const val = newLocNameInput.trim();
                                if (val) {
                                  handleAddLocationFromConfig(val, newLocCompliance);
                                  setNewLocNameInput("");
                                }
                              }
                            }}
                            className="w-full px-3 py-1.5 border border-slate-250 bg-white text-xs text-slate-800 rounded placeholder-slate-400 focus:outline-none focus:border-orange-500 transition"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = newLocNameInput.trim();
                              if (val) {
                                handleAddLocationFromConfig(val, newLocCompliance);
                                setNewLocNameInput("");
                              }
                            }}
                            className="w-full px-3.5 py-1.5 bg-[#f57416] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1 cursor-pointer transition"
                          >
                            <Plus size={14} className="stroke-[2.5]" /> Add Branch
                          </button>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 space-y-2">
                          <label htmlFor="new-loc-compliance" className="flex items-start gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              id="new-loc-compliance"
                              checked={newLocCompliance}
                              onChange={(e) => setNewLocCompliance(e.target.checked)}
                              className="mt-0.5 w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer shrink-0"
                            />
                            <span className="text-[11px] font-bold text-slate-650 leading-snug">
                              Enable Compliance (PF, ESIC, PT)
                            </span>
                          </label>
                          <div className="flex items-center justify-between gap-3 pt-0.5 border-t border-slate-100">
                            <label htmlFor="new-loc-pt-amount" className="text-[11px] font-bold text-slate-650 whitespace-nowrap">
                              Default PT (₹)
                            </label>
                            <input
                              type="number"
                              id="new-loc-pt-amount"
                              min={0}
                              step={1}
                              value={newLocPtAmount}
                              onChange={(e) => setNewLocPtAmount(e.target.value)}
                              className="w-24 px-2 py-1 border border-slate-250 bg-white text-xs text-slate-800 rounded focus:outline-none focus:border-orange-500 text-right font-semibold"
                              title="Professional Tax amount when monthly gross exceeds ₹10,000"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bulk delete action bar */}
                      {selectedLocs.length > 0 && (
                        <div className="bg-orange-50 px-4 py-2 border border-orange-100 rounded-lg flex items-center justify-between animate-fade-in">
                          <span className="text-[11px] font-bold text-slate-700">
                            {selectedLocs.length} location{selectedLocs.length > 1 ? "s" : ""} selected
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteLocations(selectedLocs)}
                              className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer transition shadow-sm"
                            >
                              <Trash2 size={11} className="stroke-[2.5]" /> Delete Selected
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedLocs([])}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-lg cursor-pointer transition"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Display scrollable list of locations */}
                      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden flex flex-col min-w-0">
                        <div className="bg-slate-100/50 px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 min-w-0 cursor-pointer select-none">
                            <input id="loc-select-all" name="locSelectAll"
                              type="checkbox"
                              checked={customLocations.length > 0 && selectedLocs.length === customLocations.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLocs([...customLocations]);
                                } else {
                                  setSelectedLocs([]);
                                }
                              }}
                              className="w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer shrink-0"
                            />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider truncate">
                              All locations ({customLocations.length})
                            </span>
                          </label>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto overflow-x-hidden" id="locations-scrollable-list">
                          {customLocations.length === 0 ? (
                            <p className="px-3 py-6 text-center text-[11px] text-slate-400">No branch offices added yet.</p>
                          ) : (
                            customLocations.map((loc, idx) => {
                              const isEditing = editingLocIndex === idx;
                              const isSelected = selectedLocs.includes(loc);
                              return (
                                <div
                                  key={loc + idx}
                                  className={`px-3 py-2.5 space-y-2 transition ${isSelected ? "bg-orange-50/30" : "hover:bg-slate-50/60"}`}
                                >
                                  {isEditing ? (
                                    <div className="flex items-center gap-1.5">
                                      <input id={`edit-loc-${loc}`} name={`editLoc_${loc}`}
                                        type="text"
                                        value={editingLocValue}
                                        onChange={(e) => setEditingLocValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            if (editingLocValue.trim()) {
                                              handleEditLocationFromConfig(loc, editingLocValue.trim());
                                              setEditingLocIndex(null);
                                            }
                                          } else if (e.key === "Escape") {
                                            setEditingLocIndex(null);
                                          }
                                        }}
                                        className="flex-1 min-w-0 px-2.5 py-1 border border-blue-400 bg-blue-50/20 text-slate-800 font-medium text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        disabled={!editingLocValue.trim()}
                                        onClick={() => {
                                          if (editingLocValue.trim()) {
                                            handleEditLocationFromConfig(loc, editingLocValue.trim());
                                            setEditingLocIndex(null);
                                          }
                                        }}
                                        className="p-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded transition cursor-pointer shrink-0"
                                        title="Save name changes"
                                      >
                                        <Check size={12} className="stroke-[3]" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingLocIndex(null)}
                                        className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded border border-slate-200 transition cursor-pointer shrink-0"
                                        title="Cancel edit"
                                      >
                                        <X size={12} className="stroke-[2.5]" />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-start gap-2 min-w-0">
                                        <input id={`loc-select-${loc}`} name={`locSelect_${loc}`}
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedLocs(prev => [...prev, loc]);
                                            } else {
                                              setSelectedLocs(prev => prev.filter(l => l !== loc));
                                            }
                                          }}
                                          className="mt-0.5 w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer shrink-0"
                                        />
                                        <p
                                          className="flex-1 min-w-0 text-xs font-semibold text-slate-800 leading-snug"
                                          title={loc}
                                        >
                                          {loc}
                                        </p>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingLocIndex(idx);
                                              setEditingLocValue(loc);
                                            }}
                                            className="p-1 hover:bg-slate-150 text-slate-500 hover:text-slate-800 rounded border border-transparent hover:border-slate-250 transition cursor-pointer"
                                            title={`Rename "${loc}"`}
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteLocations([loc])}
                                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded border border-transparent hover:border-slate-250 transition cursor-pointer"
                                            title={`Delete "${loc}"`}
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-6">
                                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                          <input id={`loc-compliance-${loc}`} name={`locCompliance_${loc}`}
                                            type="checkbox"
                                            checked={!!locationCompliance[loc]}
                                            onChange={(e) => updateLocationCompliance(loc, e.target.checked)}
                                            className="w-3.5 h-3.5 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                                          />
                                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Compliance</span>
                                        </label>
                                        <label className="inline-flex items-center gap-1.5 select-none">
                                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">PT (₹)</span>
                                          <input id={`loc-pt-${loc}`} name={`locPt_${loc}`}
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={resolveLocationPtAmount(loc, locationPtAmounts)}
                                            onChange={(e) => updateLocationPtAmount(loc, e.target.value)}
                                            className="w-16 px-2 py-0.5 border border-slate-250 bg-white text-xs font-semibold text-slate-800 rounded focus:outline-none focus:border-orange-500 text-center"
                                            title={`Professional Tax for "${loc}" when gross > ₹10,000`}
                                          />
                                        </label>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Job Roles Registry */}
                    <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-150 flex flex-col h-full">
                      <div>
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Briefcase size={14} className="text-orange-500" /> Job Roles Registry
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Create, maintain, and edit specialized job designations. Renaming a role updates all associated employee records in bulk automatically.
                        </p>
                      </div>

                      {/* Add new role option row */}
                      <div className="flex gap-2 items-center">
                        <input id="new-role-name-input" name="newRoleNameInput"
                          type="text"
                          placeholder="Enter a brand new job role..."
                          value={newRoleNameInput}
                          onChange={(e) => setNewRoleNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = newRoleNameInput.trim();
                              if (val) {
                                handleAddRoleFromConfig(val);
                                setNewRoleNameInput("");
                              }
                            }
                          }}
                          className="flex-1 px-3 py-1.5 border border-slate-250 bg-white text-xs text-slate-800 rounded placeholder-slate-400 focus:outline-none focus:border-orange-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = newRoleNameInput.trim();
                            if (val) {
                              handleAddRoleFromConfig(val);
                              setNewRoleNameInput("");
                            }
                          }}
                          className="px-3.5 py-1.5 bg-[#f57416] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
                        >
                          <Plus size={14} className="stroke-[2.5]" /> Add Role
                        </button>
                      </div>

                      {/* Bulk delete action bar */}
                      {selectedRoles.length > 0 && (
                        <div className="bg-orange-50 px-4 py-2 border border-orange-100 rounded-lg flex items-center justify-between animate-fade-in">
                          <span className="text-[11px] font-bold text-slate-700">
                            {selectedRoles.length} role{selectedRoles.length > 1 ? "s" : ""} selected
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteRoles(selectedRoles)}
                              className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer transition shadow-sm"
                            >
                              <Trash2 size={11} className="stroke-[2.5]" /> Delete Selected
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedRoles([])}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-lg cursor-pointer transition"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Display scrollable list of roles */}
                      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden flex flex-col">
                        <div className="bg-slate-100/50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <input id="role-select-all" name="roleSelectAll"
                              type="checkbox"
                              checked={customRoles.length > 0 && selectedRoles.length === customRoles.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRoles([...customRoles]);
                                } else {
                                  setSelectedRoles([]);
                                }
                              }}
                              className="w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                            />
                            <span>Role Title</span>
                          </div>
                          <span>Actions</span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto" id="roles-scrollable-list">
                          {customRoles.map((role, idx) => {
                            const isEditing = editingRoleIndex === idx;
                            const isSelected = selectedRoles.includes(role);
                            return (
                              <div key={role + idx} className={`px-3 py-2 flex items-center justify-between transition ${isSelected ? "bg-orange-50/20" : "hover:bg-slate-50/50"}`}>
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5 flex-1 mr-2">
                                    <input id={`edit-role-${role}`} name={`editRole_${role}`}
                                      type="text"
                                      value={editingRoleValue}
                                      onChange={(e) => setEditingRoleValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          if (editingRoleValue.trim()) {
                                            handleEditRoleFromConfig(role, editingRoleValue.trim());
                                            setEditingRoleIndex(null);
                                          }
                                        } else if (e.key === "Escape") {
                                          setEditingRoleIndex(null);
                                        }
                                      }}
                                      className="flex-1 px-2.5 py-1 border border-blue-400 bg-blue-50/20 text-slate-800 font-medium text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      disabled={!editingRoleValue.trim()}
                                      onClick={() => {
                                        if (editingRoleValue.trim()) {
                                          handleEditRoleFromConfig(role, editingRoleValue.trim());
                                          setEditingRoleIndex(null);
                                        }
                                      }}
                                      className="p-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded transition cursor-pointer"
                                      title="Save name changes"
                                    >
                                      <Check size={12} className="stroke-[3]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingRoleIndex(null)}
                                      className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded border border-slate-200 transition cursor-pointer"
                                      title="Cancel edit"
                                    >
                                      <X size={12} className="stroke-[2.5]" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <input id={`role-select-${role}`} name={`roleSelect_${role}`}
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedRoles(prev => [...prev, role]);
                                          } else {
                                            setSelectedRoles(prev => prev.filter(r => r !== role));
                                          }
                                        }}
                                        className="w-3.5 h-3.5 text-orange-500 border-slate-300 rounded focus:ring-orange-500 cursor-pointer flex-shrink-0"
                                      />
                                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[280px] sm:max-w-md">{role}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingRoleIndex(idx);
                                          setEditingRoleValue(role);
                                        }}
                                        className="p-1 hover:bg-slate-150 text-slate-500 hover:text-slate-800 rounded border border-transparent hover:border-slate-250 transition cursor-pointer"
                                        title={`Rename "${role}"`}
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRoles([role])}
                                        className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded border border-transparent hover:border-slate-250 transition cursor-pointer"
                                        title={`Delete "${role}"`}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => {
                        triggerSuccess("Successfully applied all configuration changes.");
                        setActivePimSubTab("Employee List");
                      }}
                      className="px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white font-bold text-xs rounded-lg shadow cursor-pointer transition"
                    >
                      Apply Rule Mappings
                    </button>
                  </div>
                </div>
              )}

              {/* Employees SUB-TAB 2: REPORTS DASHBOARD WITH SUMMARY DATA */}
              {activePimSubTab === "Reports" && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6 animate-fade-in" id="view-reports-panel">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-800 tracking-tight">Active Employee Database Reports</h3>
                      <p className="text-xs text-slate-400 mt-1">Dynamic data visualizers summarizing current onboardings</p>
                    </div>
                    <button
                      onClick={() => handleExportSelected("csv", employees.map(e => e.id))}
                      className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded text-xs text-slate-700 font-bold transition cursor-pointer"
                    >
                      <FileSpreadsheet size={13} className="text-green-600" /> Export All CSV Report
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="reports-bento-cards">
                    {/* Distribution card */}
                    <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                      <span className="text-xs font-black text-slate-700 block uppercase tracking-wider flex items-center gap-1.5">
                        <Map size={14} className="text-blue-500" /> Location Allocations
                      </span>
                      <div className="divide-y divide-slate-100 text-xs text-slate-600 max-h-48 overflow-y-auto">
                        {Array.from(new Set(employees.map(e => e.location || "Unassigned"))).map(loc => {
                          const count = employees.filter(e => (e.location || "Unassigned") === loc).length;
                          const pct = employees.length ? Math.round((count / employees.length) * 100) : 0;
                          return (
                            <div key={loc} className="py-2 flex items-center justify-between">
                              <span className="font-bold truncate max-w-[150px]">{loc}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500" style={{ width: `${pct}%` }}></div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Gender Breakdown card */}
                    <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                      <span className="text-xs font-black text-slate-700 block uppercase tracking-wider flex items-center gap-1.5">
                        <UserCircle size={14} className="text-emerald-500" /> Gender Demographics
                      </span>
                      <div className="space-y-4 text-xs">
                        {["Male", "Female", "Other"].map(genderType => {
                          const count = employees.filter(e => (e.gender || "Male").toLowerCase() === genderType.toLowerCase()).length;
                          const pct = employees.length ? Math.round((count / employees.length) * 100) : 0;
                          return (
                            <div key={genderType} className="space-y-1">
                              <div className="flex justify-between font-bold text-slate-600">
                                <span>{genderType}</span>
                                <span className="font-mono text-slate-400">{count} Employees ({pct}%)</span>
                              </div>
                              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Salary Bands */}
                    <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                      <span className="text-xs font-black text-slate-700 block uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-orange-500" /> Monthly Payroll Mappings
                      </span>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-white">
                          <span className="text-slate-500 font-medium">Total Gross Pool:</span>
                          <span className="font-extrabold text-slate-800">Rs. {dashboardStats.totalGrossPayroll.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white">
                          <span className="text-slate-500 font-medium">Average Salary:</span>
                          <span className="font-extrabold text-slate-800">
                            Rs. {employees.length ? Math.round(dashboardStats.totalGrossPayroll / employees.length).toLocaleString("en-IN") : "0"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-white">
                          <span className="text-slate-500 font-medium">ESIC Insured Rate:</span>
                          <span className="font-extrabold text-slate-800">
                            {employees.length ? Math.round((dashboardStats.esicCoveredCount / employees.length) * 100) : "0"}% Cover Rate
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Custom Reports Builder */}
                  <div className="mt-8 pt-6 border-t border-slate-100 space-y-6" id="custom-reports-builder">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Wrench size={16} className="text-[#f57416]" /> Custom Report Builder (On-Demand)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Configure targeted custom filters, choose your required spreadsheet columns individually, and download on-demand reports instantly.
                        </p>
                      </div>

                      {/* Layout Template Management System */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl text-left shrink-0 max-w-full">
                        {/* Load template dropdown */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider whitespace-nowrap">📋 Template:</span>
                          <select id="active-report-template-name" name="activeReportTemplateName"
                            value={activeReportTemplateName}
                            onChange={(e) => handleLoadReportTemplate(e.target.value)}
                            className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] font-bold text-slate-800 focus:outline-none min-w-[120px] max-w-[150px] truncate"
                          >
                            <option value="">-- Choose Layout --</option>
                            {savedReportTemplates.map((t: any) => (
                              <option key={t.name} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                          {activeReportTemplateName && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReportTemplate(activeReportTemplateName)}
                              className="text-red-500 hover:text-red-700 font-extrabold text-[10px] hover:bg-red-50 px-1.5 py-0.5 rounded cursor-pointer transition uppercase"
                              title="Delete template"
                            >
                              ✕ Delete
                            </button>
                          )}
                        </div>

                        <span className="hidden sm:inline text-slate-300">|</span>

                        {/* Save new template inline form */}
                        <form onSubmit={handleSaveReportTemplate} className="flex items-center gap-1">
                          <input id="new-report-template-name" name="newReportTemplateName"
                            type="text"
                            placeholder="New template name..."
                            value={newReportTemplateName}
                            onChange={(e) => setNewReportTemplateName(e.target.value)}
                            className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] font-medium text-slate-700 focus:outline-none focus:border-[#f57416] w-[130px]"
                          />
                          <button
                            type="submit"
                            disabled={!newReportTemplateName.trim()}
                            className="px-2.5 py-1 bg-[#ff791a] hover:bg-[#e4640c] disabled:opacity-40 text-white font-extrabold text-[10px] uppercase tracking-wider rounded transition cursor-pointer shrink-0"
                          >
                            Save Layout
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Filter Criteria Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
                      
                      {/* Location Filter (multi-select) */}
                      <div className="space-y-1.5 relative" id="report-loc-multiselect-container">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Branch/Work Location</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setIsReportLocDropdownOpen(!isReportLocDropdownOpen);
                              setIsSkillDropdownOpen(false);
                              setIsRoleDropdownOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                          >
                            <span className="truncate">
                              {reportLocFilters.length === 0
                                ? "All Locations"
                                : reportLocFilters.length === 1
                                  ? reportLocFilters[0]
                                  : `${reportLocFilters.length} Locations Selected`}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0 ml-1">▼</span>
                          </button>

                          {isReportLocDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-56 overflow-y-auto">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                <span className="text-[10px] text-slate-400 font-bold">Branches</span>
                                <button
                                  type="button"
                                  onClick={() => setReportLocFilters([])}
                                  className="text-[9px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                                >
                                  Clear All
                                </button>
                              </div>
                              {customLocations.map((loc) => {
                                const isChecked = reportLocFilters.includes(loc);
                                const toggle = () => {
                                  if (isChecked) {
                                    setReportLocFilters((prev) => prev.filter((l) => l !== loc));
                                  } else {
                                    setReportLocFilters((prev) => [...prev, loc]);
                                  }
                                };
                                return (
                                  <label
                                    key={loc}
                                    className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none"
                                  >
                                    <input id="checkbox-field-9582" name="checkbox_9582"
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={toggle}
                                      className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                    />
                                    <span className="font-medium leading-snug">{loc}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Employee Search Bar */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search Employee</label>
                        <input id="report-search-query" name="reportSearchQuery"
                          type="text"
                          placeholder="Search Code or Name..."
                          value={reportSearchQuery}
                          onChange={(e) => setReportSearchQuery(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416]"
                        />
                      </div>

                      {/* Skill Category Filter */}
                      <div className="space-y-1.5 relative" id="skill-multiselect-container">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Skill Category Filter</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setIsSkillDropdownOpen(!isSkillDropdownOpen);
                              setIsRoleDropdownOpen(false);
                              setIsReportLocDropdownOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                          >
                            <span className="truncate">
                              {reportSkillFilters.length === 0 
                                ? "All Categories" 
                                : `${reportSkillFilters.length} Selected`}
                            </span>
                            <span className="text-[10px] text-slate-400">▼</span>
                          </button>
                          
                          {isSkillDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-48 overflow-y-auto">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                <span className="text-[10px] text-slate-400 font-bold">Categories</span>
                                <button
                                  type="button"
                                  onClick={() => setReportSkillFilters([])}
                                  className="text-[9px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                                >
                                  Clear All
                                </button>
                              </div>
                              {["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"].map(cat => {
                                const isChecked = reportSkillFilters.includes(cat);
                                const toggle = () => {
                                  if (isChecked) {
                                    setReportSkillFilters(prev => prev.filter(c => c !== cat));
                                  } else {
                                    setReportSkillFilters(prev => [...prev, cat]);
                                  }
                                };
                                return (
                                  <label key={cat} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                    <input id="checkbox-field-9653" name="checkbox_9653"
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={toggle}
                                      className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                    />
                                    <span className="font-medium">{cat}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Job Role Filter */}
                      <div className="space-y-1.5 relative" id="role-multiselect-container">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Job Role Filter</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setIsRoleDropdownOpen(!isRoleDropdownOpen);
                              setIsSkillDropdownOpen(false);
                              setIsReportLocDropdownOpen(false);
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#f57416] text-left flex justify-between items-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                          >
                            <span className="truncate">
                              {reportRoleFilters.length === 0 
                                ? "All Roles" 
                                : `${reportRoleFilters.length} Selected`}
                            </span>
                            <span className="text-[10px] text-slate-400">▼</span>
                          </button>
                          
                          {isRoleDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-2 space-y-1 max-h-56 overflow-y-auto">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-1.5">
                                <span className="text-[10px] text-slate-400 font-bold">Roles</span>
                                <button
                                  type="button"
                                  onClick={() => setReportRoleFilters([])}
                                  className="text-[9px] font-black uppercase text-slate-500 hover:text-slate-700 cursor-pointer"
                                >
                                  Clear All
                                </button>
                              </div>
                              {customRoles.map(role => {
                                const isChecked = reportRoleFilters.includes(role);
                                const toggle = () => {
                                  if (isChecked) {
                                    setReportRoleFilters(prev => prev.filter(r => r !== role));
                                  } else {
                                    setReportRoleFilters(prev => [...prev, role]);
                                  }
                                };
                                return (
                                  <label key={role} className="flex items-center gap-2 px-1.5 py-1 hover:bg-slate-50 rounded text-xs text-slate-700 cursor-pointer select-none">
                                    <input id="checkbox-field-9712" name="checkbox_9712"
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={toggle}
                                      className="w-3.5 h-3.5 rounded border-slate-350 text-[#f57416] focus:ring-[#f57416]"
                                    />
                                    <span className="font-medium">{role}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PF Joining Date Range */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">PF Joining Date Range</label>
                        <div className="grid grid-cols-2 gap-1 items-center">
                          <input id="report-join-start-filter" name="reportJoinStartFilter"
                            type="date"
                            value={reportJoinStartFilter}
                            onChange={(e) => setReportJoinStartFilter(e.target.value)}
                            className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                          />
                          <input id="report-join-end-filter" name="reportJoinEndFilter"
                            type="date"
                            value={reportJoinEndFilter}
                            onChange={(e) => setReportJoinEndFilter(e.target.value)}
                            className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                          />
                        </div>
                      </div>

                      {/* Exit Date Range */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Exit/Leaving Date Range</label>
                        <div className="grid grid-cols-2 gap-1 items-center">
                          <input id="report-exit-start-filter" name="reportExitStartFilter"
                            type="date"
                            value={reportExitStartFilter}
                            onChange={(e) => setReportExitStartFilter(e.target.value)}
                            className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                          />
                          <input id="report-exit-end-filter" name="reportExitEndFilter"
                            type="date"
                            value={reportExitEndFilter}
                            onChange={(e) => setReportExitEndFilter(e.target.value)}
                            className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                          />
                        </div>
                      </div>

                      {/* Salary Range */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Monthly Gross Salary (Rs.)</label>
                        <div className="grid grid-cols-2 gap-1 items-center">
                          <input id="report-min-salary-filter" name="reportMinSalaryFilter"
                            type="number"
                            placeholder="Min"
                            value={reportMinSalaryFilter}
                            onChange={(e) => setReportMinSalaryFilter(e.target.value)}
                            className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                          />
                          <input id="report-max-salary-filter" name="reportMaxSalaryFilter"
                            type="number"
                            placeholder="Max"
                            value={reportMaxSalaryFilter}
                            onChange={(e) => setReportMaxSalaryFilter(e.target.value)}
                            className="px-2 py-1 border border-slate-250 bg-white rounded text-[11px] text-slate-700 focus:outline-none focus:border-[#f57416]"
                          />
                        </div>
                      </div>

                      {/* Gender Filter */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gender</label>
                        <select id="report-gender-filter" name="reportGenderFilter"
                          value={reportGenderFilter}
                          onChange={(e) => setReportGenderFilter(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none"
                        >
                          <option value="All">All Genders</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Marital Status Filter */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Marital Status</label>
                        <select id="report-marital-filter" name="reportMaritalFilter"
                          value={reportMaritalFilter}
                          onChange={(e) => setReportMaritalFilter(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none"
                        >
                          <option value="All">All Statuses</option>
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>

                      {/* ESIC Filter */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ESIC Insured Status</label>
                        <select id="report-esic-filter" name="reportEsicFilter"
                          value={reportEsicFilter}
                          onChange={(e) => setReportEsicFilter(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded text-xs font-semibold text-slate-700 focus:outline-none"
                        >
                          <option value="All">All Coverage</option>
                          <option value="Yes">Yes (Insured)</option>
                          <option value="No">No (Exempt/Excluded)</option>
                        </select>
                      </div>

                      {/* Action Result Info */}
                      <div className="flex flex-col justify-end">
                        <div className="bg-[#f57416]/10 border border-[#f57416]/20 rounded-lg p-2 text-center">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Matched Employees</span>
                          <span className="text-sm font-extrabold text-[#f57416]">{filteredReportEmployees.length} records</span>
                        </div>
                      </div>

                    </div>

                    {/* Column Selection Section */}
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Choose Columns to Include ({selectedReportColumns.length} of {EXCEL_ROW_HEADERS.length} selected)</h5>
                          <p className="text-[10px] text-slate-400">Click individual column headers or use category blocks to build custom schemas.</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedReportColumns(EXCEL_ROW_HEADERS)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-600 font-bold rounded cursor-pointer transition"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedReportColumns([])}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-600 font-bold rounded cursor-pointer transition"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      {/* Six Column Grouping Sections */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          {
                            name: "Workplace & Metadata",
                            color: "bg-blue-100/50 text-blue-800 border-blue-205",
                            headers: ["SR NO", "Employees Code **", "Location", "Skill Category", "Job Role", "Working Days Cycle", "Daily Wage"]
                          },
                          {
                            name: "Primary Demographics",
                            color: "bg-purple-100/50 text-purple-800 border-purple-205",
                            headers: ["EMPLOYEE NAME AS PER AADHAR ***", "GENDER **", "DATE OF BIRTH", "MARITAL STATUS **", "AADHAR LINK MOB.NO. **", "Employee Mobile"]
                          },
                          {
                            name: "Payroll & Statutory Systems",
                            color: "bg-emerald-100/50 text-emerald-800 border-emerald-205",
                            headers: ["Gross Salary***", "Basic Salary***", "ESIC", "UAN", "PF JOINING DATE"]
                          },
                          {
                            name: "Identity & Tax Credentials",
                            color: "bg-indigo-100/50 text-indigo-800 border-indigo-205",
                            headers: ["AADHAR NO **", "NAME AS PER AADHAR **", "PAN NO", "NAME AS PER PAN", "Present Address**", "Permanent Address**"]
                          },
                          {
                            name: "Bank Details & Directives",
                            color: "bg-amber-100/50 text-amber-800 border-amber-305",
                            headers: ["BANK ACCOUNT NO **", "IFSC CODE **", "EMPLOYEE NAME AS PER BANK **"]
                          },
                          {
                            name: "Family, Nominee & Prior Registry",
                            color: "bg-rose-100/50 text-rose-800 border-rose-205",
                            headers: [
                              "FATHER **", "HUSBAND NAME **", "PREVIOUS UAN NO", "PREVIOUS ESIC NO***",
                              "Nominee Name (ESIC)", "Nominee DOB", "Nominee Relation", "Nominee Mobile",
                              "Family Member Name (1)", "Family Member DOB (1)", "Family Member Relation (1)", "Family Member Mobile (1)",
                              "Family Member Name (2)", "Family Member DOB (2)", "Family Member Relation (2)", "Family Member Mobile (2)",
                              "Family Member Name (3)", "Family Member DOB (3)", "Family Member Relation (3)", "Family Member Mobile (3)"
                            ]
                          }
                        ].map(group => {
                          const groupCheckedCount = group.headers.filter(h => selectedReportColumns.includes(h)).length;
                          const isAllGroupChecked = groupCheckedCount === group.headers.length;
                          const isSomeGroupChecked = groupCheckedCount > 0 && !isAllGroupChecked;

                          const toggleGroup = () => {
                            if (isAllGroupChecked) {
                              // Remove all
                              setSelectedReportColumns(prev => prev.filter(h => !group.headers.includes(h)));
                            } else {
                              // Add all
                              setSelectedReportColumns(prev => Array.from(new Set([...prev, ...group.headers])));
                            }
                          };

                          return (
                            <div key={group.name} className="border border-slate-150 rounded-xl overflow-hidden bg-white flex flex-col">
                              {/* Header band */}
                              <div className={`px-3 py-2 border-b border-inherit flex items-center justify-between ${group.color}`}>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <input id="checkbox-field-9925" name="checkbox_9925"
                                    type="checkbox"
                                    ref={el => {
                                      if (el) el.indeterminate = isSomeGroupChecked;
                                    }}
                                    checked={isAllGroupChecked}
                                    onChange={toggleGroup}
                                    className="rounded border-slate-300 text-[#f57416] focus:ring-[#f57416] cursor-pointer"
                                  />
                                  <span className="text-[11px] font-black uppercase tracking-wider truncate">{group.name}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white/60 text-slate-700 rounded-full font-mono">
                                  {groupCheckedCount}/{group.headers.length}
                                </span>
                              </div>

                              {/* Members list */}
                              <div className="p-3 space-y-1.5 overflow-y-auto max-h-48 grow">
                                {group.headers.map(header => {
                                  const isChecked = selectedReportColumns.includes(header);
                                  const toggleHeader = () => {
                                    if (isChecked) {
                                      setSelectedReportColumns(prev => prev.filter(h => h !== header));
                                    } else {
                                      setSelectedReportColumns(prev => [...prev, header]);
                                    }
                                  };
                                  return (
                                    <label key={header} className="flex items-start gap-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer select-none">
                                      <input id="checkbox-field-9954" name="checkbox_9954"
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={toggleHeader}
                                        className="mt-0.5 rounded border-slate-300 text-[#f57416] focus:ring-[#f57416]"
                                      />
                                      <span className="font-medium inline-block pr-1 text-slate-700">{header}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Filtered Results Preview Table */}
                    <div className="space-y-3 pt-6 border-t border-slate-200" id="reports-preview-section">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                            Live Preview ({filteredReportEmployees.length > 50 ? `First 50 of ${filteredReportEmployees.length}` : `${filteredReportEmployees.length}`} Records Matched)
                          </h5>
                          <p className="text-[10px] text-slate-400">
                            Live data preview containing only your selected {selectedReportColumns.length} columns and filtered dataset.
                          </p>
                        </div>
                      </div>

                      {filteredReportEmployees.length === 0 ? (
                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-8 text-center text-xs text-slate-450 font-medium">
                          No matching employees found for the chosen filters.
                        </div>
                      ) : selectedReportColumns.length === 0 ? (
                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-8 text-center text-xs text-slate-450 font-medium">
                          Select at least one column to preview matching records.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-inner max-h-[350px] overflow-y-auto overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-800 text-white font-bold select-none sticky top-0 z-10">
                              <tr>
                                <th className="sticky left-0 z-20 bg-slate-800 p-3 w-[48px] min-w-[48px] max-w-[48px] text-center border-r border-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={
                                      filteredReportEmployees.length > 0 &&
                                      filteredReportEmployees.every(emp => selectedReportEmployeeIds.includes(emp.id))
                                    }
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedReportEmployeeIds(filteredReportEmployees.map(emp => emp.id));
                                      } else {
                                        setSelectedReportEmployeeIds([]);
                                      }
                                    }}
                                    className="rounded border-slate-600 bg-slate-700 text-[#f57416] focus:ring-[#f57416] cursor-pointer w-4 h-4"
                                    id="reports-select-all"
                                  />
                                </th>
                                {selectedReportColumns.map((col, idx) => (
                                  <th key={col + idx} className="p-3 border-r border-slate-700 uppercase tracking-wider text-[10px] whitespace-nowrap">
                                    {col.replace(/[\*\s]+/g, " ").trim()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                              {filteredReportEmployees.slice(0, 50).map((emp, empIdx) => {
                                const isSelected = selectedReportEmployeeIds.includes(emp.id);
                                return (
                                  <tr key={emp.id || empIdx} className={`hover:bg-slate-50/50 transition group ${isSelected ? "bg-orange-50/20" : ""}`}>
                                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 p-3 w-[48px] min-w-[48px] max-w-[48px] text-center border-r border-slate-105 shadow-[2px_0_4px_rgba(0,0,0,0.03)]">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {
                                          if (isSelected) {
                                            setSelectedReportEmployeeIds(prev => prev.filter(id => id !== emp.id));
                                          } else {
                                            setSelectedReportEmployeeIds(prev => [...prev, emp.id]);
                                          }
                                        }}
                                        className="rounded border-slate-350 text-[#f57416] focus:ring-[#f57416] cursor-pointer w-4 h-4"
                                        id={`report-check-${emp.id}`}
                                      />
                                    </td>
                                    {selectedReportColumns.map((col, colIdx) => {
                                      const val = getEmployeeHeaderValue(emp, col, empIdx);
                                      return (
                                        <td key={col + colIdx} className="p-3 border-r border-slate-100 max-w-[200px] truncate whitespace-nowrap font-mono text-[11px]" title={String(val)}>
                                          {val !== undefined && val !== null && val !== "" ? String(val) : "—"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Report Format Action Downloads */}
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-end bg-slate-100 p-4 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-500 uppercase mr-auto flex items-center gap-1">
                        <CheckCircle2 size={13} className="text-emerald-500 fill-emerald-100" /> Options Loaded & Prepared
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {/* CSV download button */}
                        <button
                          type="button"
                          disabled={filteredReportEmployees.length === 0 || selectedReportColumns.length === 0}
                          onClick={() => {
                            const dataToDownload = selectedReportEmployeeIds.length > 0
                              ? filteredReportEmployees.filter(emp => selectedReportEmployeeIds.includes(emp.id))
                              : filteredReportEmployees;
                            downloadReportsCSV(dataToDownload, selectedReportColumns);
                          }}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
                          id="report-download-csv-btn"
                        >
                          <FileText size={14} /> Download CSV {selectedReportEmployeeIds.length > 0 && `(${selectedReportEmployeeIds.length})`}
                        </button>

                        {/* Excel download button */}
                        <button
                          type="button"
                          disabled={filteredReportEmployees.length === 0 || selectedReportColumns.length === 0}
                          onClick={() => {
                            const dataToDownload = selectedReportEmployeeIds.length > 0
                              ? filteredReportEmployees.filter(emp => selectedReportEmployeeIds.includes(emp.id))
                              : filteredReportEmployees;
                            downloadReportsExcel(dataToDownload, selectedReportColumns, reportLocationExportLabel);
                          }}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
                          id="report-download-excel-btn"
                        >
                          <FileSpreadsheet size={14} /> Download Excel {selectedReportEmployeeIds.length > 0 && `(${selectedReportEmployeeIds.length})`}
                        </button>

                        {/* PDF download button */}
                        <button
                          type="button"
                          disabled={filteredReportEmployees.length === 0 || selectedReportColumns.length === 0}
                          onClick={() => {
                            const dataToDownload = selectedReportEmployeeIds.length > 0
                              ? filteredReportEmployees.filter(emp => selectedReportEmployeeIds.includes(emp.id))
                              : filteredReportEmployees;
                            downloadReportsPDF(dataToDownload, selectedReportColumns, reportLocationExportLabel);
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
                          id="report-download-pdf-btn"
                        >
                          <FileText size={14} /> Download PDF {selectedReportEmployeeIds.length > 0 && `(${selectedReportEmployeeIds.length})`}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Employees SUB-TAB 3: CORE EMPLOYEE DIRECTORY & CSV BULK LOADER */}
              {activePimSubTab === "Employee List" && (
                <>
                  {/* Executive Quick Statistics Bento Blocks */}
                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-dashboard-grid">
                    {/* Metric 1 */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between" id="metric-block-1">
                      <div>
                        <span className="text-slate-400 text-xs font-bold block bg-transparent">Registry Record Count</span>
                        <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
                          {isLoading ? "..." : `${dashboardStats.totalCount} Employees`}
                        </span>
                      </div>
                      <div className="bg-orange-50 p-3 rounded-xl text-[#ff791a] shrink-0">
                        <Users size={20} />
                      </div>
                    </div>

                    {/* Metric 2 */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between" id="metric-block-2">
                      <div>
                        <span className="text-slate-400 text-xs font-bold block bg-transparent">Total Gross Payroll</span>
                        <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
                          {isLoading ? "..." : `Rs. ${dashboardStats.totalGrossPayroll.toLocaleString("en-IN")}`}
                        </span>
                      </div>
                      <div className="bg-green-50/70 p-3 rounded-xl text-green-600 shrink-0">
                        <IndianRupee size={20} />
                      </div>
                    </div>

                    {/* Metric 3 */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between" id="metric-block-3">
                      <div>
                        <span className="text-slate-400 text-xs font-bold block bg-transparent">ESIC Insured Status</span>
                        <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
                          {isLoading ? "..." : `${dashboardStats.esicCoveredCount} Covered`}
                        </span>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-xl text-purple-600 shrink-0">
                        <Heart size={20} />
                      </div>
                    </div>

                    {/* Metric 4 */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between" id="metric-block-4">
                      <div>
                        <span className="text-slate-400 text-xs font-bold block bg-transparent">Distinct Worksites</span>
                        <span className="text-2xl font-black text-slate-850 mt-1 inline-block">
                          {isLoading ? "..." : `${dashboardStats.uniqueLocsCount} Mapping`}
                        </span>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-xl text-blue-600 shrink-0">
                        <Map size={20} />
                      </div>
                    </div>
                  </section>

                  {/* Bulk CSV Upload Console */}
                  {!!userPermissions.employees?.edit && (
                    <section id="bulk-importer-section" className="animate-fade-in">
                      <CsvImporter 
                        onImportSuccess={handleBulkImport} 
                        existingCodes={existingCodes} 
                        availableLocations={customLocations} 
                        availableRoles={customRoles}
                      />
                    </section>
                  )}

                  {/* Master Employee Database Grid Container */}
                  <section className="flex-1 flex flex-col min-h-[400px] bg-white border border-slate-200 rounded-xl p-5 shadow-xs" id="database-grid-section">
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                          <FileSpreadsheet className="text-slate-500" size={18} />
                          ECR-Structured Employee Master Registry
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">Edit, delete, or bulk-export rows into statutory Indian onboarding templates</p>
                      </div>
                      <span className="text-xs text-slate-400 bg-slate-50 inline-block px-2.5 py-1 rounded-full border border-slate-200/50">
                        💡 Checked boxes unlock bulk actions below the table grid
                      </span>
                    </div>

                    {isLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 font-medium">
                        <div className="relative w-10 h-10 mb-3 animate-spin">
                          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                          <div className="absolute inset-0 rounded-full border-4 border-[#ff791a] border-t-transparent"></div>
                        </div>
                        Loading employee directory...
                      </div>
                    ) : (
                      <EmployeeTable
                        employees={employees}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        onEditClick={(emp) => {
                          setCurrentEmployee(emp);
                          setIsFormOpen(true);
                        }}
                        onDeleteClick={handleDeleteEmployee}
                        onBulkDelete={handleBulkDelete}
                        onExportSelected={handleExportSelected}
                        readOnly={!userPermissions.employees?.edit}
                      />
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>

        {/* Small informative details footer */}
        <footer className="mt-auto px-6 py-4 bg-white border-t border-slate-200 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 select-none" id="applet-footer">
          <p>© 2026 Flex HRM, an Intelligic product. All rights reserved. Licensed to {sessionUser}.</p>
          <p className="flex items-center gap-1 font-mono text-[10px]">
            🔒 Connected to MongoDB API
          </p>
        </footer>
      </main>

      {/* Floating Single Onboarding/Edit Modal */}
      {isFormOpen && (
        <EmployeeFormModal
          employee={currentEmployee}
          availableLocations={customLocations}
          basicSalaryPercent={basicSalaryPercentage}
          esicEligibilityLimit={esicEligibilityLimit}
          onLocationRegistryUpdate={fetchLocations}
          onCreateLocation={handleAddLocationFromConfig}
          onCreateRole={handleAddRoleFromConfig}
          onClose={() => {
            setIsFormOpen(false);
            setCurrentEmployee(null);
            // If they closed adding tab, reset active sub tab choice
            if (activePimSubTab === "Add Employee") {
              setActivePimSubTab("Employee List");
            }
          }}
          onSave={handleSaveEmployee}
        />
      )}

      {/* Voice Dialer Simulation Overlay Modal */}
      {activeDialerContact && (
        <DialerOverlay
          contact={activeDialerContact}
          status={activeDialerStatus}
          setStatus={setActiveDialerStatus}
          onClose={() => setActiveDialerContact(null)}
        />
      )}

      {/* Mobile Drawer backdrop overlay */}
      {!isSidebarCollapsed && (
        <div 
          onClick={() => setIsSidebarCollapsed(true)} 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-45 md:hidden transition-all duration-300 animate-fade-in"
          id="sidebar-backdrop"
        />
      )}

      {/* Premium Floating Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-2.5 shadow-xl flex items-center justify-around z-40 md:hidden animate-slide-up" id="mobile-bottom-nav">
        {[
          { name: "Employees", label: "Staff", icon: Users },
          { name: "Attendance", label: "Records", icon: Clock },
          { name: "Salary", label: "Payroll", icon: Coins },
          { name: "Directory", label: "Contacts", icon: Contact },
        ].filter((item) => {
          const key = getModuleKey(item.name);
          return !key || !!userPermissions[key]?.view;
        }).map((item) => {
          const IconComponent = item.icon;
          const isSelected = activeSidebarTab === item.name;
          return (
            <button
              key={item.name}
              onClick={() => {
                setActiveSidebarTab(item.name);
                setIsSidebarCollapsed(true); // Close drawer if open
                triggerSuccess(`Switched to: ${item.name}`);
              }}
              className={`flex flex-col items-center gap-1 transition cursor-pointer select-none ${
                isSelected ? "text-[#ff791a]" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <IconComponent size={20} className={isSelected ? "stroke-[2.5]" : "stroke-[2]"} />
              <span className="text-[9px] font-extrabold tracking-wide uppercase">{item.label}</span>
            </button>
          );
        })}
        {/* Menu trigger button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-700 cursor-pointer select-none"
        >
          <Menu size={20} />
          <span className="text-[9px] font-extrabold tracking-wide uppercase">Menu</span>
        </button>
      </div>

      {/* Confetti Celebration Overlay */}
      {showConfetti && <ConfettiRain />}
    </div>
  );
}

// Outgoing call dialer simulation component
const DialerOverlay = ({ contact, status, setStatus, onClose }: { 
  contact: { name: string; phone: string; role?: string }; 
  status: "ringing" | "connected" | "ended"; 
  setStatus: React.Dispatch<React.SetStateAction<"ringing" | "connected" | "ended">>; 
  onClose: () => void;
}) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    // Ring for 2 seconds, then automatically connect
    if (status === "ringing") {
      const ringTimer = setTimeout(() => {
        setStatus("connected");
      }, 2000);
      return () => clearTimeout(ringTimer);
    }
  }, [status, setStatus]);

  useEffect(() => {
    // Call duration timer
    if (status === "connected") {
      const interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in" id="voice-dialer-overlay-simulator">
      {/* Dialer UI card */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 text-white rounded-2xl w-full max-w-sm p-8 shadow-2xl relative flex flex-col items-center justify-between min-h-[480px] overflow-hidden">
        {/* Glowing glass accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-[#ff791a]/10 blur-3xl pointer-events-none" />
        
        {/* Upper card header: Simulation Indicator */}
        <div className="w-full flex justify-between items-center opacity-60">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#ff791a] border border-[#ff791a]/30 px-2 py-0.5 rounded-full bg-orange-500/5">Simulated Call</span>
          <span className="text-[10px] font-mono tracking-wider font-bold">HD Voice • Secure</span>
        </div>

        {/* Contact info, avatar and ringing state */}
        <div className="flex flex-col items-center space-y-5 my-auto">
          {/* Pulsing visual waves for dialing */}
          <div className="relative flex items-center justify-center">
            {status === "ringing" && (
              <>
                <div className="absolute w-24 h-24 rounded-full bg-orange-500/10 animate-ping" />
                <div className="absolute w-32 h-32 rounded-full bg-orange-500/5 animate-pulse" />
              </>
            )}
            {status === "connected" && (
              <>
                <div className="absolute w-24 h-24 rounded-full bg-emerald-500/10 animate-pulse" />
              </>
            )}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black shadow-lg ${
              status === "ringing" ? "bg-orange-500 text-white" :
              status === "connected" ? "bg-emerald-500 text-white" :
              "bg-rose-500 text-white"
            }`}>
              {contact.name.charAt(0)}
            </div>
          </div>

          <div className="text-center space-y-1.5 flex flex-col items-center">
            <h3 className="text-lg font-black tracking-tight">{contact.name}</h3>
            {contact.role && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{contact.role}</p>}
            <p className="text-xs font-mono text-slate-400">{contact.phone}</p>
          </div>

          {/* Call Status Text and Timer */}
          <div className="text-center space-y-1">
            <span className={`text-[11px] font-bold tracking-widest uppercase block ${
              status === "ringing" ? "text-orange-400 animate-pulse" :
              status === "connected" ? "text-emerald-400" :
              "text-rose-500"
            }`}>
              {status === "ringing" ? "Ringing..." :
               status === "connected" ? "Connected • Call Active" :
               "Call Ended"}
            </span>
            {status === "connected" && (
              <span className="text-lg font-mono font-bold tracking-widest text-slate-300 block">{formatTime(seconds)}</span>
            )}
          </div>
        </div>

        {/* Buttons grid for controls */}
        <div className="w-full grid grid-cols-3 gap-6 pt-4 border-t border-slate-800 text-slate-400 text-[10px] font-bold">
          <button className="flex flex-col items-center gap-1.5 hover:text-white cursor-not-allowed">
            <span className="w-9 h-9 rounded-full bg-slate-800/40 border border-slate-800 flex items-center justify-center text-lg">🔇</span>
            <span>Mute</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 hover:text-white cursor-not-allowed">
            <span className="w-9 h-9 rounded-full bg-slate-800/40 border border-slate-800 flex items-center justify-center text-lg">🔢</span>
            <span>Keypad</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 hover:text-white cursor-not-allowed">
            <span className="w-9 h-9 rounded-full bg-slate-800/40 border border-slate-800 flex items-center justify-center text-lg">🔊</span>
            <span>Speaker</span>
          </button>
        </div>

        {/* Red End Call Button */}
        <div className="pt-6 w-full">
          <button
            onClick={() => {
              setStatus("ended");
              setTimeout(() => {
                onClose();
              }, 800);
            }}
            className="w-full py-3 bg-red-600 hover:bg-red-700 active:scale-98 text-white font-extrabold text-xs tracking-wider rounded-xl shadow-lg transition duration-150 uppercase flex items-center justify-center gap-2 cursor-pointer"
          >
            ❌ End Call
          </button>
        </div>
      </div>
    </div>
  );
};

// CSS-based falling confetti overlay component
const ConfettiRain = () => {
  const [particles, setParticles] = useState<{ id: number; left: number; color: string; delay: number; duration: number; size: number }[]>([]);
  useEffect(() => {
    const colors = ["#ff791a", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
    const newParticles = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100, // percentage
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
      duration: 2.5 + Math.random() * 2,
      size: 6 + Math.random() * 8
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            top: `-20px`,
            opacity: 0.8
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation-name: confetti-fall;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
};

// Small helper inline component
function PercentIcon({ size, className }: { size: number, className?: string }) {
  return (
    <span className={`font-extrabold text-xs inline-block text-center ${className}`} style={{ width: size, height: size }}>
      %
    </span>
  );
}
