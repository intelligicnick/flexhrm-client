export function getAuditLogDateLabel(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatAuditLogTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function groupAuditLogsByDate(logs: Array<{ timestamp?: string }>): Array<{
  label: string;
  logs: typeof logs;
}> {
  const groups = new Map<string, typeof logs>();
  for (const log of logs) {
    const label = getAuditLogDateLabel(log.timestamp || "");
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(log);
  }
  return Array.from(groups.entries()).map(([label, groupLogs]) => ({ label, logs: groupLogs }));
}

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  P: "Present",
  A: "Absent",
  HD: "Half Day",
  WO: "Weekly Off",
  H: "Holiday",
  L: "Leave",
  CO: "Comp Off",
  OD: "On Duty",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "(none)";
    return value.map((item) => formatValue(item)).join(", ");
  }
  return JSON.stringify(value);
}

function summarizeStatusBreakdown(breakdown: Record<string, number>): string[] {
  return Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => {
      const label = ATTENDANCE_STATUS_LABELS[status] || status;
      return `${label} (${status}): ${count} cell(s)`;
    });
}

export function formatAuditLogDetails(action: string, details: unknown): string[] {
  if (!details || (isPlainObject(details) && Object.keys(details).length === 0)) {
    return ["No additional forensic payload was captured for this event."];
  }

  if (!isPlainObject(details)) {
    return [formatValue(details)];
  }

  const lines: string[] = [];

  if (typeof details.summary === "string" && details.summary.trim()) {
    lines.push(details.summary.trim());
    lines.push("");
  }

  switch (action) {
    case "BULK_MARK_ATTENDANCE": {
      if (details.cellsMarked !== undefined) {
        lines.push(`Total day-cells updated: ${formatValue(details.cellsMarked)}`);
      }
      if (details.employeesAffected !== undefined) {
        lines.push(`Employees affected: ${formatValue(details.employeesAffected)}`);
      }
      if (Array.isArray(details.months) && details.months.length) {
        lines.push(`Payroll months: ${details.months.join(", ")}`);
      }
      if (Array.isArray(details.locations) && details.locations.length) {
        lines.push(`Work locations: ${details.locations.join(", ")}`);
      }
      if (isPlainObject(details.statusBreakdown)) {
        lines.push("Attendance status breakdown:");
        summarizeStatusBreakdown(details.statusBreakdown as Record<string, number>).forEach((line) =>
          lines.push(`  • ${line}`)
        );
      }
      break;
    }

    case "UPDATE_EMPLOYEE": {
      if (Array.isArray(details.changedFields) && details.changedFields.length) {
        lines.push("Fields modified:");
        details.changedFields.forEach((field) => lines.push(`  • ${String(field)}`));
      }
      if (details.employeeCode) {
        lines.push(`Employee code: ${formatValue(details.employeeCode)}`);
      }
      if (details.employeeName) {
        lines.push(`Employee name: ${formatValue(details.employeeName)}`);
      }
      if (details.location) {
        lines.push(`Assigned location: ${formatValue(details.location)}`);
      }
      if (details.role) {
        lines.push(`Job role: ${formatValue(details.role)}`);
      }
      break;
    }

    case "DELETE_EMPLOYEES": {
      if (details.count !== undefined) {
        lines.push(`Records permanently removed: ${formatValue(details.count)}`);
      }
      if (Array.isArray(details.deletedEmployees) && details.deletedEmployees.length) {
        lines.push("Deleted employee profiles:");
        details.deletedEmployees.forEach((emp) => {
          if (!isPlainObject(emp)) return;
          const name =
            String(emp.nameAsPerAadhar || emp.name || emp.nameAsPerBank || "").trim() ||
            "Name not recorded";
          const code = emp.employeeCode || emp.id || "Unknown code";
          const location = emp.location ? ` | Location: ${emp.location}` : "";
          const role = emp.role ? ` | Role: ${emp.role}` : "";
          lines.push(`  • ${name} (${code})${location}${role}`);
        });
      }
      break;
    }

    case "ADD_EMPLOYEE": {
      lines.push(`Employee code: ${formatValue(details.employeeCode)}`);
      lines.push(`Name: ${formatValue(details.nameAsPerAadhar || details.name)}`);
      if (details.location) lines.push(`Location: ${formatValue(details.location)}`);
      if (details.role) lines.push(`Role: ${formatValue(details.role)}`);
      if (details.dateOfJoining) lines.push(`Date of joining: ${formatValue(details.dateOfJoining)}`);
      break;
    }

    case "STORE_AXIS_BULKPAY": {
      if (details.filename) lines.push(`Archived file: ${formatValue(details.filename)}`);
      if (details.month && details.year) {
        lines.push(`Payroll period: ${formatValue(details.month)} ${formatValue(details.year)}`);
      }
      if (details.recordCount !== undefined) {
        lines.push(`Payment rows in file: ${formatValue(details.recordCount)}`);
      }
      if (details.totalAmount !== undefined) {
        lines.push(`Total disbursement amount: ₹${Number(details.totalAmount).toLocaleString("en-IN")}`);
      }
      if (details.exportId) lines.push(`Archive reference ID: ${formatValue(details.exportId)}`);
      break;
    }

    case "FLUSH_AUDIT_LOGS": {
      if (details.purgedCount !== undefined) {
        lines.push(`Audit records permanently deleted: ${formatValue(details.purgedCount)}`);
      }
      if (details.performedBy) {
        lines.push(`Authorized by super-admin: ${formatValue(details.performedBy)}`);
      }
      lines.push(
        "Impact: All prior login, payroll, attendance, and employee-change history was erased and cannot be recovered."
      );
      break;
    }

    case "UPDATE_PAYROLL_LEDGER": {
      if (details.count !== undefined) {
        lines.push(`Employees with ledger changes: ${formatValue(details.count)}`);
      }
      if (Array.isArray(details.updates) && details.updates.length) {
        lines.push("Ledger adjustments captured in payload (advance, penalty, perks, uniform, etc.).");
      }
      break;
    }

    case "LOGIN_SUCCESS":
    case "LOGIN_FAILURE":
    case "LOGIN_RESTRICTED": {
      if (details.ip) lines.push(`Source IP: ${formatValue(details.ip)}`);
      if (details.userAgent) lines.push(`Browser / device: ${formatValue(details.userAgent)}`);
      if (details.reason) lines.push(`Reason: ${formatValue(details.reason)}`);
      if (action === "LOGIN_SUCCESS") lines.push("Outcome: Session established successfully.");
      if (action === "LOGIN_FAILURE") lines.push("Outcome: Authentication rejected — no session created.");
      if (action === "LOGIN_RESTRICTED") lines.push("Outcome: Account lacks permission for requested module.");
      break;
    }

    case "LOGOUT": {
      if (details.sessionDuration) lines.push(`Session duration: ${formatValue(details.sessionDuration)}`);
      lines.push("Outcome: Active session terminated.");
      break;
    }

    case "INVITE_ADMIN": {
      if (details.invitedUsername) lines.push(`New admin username: ${formatValue(details.invitedUsername)}`);
      if (details.role) lines.push(`Assigned role: ${formatValue(details.role)}`);
      if (details.permissions) lines.push(`Permissions granted: ${formatValue(details.permissions)}`);
      break;
    }

    case "DELETE_ADMIN": {
      if (details.deletedUsername) lines.push(`Removed admin: ${formatValue(details.deletedUsername)}`);
      if (details.previousRole) lines.push(`Previous role: ${formatValue(details.previousRole)}`);
      break;
    }

    case "UPDATE_ADMIN_SECURITY":
    case "UPDATE_ADMIN_PROFILE":
    case "CHANGE_PASSWORD": {
      if (Array.isArray(details.changedFields) && details.changedFields.length) {
        lines.push("Fields modified:");
        details.changedFields.forEach((field) => lines.push(`  • ${String(field)}`));
      }
      if (details.targetAdmin) lines.push(`Affected admin: ${formatValue(details.targetAdmin)}`);
      break;
    }

    case "BULK_IMPORT_EMPLOYEES":
    case "BULK_UPDATE_EMPLOYEES": {
      if (details.importedCount !== undefined) lines.push(`Records imported: ${formatValue(details.importedCount)}`);
      if (details.updatedCount !== undefined) lines.push(`Records updated: ${formatValue(details.updatedCount)}`);
      if (details.skippedCount !== undefined) lines.push(`Records skipped: ${formatValue(details.skippedCount)}`);
      if (details.failedCount !== undefined) lines.push(`Records failed: ${formatValue(details.failedCount)}`);
      if (details.location) lines.push(`Target location: ${formatValue(details.location)}`);
      if (details.filename) lines.push(`Source file: ${formatValue(details.filename)}`);
      break;
    }

    case "SUBMIT_EMPLOYEE_CHANGES":
    case "APPROVE_EMPLOYEE_CHANGES":
    case "REJECT_EMPLOYEE_CHANGES": {
      if (details.employeeCode) lines.push(`Employee code: ${formatValue(details.employeeCode)}`);
      if (details.employeeName) lines.push(`Employee name: ${formatValue(details.employeeName)}`);
      if (Array.isArray(details.changedFields) && details.changedFields.length) {
        lines.push("Pending / reviewed fields:");
        details.changedFields.forEach((field) => lines.push(`  • ${String(field)}`));
      }
      if (details.rejectionReason) lines.push(`Rejection reason: ${formatValue(details.rejectionReason)}`);
      break;
    }

    case "UPLOAD_EMPLOYEE_DOCUMENT":
    case "UPLOAD_EMPLOYEE_DOCUMENTS_BULK":
    case "REPLACE_EMPLOYEE_DOCUMENT":
    case "DELETE_EMPLOYEE_DOCUMENT": {
      if (details.employeeCode) lines.push(`Employee code: ${formatValue(details.employeeCode)}`);
      if (details.documentType) lines.push(`Document type: ${formatValue(details.documentType)}`);
      if (details.filename) lines.push(`File name: ${formatValue(details.filename)}`);
      if (details.count !== undefined) lines.push(`Documents affected: ${formatValue(details.count)}`);
      break;
    }

    case "MARK_EMPLOYEE_EXIT": {
      if (details.employeeCode) lines.push(`Employee code: ${formatValue(details.employeeCode)}`);
      if (details.employeeName) lines.push(`Employee name: ${formatValue(details.employeeName)}`);
      if (details.exitDate) lines.push(`Exit date: ${formatValue(details.exitDate)}`);
      if (details.reason) lines.push(`Exit reason: ${formatValue(details.reason)}`);
      break;
    }

    case "EXPORT_AUDIT_PDF":
    case "EXPORT_AUDIT_EXCEL":
    case "DOWNLOAD_ATTENDANCE_CSV":
    case "DOWNLOAD_ATTENDANCE_PDF":
    case "DOWNLOAD_REPORT_CSV":
    case "DOWNLOAD_REPORT_EXCEL":
    case "DOWNLOAD_REPORT_PDF":
    case "DOWNLOAD_SALARY_CSV":
    case "DOWNLOAD_SALARY_EXCEL":
    case "DOWNLOAD_SALARY_PDF":
    case "EXPORT_AXIS_BULKPAY":
    case "EXPORT_REGISTRY_CSV":
    case "EXPORT_REGISTRY_EXCEL":
    case "EXPORT_REGISTRY_PDF":
    case "DOWNLOAD_TEMPLATE": {
      if (details.format) lines.push(`Export format: ${formatValue(details.format)}`);
      if (details.recordCount !== undefined) lines.push(`Records exported: ${formatValue(details.recordCount)}`);
      if (details.month) lines.push(`Payroll month: ${formatValue(details.month)}`);
      if (details.location) lines.push(`Location filter: ${formatValue(details.location)}`);
      if (Array.isArray(details.columns) && details.columns.length) {
        lines.push(`Columns included: ${details.columns.join(", ")}`);
      }
      if (Array.isArray(details.employeeIds) && details.employeeIds.length) {
        lines.push(`Employee IDs in export: ${details.employeeIds.length} record(s)`);
      }
      break;
    }

    case "SAVE_ROLE_MATRIX":
    case "DELETE_ROLE": {
      if (details.roleName) lines.push(`Role: ${formatValue(details.roleName)}`);
      if (details.roleId) lines.push(`Role ID: ${formatValue(details.roleId)}`);
      if (details.permissionCount !== undefined) {
        lines.push(`Permissions configured: ${formatValue(details.permissionCount)}`);
      }
      break;
    }

    case "RENAME_LOCATION":
    case "DELETE_LOCATIONS":
    case "RENAME_ROLE":
    case "DELETE_ROLES": {
      if (details.oldName) lines.push(`Previous name: ${formatValue(details.oldName)}`);
      if (details.newName) lines.push(`New name: ${formatValue(details.newName)}`);
      if (details.count !== undefined) lines.push(`Items affected: ${formatValue(details.count)}`);
      if (Array.isArray(details.names) && details.names.length) {
        lines.push(`Affected entries: ${details.names.join(", ")}`);
      }
      break;
    }

    case "ADD_SCHOOL_WORK":
    case "UPDATE_SCHOOL_WORK":
    case "DELETE_SCHOOL_WORKS":
    case "BULK_IMPORT_SCHOOL_WORKS":
    case "DISTRIBUTE_BLOCK_SCHOOL_EXPENSE": {
      if (details.schoolName) lines.push(`School: ${formatValue(details.schoolName)}`);
      if (details.blockName) lines.push(`Block: ${formatValue(details.blockName)}`);
      if (details.amount !== undefined) {
        lines.push(`Amount: ₹${Number(details.amount).toLocaleString("en-IN")}`);
      }
      if (details.count !== undefined) lines.push(`Records affected: ${formatValue(details.count)}`);
      break;
    }

    case "DELETE_AXIS_BULKPAY_ARCHIVE": {
      if (details.exportId) lines.push(`Archive reference ID: ${formatValue(details.exportId)}`);
      if (details.filename) lines.push(`Deleted file: ${formatValue(details.filename)}`);
      if (details.month && details.year) {
        lines.push(`Payroll period: ${formatValue(details.month)} ${formatValue(details.year)}`);
      }
      break;
    }

    case "PASSWORD_RESET_REQUEST":
    case "PASSWORD_RESET_COMPLETE": {
      if (details.email) lines.push(`Account email: ${formatValue(details.email)}`);
      if (details.username) lines.push(`Username: ${formatValue(details.username)}`);
      lines.push(
        action === "PASSWORD_RESET_REQUEST"
          ? "A password reset link was requested for this account."
          : "Password was successfully reset and the account can sign in again."
      );
      break;
    }

    default: {
      Object.entries(details).forEach(([key, value]) => {
        if (key === "summary" || key === "previous" || key === "updated") return;
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (char) => char.toUpperCase())
          .trim();
        lines.push(`${label}: ${formatValue(value)}`);
      });
      break;
    }
  }

  if (lines.length === 0) {
    Object.entries(details).forEach(([key, value]) => {
      if (key === "previous" || key === "updated") return;
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (char) => char.toUpperCase())
        .trim();
      lines.push(`${label}: ${formatValue(value)}`);
    });
  }

  return lines.length ? lines : ["No additional forensic payload was captured for this event."];
}
