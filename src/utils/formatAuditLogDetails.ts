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
