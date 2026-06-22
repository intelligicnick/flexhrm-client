import type { PermissionModuleKey } from "./permissions";

export interface ModuleUiRestrictions {
  /** Whitelist of filter keys. Empty/undefined = all filters visible. */
  allowedFilters?: string[];
  /** Whitelist of column names. Empty/undefined = all columns visible. */
  allowedColumns?: string[];
  /** Preset filter values the role cannot change. */
  lockedFilterValues?: Record<string, string | string[]>;
  /** Hide the column picker / template configuration panel. */
  hideColumnPicker?: boolean;
}

export type RoleUiRestrictions = Partial<Record<PermissionModuleKey, ModuleUiRestrictions>>;

export const SALARY_COLUMNS = [
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
  "Payment Status",
] as const;

export type SalaryColumn = (typeof SALARY_COLUMNS)[number];

export const SALARY_FILTER_DEFINITIONS = [
  { key: "month", label: "Month" },
  { key: "filterType", label: "Balance Type" },
  { key: "search", label: "Search Employee" },
  { key: "location", label: "Branch / Location" },
  { key: "joinDate", label: "PF Joining Date" },
  { key: "exitDate", label: "Exit / Leaving Date" },
  { key: "grossSalary", label: "Monthly Gross Salary" },
  { key: "dailyWage", label: "Daily Wage" },
  { key: "gender", label: "Gender" },
  { key: "marital", label: "Marital Status" },
  { key: "esic", label: "ESIC Status" },
  { key: "skills", label: "Skill Categories" },
  { key: "roles", label: "Job Roles" },
  { key: "paymentStatus", label: "Payment Status" },
] as const;

export type SalaryFilterKey = (typeof SALARY_FILTER_DEFINITIONS)[number]["key"];

export const EMPLOYEE_FILTER_DEFINITIONS = [
  { key: "search", label: "Search" },
  { key: "role", label: "Job Role" },
  { key: "status", label: "Employment Status" },
  { key: "location", label: "Location" },
] as const;

export const OBSERVER_SALARY_PRESET: ModuleUiRestrictions = {
  allowedFilters: ["month", "search", "location"],
  allowedColumns: [
    "Employee Code",
    "Employee Name",
    "Job Role",
    "Present Days",
    "Net Payable",
    "Payment Status",
  ],
  hideColumnPicker: true,
};

export function createEmptyRoleUiRestrictions(): RoleUiRestrictions {
  return {};
}

export function getModuleUiRestrictions(
  restrictions: RoleUiRestrictions | null | undefined,
  module: PermissionModuleKey,
): ModuleUiRestrictions | undefined {
  return restrictions?.[module];
}

export function isFilterVisible(
  moduleRestrictions: ModuleUiRestrictions | undefined,
  filterKey: string,
): boolean {
  const allowed = moduleRestrictions?.allowedFilters;
  if (!allowed?.length) return true;
  return allowed.includes(filterKey);
}

export function isColumnAllowed(
  moduleRestrictions: ModuleUiRestrictions | undefined,
  column: string,
): boolean {
  const allowed = moduleRestrictions?.allowedColumns;
  if (!allowed?.length) return true;
  return allowed.includes(column);
}

export function isFilterLocked(
  moduleRestrictions: ModuleUiRestrictions | undefined,
  filterKey: string,
): boolean {
  return moduleRestrictions?.lockedFilterValues?.[filterKey] !== undefined;
}

export function getLockedFilterValue(
  moduleRestrictions: ModuleUiRestrictions | undefined,
  filterKey: string,
): string | string[] | undefined {
  return moduleRestrictions?.lockedFilterValues?.[filterKey];
}

export function applySalaryUiRestrictions(
  restrictions: ModuleUiRestrictions | undefined,
  handlers: {
    setSelectedSalaryColumns: (cols: string[]) => void;
    setSalaryLocationFilter: (v: string) => void;
    setSalarySearchQuery: (v: string) => void;
    setSalaryFilterType: (v: "all" | "advances" | "penalties" | "perks") => void;
    setSalaryJoinStartFilter: (v: string) => void;
    setSalaryJoinEndFilter: (v: string) => void;
    setSalaryExitStartFilter: (v: string) => void;
    setSalaryExitEndFilter: (v: string) => void;
    setSalaryMinSalaryFilter: (v: string) => void;
    setSalaryMaxSalaryFilter: (v: string) => void;
    setSalaryMinDailyWageFilter: (v: string) => void;
    setSalaryMaxDailyWageFilter: (v: string) => void;
    setSalaryGenderFilter: (v: string) => void;
    setSalaryMaritalFilter: (v: string) => void;
    setSalaryEsicFilter: (v: string) => void;
    setSalarySkillFilters: (v: string[]) => void;
    setSalaryRoleFilters: (v: string[]) => void;
    setSalaryPaymentStatusFilter: (v: "All" | "Unpaid" | "Paid" | "Hold") => void;
  },
): void {
  if (!restrictions) return;

  if (restrictions.allowedColumns?.length) {
    handlers.setSelectedSalaryColumns(
      restrictions.allowedColumns.filter((col) =>
        (SALARY_COLUMNS as readonly string[]).includes(col),
      ),
    );
  }

  const locked = restrictions.lockedFilterValues;
  if (!locked) return;

  if (typeof locked.location === "string") handlers.setSalaryLocationFilter(locked.location);
  if (typeof locked.search === "string") handlers.setSalarySearchQuery(locked.search);
  if (typeof locked.filterType === "string") {
    const t = locked.filterType;
    if (t === "all" || t === "advances" || t === "penalties" || t === "perks") {
      handlers.setSalaryFilterType(t);
    }
  }
  if (typeof locked.gender === "string") handlers.setSalaryGenderFilter(locked.gender);
  if (typeof locked.marital === "string") handlers.setSalaryMaritalFilter(locked.marital);
  if (typeof locked.esic === "string") handlers.setSalaryEsicFilter(locked.esic);
  if (typeof locked.paymentStatus === "string") {
    const ps = locked.paymentStatus;
    if (ps === "All" || ps === "Unpaid" || ps === "Paid" || ps === "Hold") {
      handlers.setSalaryPaymentStatusFilter(ps);
    }
  }
  if (Array.isArray(locked.skills)) handlers.setSalarySkillFilters(locked.skills);
  if (Array.isArray(locked.roles)) handlers.setSalaryRoleFilters(locked.roles);
}
