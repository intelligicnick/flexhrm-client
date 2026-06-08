import React from "react";

export interface SidebarItemDef {
  name: string;
  icon: React.ComponentType<any>;
  badge: string;
}

export const getModuleKey = (tabName: string): string => {
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

export const PERMISSION_MODULES = [
  "employees", "salary", "ledger", "attendance", "leave", "birthdays", "directory", "admin",
] as const;
