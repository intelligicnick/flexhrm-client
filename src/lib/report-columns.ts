import { EXCEL_ROW_HEADERS } from "../types";

export const REPORT_COLUMN_GROUPS = [
  {
    name: "Workplace & Metadata",
    color: "bg-blue-50 text-blue-800 border-blue-100",
    headers: [
      "SR NO",
      "Employees Code **",
      "Location",
      "Skill Category",
      "Job Role",
      "Working Days Cycle",
      "Daily Wage",
    ],
  },
  {
    name: "Primary Demographics",
    color: "bg-purple-50 text-purple-800 border-purple-100",
    headers: [
      "EMPLOYEE NAME AS PER AADHAR ***",
      "GENDER **",
      "DATE OF BIRTH",
      "MARITAL STATUS **",
      "AADHAR LINK MOB.NO. **",
      "Employee Mobile",
    ],
  },
  {
    name: "Payroll & Statutory",
    color: "bg-emerald-50 text-emerald-800 border-emerald-100",
    headers: ["Gross Salary***", "Basic Salary***", "ESIC", "UAN", "PF JOINING DATE"],
  },
  {
    name: "Identity & Tax",
    color: "bg-indigo-50 text-indigo-800 border-indigo-100",
    headers: [
      "AADHAR NO **",
      "NAME AS PER AADHAR **",
      "PAN NO",
      "NAME AS PER PAN",
      "Present Address**",
      "Permanent Address**",
    ],
  },
  {
    name: "Bank Details",
    color: "bg-amber-50 text-amber-800 border-amber-100",
    headers: ["BANK ACCOUNT NO **", "IFSC CODE **", "EMPLOYEE NAME AS PER BANK **"],
  },
  {
    name: "Family & Nominee",
    color: "bg-rose-50 text-rose-800 border-rose-100",
    headers: [
      "FATHER **",
      "HUSBAND NAME **",
      "PREVIOUS UAN NO",
      "PREVIOUS ESIC NO***",
      "Nominee Name (ESIC)",
      "Nominee DOB",
      "Nominee Relation",
      "Nominee Mobile",
      "Family Member Name (1)",
      "Family Member DOB (1)",
      "Family Member Relation (1)",
      "Family Member Mobile (1)",
      "Family Member Name (2)",
      "Family Member DOB (2)",
      "Family Member Relation (2)",
      "Family Member Mobile (2)",
      "Family Member Name (3)",
      "Family Member DOB (3)",
      "Family Member Relation (3)",
      "Family Member Mobile (3)",
    ],
  },
] as const;

export const SKILL_FILTER_OPTIONS = ["Highly Skilled", "Skilled", "Semi Skilled", "Unskilled"] as const;

export function formatReportColumnLabel(header: string): string {
  return header.replace(/[\*\s]+/g, " ").trim();
}

export { EXCEL_ROW_HEADERS };
