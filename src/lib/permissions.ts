import React from "react";

export interface SidebarChildItemDef {
  name: string;
  tab: string;
}

export interface SidebarItemDef {
  name: string;
  icon: React.ComponentType<any>;
  badge: string;
  children?: SidebarChildItemDef[];
}

export type UserPermissionsMap = Record<
  string,
  { view: boolean; edit: boolean; delete: boolean }
> | null;

export function canViewModule(userPermissions: UserPermissionsMap, tabName: string): boolean {
  const key = getModuleKey(tabName);
  if (!key) return true;
  return !!userPermissions?.[key]?.view;
}

export function canEditModule(userPermissions: UserPermissionsMap, tabName: string): boolean {
  const key = getModuleKey(tabName);
  if (!key) return false;
  return !!userPermissions?.[key]?.edit;
}

export const getModuleKey = (tabName: string): string => {
  switch (tabName) {
    case "Dashboard":
      return "";
    case "Admin":
    case "Role & Access":
    case "Audit Logs":
      return "admin";
    case "Employees": return "employees";
    case "School Work":
    case "Schools":
    case "Monthly Billing":
    case "Expenses":
    case "Field Team":
    case "Saved School Bulk Pay":
      return "schoolWork";
    case "Bids":
    case "Tenders":
    case "Contracts":
      return "bids";
    case "Renewals":
    case "Car Papers":
    case "IT Renewals":
    case "Licenses":
      return "renewals";
    case "BG & DD":
      return "bids";
    case "Monitor":
      return "monitor";
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

export const isAdminModuleTab = (tabName: string): boolean =>
  getModuleKey(tabName) === "admin";

export const PERMISSION_MODULES = [
  "employees", "schoolWork", "bids", "renewals", "salary", "ledger", "attendance", "leave", "birthdays", "directory", "monitor", "admin",
] as const;

export type PermissionModuleKey = (typeof PERMISSION_MODULES)[number];

export interface RolePermissionModuleRow {
  key: PermissionModuleKey;
  name: string;
  includes: string;
}

/** Labels and sub-feature coverage for the Admin → Roles permission matrix. */
export const ROLE_PERMISSION_MODULE_ROWS: RolePermissionModuleRow[] = [
  {
    key: "employees",
    name: "Employees",
    includes:
      "Roster, add/edit/delete, bulk CSV import, photos, ID cards, document upload (edit form), bulk edit requests",
  },
  {
    key: "schoolWork",
    name: "School Work",
    includes: "School registry, monthly billing, partner bulk pay, expenses, and field team (supervisors & visits)",
  },
  {
    key: "bids",
    name: "Bids",
    includes: "Tenders, contracts, and BG & DD tracking",
  },
  {
    key: "renewals",
    name: "Renewals",
    includes: "Car papers, IT renewals (domains & servers), and licenses",
  },
  {
    key: "attendance",
    name: "Attendance",
    includes: "Monthly attendance grids, bulk mark wizard, CSV import",
  },
  {
    key: "salary",
    name: "Salary",
    includes: "Salary sheet, export templates, Saved Bulk Pay files",
  },
  {
    key: "ledger",
    name: "Advance & Penalty",
    includes: "Advance & penalty ledger, batch settlement",
  },
  {
    key: "leave",
    name: "Leave",
    includes: "Leave requests and approvals",
  },
  {
    key: "birthdays",
    name: "Birthdays",
    includes: "Birthday calendar and reminders",
  },
  {
    key: "directory",
    name: "Directory",
    includes: "Employee directory contacts",
  },
  {
    key: "monitor",
    name: "Employee Monitor",
    includes: "Desktop agent monitoring, live activity, screenshots, productivity analytics, and alerts",
  },
  {
    key: "admin",
    name: "Role & Access",
    includes:
      "Admin accounts, custom roles, activity log, device rules, approve bulk edit requests",
  },
];

export function createEmptyRolePermissions(): Record<
  PermissionModuleKey,
  { view: boolean; edit: boolean; delete: boolean }
> {
  return Object.fromEntries(
    PERMISSION_MODULES.map((key) => [key, { view: false, edit: false, delete: false }]),
  ) as Record<PermissionModuleKey, { view: boolean; edit: boolean; delete: boolean }>;
}

export function createFullRolePermission(
  values?: Partial<{ view: boolean; edit: boolean; delete: boolean }>,
): { view: boolean; edit: boolean; delete: boolean } {
  const deletePermission = values?.delete ?? !!values?.edit;
  const edit = !!values?.edit || !!deletePermission;
  const view = !!values?.view || edit;
  return {
    view,
    edit,
    delete: !!deletePermission,
  };
}

export const DEFAULT_NEW_ROLE_PERMISSIONS: Record<
  PermissionModuleKey,
  { view: boolean; edit: boolean; delete: boolean }
> = {
  employees: { view: true, edit: true, delete: true },
  schoolWork: { view: true, edit: true, delete: true },
  bids: { view: true, edit: true, delete: true },
  renewals: { view: true, edit: true, delete: true },
  salary: { view: false, edit: false, delete: false },
  ledger: { view: false, edit: false, delete: false },
  attendance: { view: true, edit: true, delete: true },
  leave: { view: true, edit: true, delete: true },
  birthdays: { view: true, edit: false, delete: false },
  directory: { view: true, edit: false, delete: false },
  monitor: { view: true, edit: true, delete: true },
  admin: { view: false, edit: false, delete: false },
};

/** View + edit (no delete) for modules surfaced in the Observer Admin mobile app. */
export const OBSERVER_ADMIN_ROLE_PERMISSIONS: Record<
  PermissionModuleKey,
  { view: boolean; edit: boolean; delete: boolean }
> = {
  employees: { view: true, edit: false, delete: false },
  schoolWork: { view: true, edit: true, delete: false },
  bids: { view: true, edit: true, delete: false },
  renewals: { view: true, edit: true, delete: false },
  salary: { view: true, edit: true, delete: false },
  ledger: { view: true, edit: false, delete: false },
  attendance: { view: true, edit: false, delete: false },
  leave: { view: false, edit: false, delete: false },
  birthdays: { view: true, edit: false, delete: false },
  directory: { view: true, edit: false, delete: false },
  monitor: { view: true, edit: false, delete: false },
  admin: { view: false, edit: false, delete: false },
};
