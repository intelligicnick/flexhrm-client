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

export const getModuleKey = (tabName: string): string => {
  switch (tabName) {
    case "Admin": return "admin";
    case "Audit Logs": return "admin";
    case "Employees": return "employees";
    case "School Work":
    case "School Salary":
    case "Expenses":
      return "schoolWork";
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

export const PERMISSION_MODULES = [
  "employees", "schoolWork", "salary", "ledger", "attendance", "leave", "birthdays", "directory", "admin",
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
    includes: "School roster, School Salary tab, Expenses tab, monthly expense blocks",
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
    key: "admin",
    name: "Administration",
    includes:
      "Admin panel, invite/configure admins, custom roles, audit logs, approve bulk edit requests",
  },
];

export function createEmptyRolePermissions(): Record<PermissionModuleKey, { view: boolean; edit: boolean }> {
  return Object.fromEntries(
    PERMISSION_MODULES.map((key) => [key, { view: false, edit: false }]),
  ) as Record<PermissionModuleKey, { view: boolean; edit: boolean }>;
}

export const DEFAULT_NEW_ROLE_PERMISSIONS: Record<PermissionModuleKey, { view: boolean; edit: boolean }> = {
  employees: { view: true, edit: true },
  schoolWork: { view: true, edit: true },
  salary: { view: false, edit: false },
  ledger: { view: false, edit: false },
  attendance: { view: true, edit: true },
  leave: { view: true, edit: true },
  birthdays: { view: true, edit: false },
  directory: { view: true, edit: false },
  admin: { view: false, edit: false },
};
