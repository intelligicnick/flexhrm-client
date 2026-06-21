export interface TourFormField {
  label: string;
  value?: string;
  type?: "text" | "select" | "date" | "password" | "checkbox";
  required?: boolean;
  highlight?: boolean;
  span?: 1 | 2;
}

export const EMPLOYEE_ADD_FORM: TourFormField[] = [
  { label: "Employee Code", value: "EMP-143", required: true, highlight: true },
  { label: "Location", value: "Mumbai HO", type: "select" },
  { label: "Job Role", value: "Accountant", type: "select" },
  { label: "Name as per Aadhar", value: "Priya Sharma", required: true },
  { label: "Gross Salary", value: "₹28,000", required: true },
  { label: "Basic Salary", value: "₹14,000", required: true },
  { label: "Bank Account No", value: "50100234567890", required: true },
  { label: "IFSC Code", value: "HDFC0001234", required: true },
  { label: "UAN", value: "100234567890" },
  { label: "Aadhar No", value: "1234 5678 9012", required: true },
  { label: "PF Joining Date", value: "2024-04-01", type: "date" },
  { label: "Exit / Leaving Date", value: "", type: "date" },
];

export const PAYROLL_CONFIG_FORM: TourFormField[] = [
  { label: "ESIC Eligibility Ceiling", value: "₹21,000", highlight: true },
  { label: "Basic Salary % of Gross", value: "50%" },
  { label: "Default PF Calculation", value: "Ceiling ₹15,000", type: "select" },
  { label: "Debit Account Name", value: "FlexHRM Payroll A/c", type: "select", highlight: true },
  { label: "Account Number", value: "50100987654321" },
  { label: "IFSC", value: "UTIB0000123" },
  { label: "Office Location", value: "Pune Branch", type: "select" },
  { label: "Job Role", value: "Supervisor", type: "select" },
];

export const ADMIN_INVITE_FORM: TourFormField[] = [
  { label: "Username", value: "hr.pune", required: true, highlight: true },
  { label: "Temporary Password", value: "••••••••", type: "password", required: true },
  { label: "Role", value: "HR Assistant", type: "select", highlight: true },
  { label: "Location Access", value: "☑ Pune Branch  ☐ Mumbai HO", type: "checkbox" },
];

export const LEDGER_ENTRY_FORM: TourFormField[] = [
  { label: "Entry Type", value: "Advance", type: "select", highlight: true },
  { label: "Amount (₹)", value: "5,000", required: true, highlight: true },
  { label: "Date", value: "2025-06-12", type: "date" },
  { label: "Notes", value: "Salary advance — June", span: 2 },
];

export const ATTENDANCE_CELL_FORM: TourFormField[] = [
  { label: "Employee", value: "EMP-001 · Priya Sharma", span: 2 },
  { label: "Date", value: "16 Jun 2025" },
  { label: "Mark As", value: "P — Present", type: "select", highlight: true },
];

export const SALARY_ROW_SAMPLE = {
  headers: ["Employee Code", "Name as per Aadhar", "Present Days", "Gross Pay", "PF", "ESIC", "Net Payable", "Payment Status"],
  rows: [
    ["EMP-001", "Priya Sharma", "18", "₹28,000", "₹1,800", "₹420", "₹24,100", "Unpaid ▾"],
    ["EMP-002", "Rahul Verma", "20", "₹22,500", "₹1,440", "₹338", "₹19,800", "Paid ▾"],
  ],
  highlightCells: [{ row: 0, col: 7 }],
};

export const EMPLOYEE_LIST_TABLE = {
  headers: ["Employee Code", "Name as per Aadhar", "Location", "Job Role", "Gross Salary", "ESIC"],
  rows: [
    ["EMP-001", "Priya Sharma", "Mumbai HO", "Accountant", "₹28,000", "Yes"],
    ["EMP-002", "Rahul Verma", "Pune Branch", "Supervisor", "₹22,500", "Yes"],
    ["EMP-003", "Sneha Patil", "Pune Branch", "Clerk", "₹18,000", "No"],
  ],
};

export const ATTENDANCE_GRID = {
  headers: ["Code", "Name", "14", "15", "16", "17", "P", "A"],
  rows: [
    ["EMP-001", "Priya Sharma", "P", "P", "A", "P", "18", "2"],
    ["EMP-002", "Rahul Verma", "—", "P", "P", "P", "20", "0"],
  ],
  highlightCells: [{ row: 0, col: 4 }],
};

export const BG_DD_FORM: TourFormField[] = [
  { label: "Instrument Type", value: "Bank Guarantee", type: "select", highlight: true },
  { label: "BG / DD Number", value: "BG-2025-0042", required: true },
  { label: "Beneficiary", value: "Education Department", required: true },
  { label: "Bank Name", value: "Axis Bank", type: "select" },
  { label: "Amount (₹)", value: "₹5,00,000", required: true },
  { label: "Expiry Date", value: "2026-03-31", type: "date", highlight: true },
  { label: "Linked Contract", value: "CTR-101 — ABC Corp", type: "select", span: 2 },
];

export const SCHOOL_ADD_FORM: TourFormField[] = [
  { label: "School Name", value: "Govt. Primary School, Haveli", required: true, highlight: true },
  { label: "District", value: "Pune", type: "select" },
  { label: "Block", value: "Haveli", type: "select" },
  { label: "Partner", value: "ABC Foundation" },
  { label: "UDISE Code", value: "27260100102" },
  { label: "Students", value: "120" },
];

export const SUPERVISOR_ADD_FORM: TourFormField[] = [
  { label: "Full Name", value: "Amit Patil", required: true },
  { label: "Phone Number", value: "+91 98765 43210", required: true, highlight: true },
  { label: "Password", value: "••••••••", type: "password", required: true },
  { label: "Assigned Blocks", value: "Haveli, Baramati", type: "select", span: 2, highlight: true },
];

export const MOBILE_LOGIN_FORM: TourFormField[] = [
  { label: "Phone Number", value: "+91 98765 43210", required: true, highlight: true },
  { label: "Password", value: "••••••••", type: "password", required: true, highlight: true },
];
