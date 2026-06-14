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

export const TAB_TO_PATH: Record<string, string> = {
  "Employees": "/employees",
  "Admin": "/admin",
  "Audit Logs": "/audit-logs",
  "Salary": "/salary",
  "Saved Bulk Pay": "/saved-bulk-pay",
  "Advance & Penalty": "/advance-penalty",
  "Leave": "/leave",
  "Attendance": "/attendance",
  "Directory": "/directory",
  "Birthdays": "/birthdays",
  "Schools": "/schools",
  "Monthly Billing": "/monthly-billing",
  "Expenses": "/expenses",
  "Field Team": "/field-team",
  "Saved School Bulk Pay": "/saved-school-bulk-pay",
  "My Info": "/my-info",
};

export const PATH_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, p]) => [p, tab])
);

export const DEFAULT_PATH = "/employees";

export function tabToPath(tab: string): string {
  return TAB_TO_PATH[tab] ?? DEFAULT_PATH;
}

const LEGACY_PATH_TO_TAB: Record<string, string> = {
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
};

export function pathToTab(pathname: string): string {
  return LEGACY_PATH_TO_TAB[pathname] ?? PATH_TO_TAB[pathname] ?? "Employees";
}

export const APP_ROUTES = [
  { path: "/employees", tab: "Employees" },
  { path: "/admin", tab: "Admin" },
  { path: "/audit-logs", tab: "Audit Logs" },
  { path: "/salary", tab: "Salary" },
  { path: "/saved-bulk-pay", tab: "Saved Bulk Pay" },
  { path: "/advance-penalty", tab: "Advance & Penalty" },
  { path: "/leave", tab: "Leave" },
  { path: "/attendance", tab: "Attendance" },
  { path: "/directory", tab: "Directory" },
  { path: "/birthdays", tab: "Birthdays" },
  { path: "/schools", tab: "Schools" },
  { path: "/monthly-billing", tab: "Monthly Billing" },
  { path: "/saved-school-bulk-pay", tab: "Saved School Bulk Pay" },
  { path: "/expenses", tab: "Expenses" },
  { path: "/field-team", tab: "Field Team" },
  { path: "/my-info", tab: "My Info" },
] as const;
