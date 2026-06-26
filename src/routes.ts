export const SCHOOL_WORK_TABS = [
  "Schools",
  "Monthly Billing",
  "Saved School Bulk Pay",
  "Expenses",
  "Field Team",
] as const;

export type SchoolWorkTab = (typeof SCHOOL_WORK_TABS)[number];

export function isSchoolWorkTab(tab: string): tab is SchoolWorkTab {
  return (SCHOOL_WORK_TABS as readonly string[]).includes(tab);
}

export const BIDS_TABS = ["Tenders", "Contracts"] as const;

export type BidsTab = (typeof BIDS_TABS)[number];

export function isBidsTab(tab: string): tab is BidsTab {
  return (BIDS_TABS as readonly string[]).includes(tab);
}

export const RENEWALS_TABS = ["Car Papers", "IT Renewals", "Licenses"] as const;

export type RenewalsTab = (typeof RENEWALS_TABS)[number];

export function isRenewalsTab(tab: string): tab is RenewalsTab {
  return (RENEWALS_TABS as readonly string[]).includes(tab);
}

export const BG_DD_TAB = "BG & DD" as const;

export type BgDdTab = typeof BG_DD_TAB;

export function isBgDdTab(tab: string): tab is BgDdTab {
  return tab === BG_DD_TAB;
}

export const MONITOR_TAB = "Monitor" as const;

export type MonitorTab = typeof MONITOR_TAB;

export function isMonitorTab(tab: string): tab is MonitorTab {
  return tab === MONITOR_TAB;
}

export const TAB_TO_PATH: Record<string, string> = {
  "Dashboard": "/dashboard",
  "Employees": "/employees",
  "Role & Access": "/admin",
  "Salary": "/salary",
  "Saved Bulk Pay": "/saved-bulk-pay",
  "Advance & Penalty": "/advance-penalty",
  "Leave": "/leave",
  "Attendance": "/attendance",
  "Shifts": "/shifts",
  "Company Settings": "/company-settings",
  "Enterprise": "/enterprise",
  "Directory": "/directory",
  "Birthdays": "/birthdays",
  "Schools": "/schools",
  "Monthly Billing": "/monthly-billing",
  "Expenses": "/expenses",
  "Field Team": "/field-team",
  "Saved School Bulk Pay": "/saved-school-bulk-pay",
  "Tenders": "/tenders",
  "Contracts": "/contracts",
  "Car Papers": "/renewals/car-papers",
  "IT Renewals": "/renewals/it-renewals",
  "Licenses": "/renewals/licenses",
  "BG & DD": "/bg-dd",
  "Monitor": "/monitor",
  "My Info": "/my-info",
};

export const PATH_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, p]) => [p, tab])
);

export const DEFAULT_PATH = "/dashboard";

export const LOGIN_PATH = "/hrmlogin";
export const REGISTER_PATH = "/register";
export const PLATFORM_LOGIN_PATH = "/platform/login";
export const PLATFORM_DASHBOARD_PATH = "/platform/dashboard";

export function tabToPath(tab: string): string {
  return TAB_TO_PATH[tab] ?? DEFAULT_PATH;
}

const LEGACY_PATH_TO_TAB: Record<string, string> = {
  "/audit-logs": "Role & Access",
  "/all-schools": "Schools",
  "/all-partners": "Monthly Billing",
  "/monthly-invoice": "Monthly Billing",
  "/monthly-partner-payments": "Monthly Billing",
  "/all-expenses": "Expenses",
  "/material-misc-expenses": "Expenses",
  "/material-expenses": "Expenses",
  "/miscellaneous-expense": "Expenses",
  "/visits": "Field Team",
  "/supervisors": "Field Team",
  "/school-configuration": "Employees",
  "/filed-bids": "Tenders",
};

export function pathToTab(pathname: string): string {
  return LEGACY_PATH_TO_TAB[pathname] ?? PATH_TO_TAB[pathname] ?? "Dashboard";
}

export const APP_ROUTES = [
  { path: "/dashboard", tab: "Dashboard" },
  { path: "/employees", tab: "Employees" },
  { path: "/admin", tab: "Role & Access" },
  { path: "/audit-logs", tab: "Role & Access" },
  { path: "/salary", tab: "Salary" },
  { path: "/saved-bulk-pay", tab: "Saved Bulk Pay" },
  { path: "/advance-penalty", tab: "Advance & Penalty" },
  { path: "/leave", tab: "Leave" },
  { path: "/attendance", tab: "Attendance" },
  { path: "/shifts", tab: "Shifts" },
  { path: "/company-settings", tab: "Company Settings" },
  { path: "/enterprise", tab: "Enterprise" },
  { path: "/directory", tab: "Directory" },
  { path: "/birthdays", tab: "Birthdays" },
  { path: "/schools", tab: "Schools" },
  { path: "/monthly-billing", tab: "Monthly Billing" },
  { path: "/saved-school-bulk-pay", tab: "Saved School Bulk Pay" },
  { path: "/expenses", tab: "Expenses" },
  { path: "/field-team", tab: "Field Team" },
  { path: "/tenders", tab: "Tenders" },
  { path: "/contracts", tab: "Contracts" },
  { path: "/renewals/car-papers", tab: "Car Papers" },
  { path: "/renewals/it-renewals", tab: "IT Renewals" },
  { path: "/renewals/licenses", tab: "Licenses" },
  { path: "/bg-dd", tab: "BG & DD" },
  { path: "/monitor", tab: "Monitor" },
  { path: "/my-info", tab: "My Info" },
] as const;
