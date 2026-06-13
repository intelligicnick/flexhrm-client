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
  "School Salary": "/school-salary",
  "Expenses": "/school-expenses",
  "My Info": "/my-info",
};

export const PATH_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, p]) => [p, tab])
);

export const DEFAULT_PATH = "/employees";

export function tabToPath(tab: string): string {
  return TAB_TO_PATH[tab] ?? DEFAULT_PATH;
}

export function pathToTab(pathname: string): string {
  return PATH_TO_TAB[pathname] ?? "Employees";
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
  { path: "/school-salary", tab: "School Salary" },
  { path: "/school-expenses", tab: "Expenses" },
  { path: "/my-info", tab: "My Info" },
] as const;
