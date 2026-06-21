import type { TourFormField } from "./tour-thumbnail-forms";
export type { TourFormField } from "./tour-thumbnail-forms";

import {
  ADMIN_INVITE_FORM,
  ATTENDANCE_CELL_FORM,
  ATTENDANCE_GRID,
  BG_DD_FORM,
  EMPLOYEE_ADD_FORM,
  EMPLOYEE_LIST_TABLE,
  LEDGER_ENTRY_FORM,
  MOBILE_LOGIN_FORM,
  PAYROLL_CONFIG_FORM,
  SALARY_ROW_SAMPLE,
  SCHOOL_ADD_FORM,
  SUPERVISOR_ADD_FORM,
} from "./tour-thumbnail-forms";

export interface TourThumbnailMock {
  windowTitle: string;
  activeSidebar: string;
  sidebarItems: string[];
  showMonthBar?: boolean;
  month?: string;
  year?: string;
  subTabs?: Array<{ label: string; active?: boolean; clickTarget?: boolean }>;
  heading?: string;
  subheading?: string;
  toolbar?: Array<{ kind: "search" | "filter" | "button"; label: string; highlight?: boolean }>;
  table?: {
    headers: string[];
    rows: string[][];
    highlightCells?: Array<{ row: number; col: number }>;
  };
  cards?: Array<{ label: string; value: string; highlight?: boolean }>;
  panelLines?: string[];
  formFields?: TourFormField[];
  /** Highlight sidebar item index for click animation */
  highlightSidebarIndex?: number;
}

const FULL_SIDEBAR = [
  "Dashboard",
  "Role & Access",
  "Employees",
  "Salary",
  "Saved Bulk Pay",
  "Attendance",
  "School Work ▾",
  "Bids ▾",
  "Renewals ▾",
  "BG & DD",
];

function mock(
  sectionId: string,
  _stepIndex: number,
  data: Omit<TourThumbnailMock, "windowTitle" | "activeSidebar" | "sidebarItems"> & {
    windowTitle?: string;
    activeSidebar?: string;
    sidebarItems?: string[];
  },
): TourThumbnailMock {
  const section = SYSTEM_MOCK_DEFAULTS[sectionId];
  return {
    windowTitle: data.windowTitle ?? section?.windowTitle ?? "FlexHRM",
    activeSidebar: data.activeSidebar ?? section?.activeSidebar ?? "Dashboard",
    sidebarItems: data.sidebarItems ?? section?.sidebarItems ?? FULL_SIDEBAR,
    showMonthBar: data.showMonthBar ?? section?.showMonthBar ?? true,
    month: data.month ?? "June",
    year: data.year ?? "2025-2026",
    ...data,
  };
}

const SYSTEM_MOCK_DEFAULTS: Record<
  string,
  Pick<TourThumbnailMock, "windowTitle" | "activeSidebar" | "sidebarItems" | "showMonthBar">
> = {
  gettingStarted: { windowTitle: "FlexHRM · Portal", activeSidebar: "Dashboard", sidebarItems: FULL_SIDEBAR, showMonthBar: true },
  dashboard: { windowTitle: "FlexHRM · Dashboard", activeSidebar: "Dashboard", sidebarItems: FULL_SIDEBAR, showMonthBar: true },
  employees: { windowTitle: "FlexHRM · Employees", activeSidebar: "Employees", sidebarItems: FULL_SIDEBAR, showMonthBar: true },
  attendance: { windowTitle: "FlexHRM · Attendance", activeSidebar: "Attendance", sidebarItems: FULL_SIDEBAR, showMonthBar: true },
  salary: { windowTitle: "FlexHRM · Salary", activeSidebar: "Salary", sidebarItems: FULL_SIDEBAR, showMonthBar: true },
  savedBulkPay: { windowTitle: "FlexHRM · Saved Bulk Pay", activeSidebar: "Saved Bulk Pay", sidebarItems: FULL_SIDEBAR, showMonthBar: false },
  ledger: { windowTitle: "FlexHRM · Advance & Penalty", activeSidebar: "Advance & Penalty", sidebarItems: FULL_SIDEBAR, showMonthBar: true },
  leave: { windowTitle: "FlexHRM · Leave", activeSidebar: "Leave", sidebarItems: FULL_SIDEBAR, showMonthBar: true },
  directory: { windowTitle: "FlexHRM · Directory", activeSidebar: "Directory", sidebarItems: FULL_SIDEBAR, showMonthBar: false },
  schoolWork: { windowTitle: "FlexHRM · Schools", activeSidebar: "Schools", sidebarItems: FULL_SIDEBAR, showMonthBar: true },
  fieldTeam: { windowTitle: "FlexHRM · Field Team", activeSidebar: "Field Team", sidebarItems: FULL_SIDEBAR, showMonthBar: false },
  bids: { windowTitle: "FlexHRM · Tenders", activeSidebar: "Tenders", sidebarItems: FULL_SIDEBAR, showMonthBar: false },
  renewals: { windowTitle: "FlexHRM · Car Papers", activeSidebar: "Car Papers", sidebarItems: FULL_SIDEBAR, showMonthBar: false },
  bgDd: { windowTitle: "FlexHRM · BG & DD", activeSidebar: "BG & DD", sidebarItems: FULL_SIDEBAR, showMonthBar: false },
  roleAccess: { windowTitle: "FlexHRM · Role & Access", activeSidebar: "Role & Access", sidebarItems: FULL_SIDEBAR, showMonthBar: false },
  supervisorApp: { windowTitle: "FlexHRM Field Team", activeSidebar: "", sidebarItems: [], showMonthBar: false },
  monthlyPayroll: { windowTitle: "FlexHRM · Payroll Flow", activeSidebar: "Attendance", sidebarItems: FULL_SIDEBAR, showMonthBar: true },
  birthdays: { windowTitle: "FlexHRM · Birthdays", activeSidebar: "Birthdays", sidebarItems: FULL_SIDEBAR, showMonthBar: false },
};

const STEP_MOCKS: Record<string, TourThumbnailMock[]> = {
  gettingStarted: [
    mock("gettingStarted", 0, {
      heading: "Orange Month & Year Bar",
      subheading: "Top header — same controls as live portal",
      toolbar: [
        { kind: "filter", label: "Month: June ▾", highlight: true },
        { kind: "filter", label: "Year: 2025-2026 ▾", highlight: true },
      ],
      formFields: [
        { label: "Month", value: "June", type: "select", highlight: true },
        { label: "Financial Year", value: "2025-2026", type: "select", highlight: true },
      ],
    }),
    mock("gettingStarted", 1, {
      heading: "Left Sidebar Navigation",
      subheading: "Click module name · Expand grouped menus",
      highlightSidebarIndex: 5,
      panelLines: ["School Work ▾ · Bids ▾ · Renewals ▾ expand on click"],
    }),
    mock("gettingStarted", 2, {
      heading: "Sidebar Search",
      toolbar: [{ kind: "search", label: "Search sidebar modules...", highlight: true }],
      panelLines: ["Type \"Salary\" → click filtered result", "Type \"Field\" → Field Team appears"],
    }),
    mock("gettingStarted", 3, {
      heading: "Profile Menu (Top Right)",
      toolbar: [
        { kind: "button", label: "Username ▾", highlight: true },
      ],
      panelLines: [
        "My Account Profile · System Tour",
        "Portal Settings · Sign Out",
      ],
    }),
    mock("gettingStarted", 4, {
      heading: "Notification Bell",
      toolbar: [{ kind: "button", label: "🔔 Bell · 3 unread", highlight: true }],
      panelLines: [
        "Click bell → read alerts",
        "Click row → Field Team (Visits/Requests)",
        "Mark all read when done",
      ],
    }),
  ],
  dashboard: [
    mock("dashboard", 0, {
      heading: "Executive Dashboard",
      cards: [
        { label: "Active Employees", value: "142" },
        { label: "Net Payroll", value: "₹4.8L" },
        { label: "Attendance Rate", value: "94%" },
        { label: "Renewals Alert", value: "3 due" },
      ],
      toolbar: [
        { kind: "button", label: "Visits", highlight: true },
        { kind: "button", label: "Requests (2)" },
        { kind: "button", label: "Commitment Diary" },
      ],
    }),
    mock("dashboard", 1, {
      heading: "Action Required",
      panelLines: [
        "⚠ 3 supervisor requests pending → click Open",
        "⚠ 2 renewals expiring soon → click Open",
        "⚠ 1 bulk edit awaiting approval → click Open",
      ],
      toolbar: [{ kind: "button", label: "Open", highlight: true }],
    }),
    mock("dashboard", 2, {
      heading: "KPI Cards & Quick Links",
      cards: [
        { label: "Total Employees", value: "142 →" },
        { label: "Schools", value: "48 →" },
      ],
      panelLines: ["Click any KPI card → jump to module", "Quick Links grid → 12 module tiles"],
    }),
    mock("dashboard", 3, {
      heading: "Field Team Shortcuts",
      toolbar: [
        { kind: "button", label: "Visits", highlight: true },
        { kind: "button", label: "Requests (2)", highlight: true },
        { kind: "button", label: "Commitment Diary" },
      ],
      panelLines: ["Supervisor map → click pin → Supervisors view"],
    }),
  ],
  employees: [
    mock("employees", 0, {
      subTabs: [{ label: "Configuration", active: true }, { label: "Employee List" }, { label: "Add Employee" }, { label: "Reports" }],
      heading: "Employees → Configuration",
      formFields: PAYROLL_CONFIG_FORM,
      toolbar: [{ kind: "button", label: "Save Payroll Rules", highlight: true }],
    }),
    mock("employees", 1, {
      subTabs: [{ label: "Configuration" }, { label: "Employee List", active: true }, { label: "Reports" }],
      heading: "ECR-Structured Employee Master Registry",
      toolbar: [
        { kind: "search", label: "Search by Employee Code, Name, Aadhar No, UAN, PAN..." },
        { kind: "filter", label: "Active Staff (Current) ▾", highlight: true },
        { kind: "filter", label: "All Locations ▾" },
        { kind: "filter", label: "All Roles ▾" },
      ],
      table: EMPLOYEE_LIST_TABLE,
    }),
    mock("employees", 2, {
      subTabs: [{ label: "Employee List" }, { label: "Add Employee", active: true, clickTarget: true }],
      heading: "Employee Onboarding — Basic Tab",
      formFields: EMPLOYEE_ADD_FORM,
      toolbar: [{ kind: "button", label: "Save Employee", highlight: true }],
    }),
    mock("employees", 3, {
      subTabs: [{ label: "Employee List", active: true }],
      heading: "CSV Import — Bulk Onboard",
      toolbar: [
        { kind: "button", label: "Download CSV Template", highlight: true },
        { kind: "button", label: "Upload CSV File", highlight: true },
      ],
      panelLines: ["Preview grid → fix red rows → Confirm Import"],
    }),
    mock("employees", 4, {
      subTabs: [{ label: "Employee List", active: true }],
      heading: "Mark Employee Exit",
      toolbar: [
        { kind: "filter", label: "Exited Staff ▾", highlight: true },
        { kind: "button", label: "Mark Exit", highlight: true },
      ],
      panelLines: ["Edit row → Exit Date · Reason → Save", "Or select rows → Mark Exit (bulk)"],
    }),
    mock("employees", 5, {
      subTabs: [{ label: "Employee List", active: true }],
      heading: "ECR Bulk Edit",
      toolbar: [
        { kind: "button", label: "ECR Bulk Edit", highlight: true },
        { kind: "button", label: "Apply Changes" },
      ],
      panelLines: ["Edit spreadsheet cells → Apply", "Pending → Employee Change Requests → Approve"],
    }),
    mock("employees", 6, {
      subTabs: [{ label: "Reports", active: true }],
      heading: "Custom Employee Reports",
      toolbar: [
        { kind: "filter", label: "Location · Role · Skill filters" },
        { kind: "button", label: "Export CSV", highlight: true },
        { kind: "button", label: "Export Excel" },
        { kind: "button", label: "Export PDF" },
      ],
      panelLines: ["Toggle columns · Save template · Export filtered set"],
    }),
  ],
  attendance: [
    mock("attendance", 0, {
      heading: "Monthly Attendance Register",
      toolbar: [
        { kind: "filter", label: "Month: June ▾", highlight: true },
        { kind: "filter", label: "Year: 2025-2026 ▾", highlight: true },
      ],
      formFields: [
        { label: "Month", value: "June", type: "select", highlight: true },
        { label: "Financial Year", value: "2025-2026", type: "select", highlight: true },
      ],
    }),
    mock("attendance", 1, {
      heading: "Daily Attendance Grid",
      subheading: "Click cell → P · A · H · — (blank)",
      table: ATTENDANCE_GRID,
      formFields: ATTENDANCE_CELL_FORM,
    }),
    mock("attendance", 2, {
      heading: "Bulk Mark Attendance Wizard",
      toolbar: [{ kind: "button", label: "Bulk Mark Attendance", highlight: true }],
      panelLines: [
        "Step 1: Select Staff (location · role · employees)",
        "Step 2: Select Dates (calendar clicks)",
        "Step 3: Confirm & Mark Bulk Present",
      ],
    }),
    mock("attendance", 3, {
      heading: "Filter Register",
      toolbar: [
        { kind: "search", label: "Search employee..." },
        { kind: "filter", label: "Location ▾", highlight: true },
        { kind: "filter", label: "Role ▾" },
        { kind: "filter", label: "Skill ▾" },
      ],
    }),
    mock("attendance", 4, {
      heading: "Export Attendance",
      toolbar: [
        { kind: "button", label: "Export Excel (Landscape)", highlight: true },
        { kind: "button", label: "Export PDF (Landscape)" },
      ],
      table: {
        headers: ["Code", "Name", "Presents", "Absents"],
        rows: [["EMP-001", "Priya Sharma", "18", "2"]],
      },
    }),
  ],
  salary: [
    mock("salary", 0, {
      heading: "Salary Sheet — June 2025",
      cards: [
        { label: "Total Gross Payroll", value: "₹4,82,000" },
        { label: "Total Net Payable", value: "₹4,15,200" },
        { label: "Total Deductions", value: "₹66,800" },
        { label: "Employer Liability", value: "₹48,200" },
      ],
      table: SALARY_ROW_SAMPLE,
    }),
    mock("salary", 1, {
      heading: "Filter Payroll",
      toolbar: [
        { kind: "filter", label: "Location: Pune ▾", highlight: true },
        { kind: "filter", label: "Role ▾" },
        { kind: "filter", label: "Payment Status ▾" },
        { kind: "filter", label: "Balance Type ▾" },
      ],
    }),
    mock("salary", 2, {
      heading: "Export Payroll",
      toolbar: [
        { kind: "button", label: "Export CSV", highlight: true },
        { kind: "button", label: "Export Excel" },
        { kind: "button", label: "Export PDF" },
      ],
      panelLines: ["Select rows → export selected only"],
    }),
    mock("salary", 3, {
      heading: "Payment Status Column",
      table: SALARY_ROW_SAMPLE,
      toolbar: [{ kind: "button", label: "Mark selected Paid", highlight: true }],
    }),
    mock("salary", 4, {
      heading: "Axis Bulk Pay — Salary",
      toolbar: [{ kind: "button", label: "Bulk Pay", highlight: true }],
      formFields: [
        { label: "Default Debit Account", value: "FlexHRM Payroll A/c — UTIB0000123", span: 2 },
        { label: "Format", value: "Axis Bank .xls", type: "select" },
        { label: "Records", value: "142 employees" },
      ],
    }),
  ],
  savedBulkPay: [
    mock("savedBulkPay", 0, {
      heading: "Saved Bulk Pay Archive",
      toolbar: [
        { kind: "filter", label: "Year: 2025-2026 ▾", highlight: true },
        { kind: "button", label: "Refresh" },
      ],
      table: {
        headers: ["Saved On", "Month", "Records", "Total", "By"],
        rows: [["12 Jun", "June 2025", "142", "₹4.15L", "hr.admin"]],
      },
    }),
    mock("savedBulkPay", 1, {
      heading: "View · Re-download · Delete",
      table: {
        headers: ["Filename", "Actions"],
        rows: [["axis_bulk_june_2025.xls", "View · Re-download · Delete"]],
      },
      toolbar: [{ kind: "button", label: "Re-download", highlight: true }],
    }),
  ],
  ledger: [
    mock("ledger", 0, {
      heading: "Select Employees (Left Panel)",
      panelLines: ["☑ checklist · Search · Location ▾ · Role ▾", "Select All · Clear"],
      table: {
        headers: ["☑", "Code", "Name", "Location"],
        rows: [
          ["☑", "EMP-001", "Priya", "Mumbai"],
          ["☐", "EMP-002", "Rahul", "Pune"],
        ],
      },
    }),
    mock("ledger", 1, {
      heading: "Record Advance / Penalty / Perk",
      formFields: LEDGER_ENTRY_FORM,
      toolbar: [{ kind: "button", label: "Save Entry", highlight: true }],
    }),
    mock("ledger", 2, {
      heading: "Month Summary Totals",
      cards: [
        { label: "Advances", value: "₹12,000" },
        { label: "Penalties", value: "₹3,500" },
        { label: "Perks", value: "₹8,200" },
      ],
    }),
    mock("ledger", 3, {
      heading: "Batch Settlement",
      toolbar: [{ kind: "button", label: "Settle Selected for June", highlight: true }],
      panelLines: ["→ then Salary → verify Net Payable updated"],
    }),
  ],
  directory: [
    mock("directory", 0, {
      subTabs: [{ label: "Employee Profiles", active: true }, { label: "Important Helplines" }],
      heading: "Directory — Employee Profiles",
      toolbar: [
        { kind: "search", label: "Search contacts..." },
        { kind: "filter", label: "Location ▾" },
      ],
      cards: [
        { label: "Priya Sharma", value: "+91 98765 43210" },
        { label: "Rahul Verma", value: "+91 91234 56789" },
      ],
    }),
    mock("directory", 1, {
      subTabs: [{ label: "Employee Profiles" }, { label: "Important Helplines", active: true }],
      heading: "Add Helpline",
      panelLines: ["Name · Phone · Role · Category · Location", "→ Click Save / Add Helpline"],
      toolbar: [{ kind: "button", label: "Add Helpline", highlight: true }],
    }),
  ],
  birthdays: [
    mock("birthdays", 0, {
      heading: "Birthdays — June 2025",
      toolbar: [{ kind: "filter", label: "Month: June ▾", highlight: true }],
      table: {
        headers: ["Name", "Date of Birth", "Location", "Today?"],
        rows: [
          ["Priya Sharma", "15 Jun", "Mumbai HO", "🎂 Today"],
          ["Rahul Verma", "22 Jun", "Pune Branch", ""],
        ],
      },
      panelLines: ["Click Celebrate → confetti for today's birthdays"],
    }),
  ],
  schoolWork: [
    mock("schoolWork", 0, {
      activeSidebar: "Schools",
      heading: "School Registry",
      formFields: SCHOOL_ADD_FORM,
      toolbar: [
        { kind: "search", label: "Search schools..." },
        { kind: "button", label: "Add School", highlight: true },
        { kind: "button", label: "Import Excel" },
      ],
    }),
    mock("schoolWork", 1, {
      activeSidebar: "Monthly Billing",
      windowTitle: "FlexHRM · Monthly Billing",
      subTabs: [{ label: "Create Invoice", active: true }, { label: "View Saved" }, { label: "Partner Pay" }],
      heading: "Create Invoice — June 2025",
      toolbar: [{ kind: "button", label: "Generate Invoice", highlight: true }],
      panelLines: ["Pick block → Elementary | Secondary tabs → Generate"],
    }),
    mock("schoolWork", 2, {
      activeSidebar: "Monthly Billing",
      subTabs: [{ label: "Create Invoice" }, { label: "View Saved", active: true }],
      heading: "View Saved Billings",
      toolbar: [{ kind: "button", label: "Export PDF", highlight: true }],
      table: {
        headers: ["Period", "Block", "Amount", "Status"],
        rows: [["June 2025", "Haveli", "₹4.8L", "Saved"]],
      },
    }),
    mock("schoolWork", 3, {
      activeSidebar: "Monthly Billing",
      subTabs: [{ label: "Partner Pay", active: true }],
      heading: "Partner Pay — Bulk Pay",
      toolbar: [{ kind: "button", label: "Bulk Pay", highlight: true }],
      panelLines: ["→ archives to Saved School Bulk Pay"],
    }),
    mock("schoolWork", 4, {
      activeSidebar: "Expenses",
      windowTitle: "FlexHRM · Expenses",
      heading: "School Expenses",
      toolbar: [{ kind: "button", label: "Add Expense", highlight: true }],
      table: {
        headers: ["Date", "School", "Amount", "Notes"],
        rows: [["12 Jun", "Govt. Primary", "₹2,400", "Stationery"]],
      },
    }),
    mock("schoolWork", 5, {
      activeSidebar: "Saved School Bulk Pay",
      windowTitle: "FlexHRM · Saved School Bulk Pay",
      heading: "Partner Bulk Pay Archive",
      toolbar: [{ kind: "button", label: "Re-download", highlight: true }],
      table: {
        headers: ["Month", "Filename", "Total"],
        rows: [["June 2025", "partner_bulk_june.xls", "₹1.2L"]],
      },
    }),
  ],
  fieldTeam: [
    mock("fieldTeam", 0, {
      subTabs: [
        { label: "Visits", active: true },
        { label: "Supervisors" },
        { label: "Requests (2)" },
        { label: "Commitment Diary" },
      ],
      heading: "Field Team Panel",
      panelLines: ["School Work → Field Team · or Dashboard shortcuts"],
    }),
    mock("fieldTeam", 1, {
      subTabs: [{ label: "Visits" }, { label: "Supervisors", active: true }],
      heading: "Add Supervisor Account",
      formFields: SUPERVISOR_ADD_FORM,
      toolbar: [{ kind: "button", label: "Add Supervisor", highlight: true }],
    }),
    mock("fieldTeam", 2, {
      subTabs: [{ label: "Visits", active: true }],
      heading: "Review Visits",
      toolbar: [
        { kind: "filter", label: "Status: Submitted ▾", highlight: true },
        { kind: "button", label: "Approve", highlight: true },
        { kind: "button", label: "Reject" },
      ],
      table: {
        headers: ["Supervisor", "School", "Date", "Status"],
        rows: [["Amit Patil", "Govt. Primary", "12 Jun", "Submitted"]],
      },
    }),
    mock("fieldTeam", 3, {
      subTabs: [{ label: "Requests (2)", active: true }],
      heading: "Supervisor Requests",
      panelLines: ["Click request → read message/photos", "Type response → Respond → Close"],
      toolbar: [{ kind: "button", label: "Respond", highlight: true }],
    }),
    mock("fieldTeam", 4, {
      subTabs: [{ label: "Commitment Diary", active: true }],
      heading: "Commitment Diary",
      table: {
        headers: ["Supervisor", "Date", "School", "Status"],
        rows: [["Amit Patil", "15 Jun", "ZP School", "Overdue"]],
      },
      panelLines: ["Update status · Admin notes · Overdue badge"],
    }),
  ],
  bids: [
    mock("bids", 0, {
      activeSidebar: "Tenders",
      heading: "Tender Filings",
      cards: [
        { label: "All", value: "24" },
        { label: "Upcoming", value: "5" },
        { label: "Passed", value: "12" },
      ],
      toolbar: [
        { kind: "button", label: "Add Tender", highlight: true },
        { kind: "button", label: "Import Excel" },
      ],
      table: {
        headers: ["Bid No", "Dept", "End Date", "Amount"],
        rows: [["TND-04", "Education", "30 Jun", "₹12L"]],
      },
    }),
    mock("bids", 1, {
      activeSidebar: "Tenders",
      heading: "Tender Detail & GeM Link",
      panelLines: ["Expand row → GeM PDF link · Edit · Delete", "Needs Attention: deadline ≤7 days"],
    }),
    mock("bids", 2, {
      windowTitle: "FlexHRM · Contracts",
      activeSidebar: "Contracts",
      heading: "Active Contracts",
      toolbar: [{ kind: "button", label: "Add Contract", highlight: true }],
      table: {
        headers: ["Contract", "Party", "End", "Value"],
        rows: [["CTR-101", "ABC Corp", "31 Dec", "₹24L"]],
      },
      panelLines: ["Link to won tender · → then BG & DD if needed"],
    }),
  ],
  renewals: [
    mock("renewals", 0, {
      activeSidebar: "Car Papers",
      heading: "Car Papers Renewals",
      cards: [
        { label: "Total", value: "8" },
        { label: "Expiring Soon", value: "2" },
        { label: "Expired", value: "1" },
      ],
      toolbar: [{ kind: "button", label: "Add Renewal", highlight: true }],
      table: {
        headers: ["Vehicle", "Document", "Expiry", "Status"],
        rows: [["MH-12-AB-1234", "Insurance", "15 Jul", "Due soon"]],
      },
    }),
    mock("renewals", 1, {
      activeSidebar: "IT Renewals",
      windowTitle: "FlexHRM · IT Renewals",
      heading: "IT Renewals — Domains & Servers",
      toolbar: [{ kind: "button", label: "Add Renewal", highlight: true }],
      table: {
        headers: ["Name", "Owner", "Expiry", "Status"],
        rows: [["flexhrm.com", "IT Team", "01 Aug", "Expiring"]],
      },
    }),
    mock("renewals", 2, {
      activeSidebar: "Licenses",
      windowTitle: "FlexHRM · Licenses",
      heading: "License Renewals",
      toolbar: [
        { kind: "button", label: "Add Renewal", highlight: true },
        { kind: "button", label: "Import Excel" },
      ],
      panelLines: ["Upload documents · Expiring Soon card weekly"],
    }),
  ],
  bgDd: [
    mock("bgDd", 0, {
      heading: "BG & DD Register",
      cards: [
        { label: "Total", value: "15" },
        { label: "Expiring Soon", value: "3" },
        { label: "Expired", value: "1" },
      ],
      toolbar: [
        { kind: "search", label: "Search..." },
        { kind: "filter", label: "Type: BG/DD ▾" },
      ],
    }),
    mock("bgDd", 1, {
      heading: "Add BG / DD Record",
      formFields: BG_DD_FORM,
      toolbar: [{ kind: "button", label: "Add BG / DD", highlight: true }],
    }),
    mock("bgDd", 2, {
      heading: "Document Attachments",
      panelLines: ["Row → Documents → Upload PDF/image", "View preview · Delete if allowed"],
      toolbar: [{ kind: "button", label: "Upload Document", highlight: true }],
    }),
  ],
  roleAccess: [
    mock("roleAccess", 0, {
      subTabs: [{ label: "Admin Accounts", active: true }, { label: "Roles & Permissions" }, { label: "Activity Log" }, { label: "Device Rules" }],
      heading: "Invite New Admin",
      formFields: ADMIN_INVITE_FORM,
      toolbar: [{ kind: "button", label: "Grant Administrator Access", highlight: true }],
    }),
    mock("roleAccess", 1, {
      subTabs: [{ label: "Admin Accounts", active: true }],
      heading: "Configure Existing Admin",
      table: {
        headers: ["Username", "Role", "Status", "Action"],
        rows: [["hr.admin", "Super Admin", "Active", "Configure"]],
      },
      panelLines: ["Configure → change role · disable login · locations → Save"],
    }),
    mock("roleAccess", 2, {
      subTabs: [{ label: "Roles & Permissions", active: true }],
      heading: "Permission Matrix",
      table: {
        headers: ["Module", "View ☑", "Edit ☑"],
        rows: [
          ["Employees", "✓", "✓"],
          ["Salary", "✓", "—"],
          ["School Work", "✓", "✓"],
        ],
      },
      toolbar: [{ kind: "button", label: "Save role permissions", highlight: true }],
    }),
    mock("roleAccess", 3, {
      subTabs: [{ label: "Activity Log", active: true }],
      heading: "Activity Log / Audit Trail",
      toolbar: [
        { kind: "search", label: "Search logs..." },
        { kind: "button", label: "Export Excel", highlight: true },
        { kind: "button", label: "Flush Trail (admin)" },
      ],
      table: {
        headers: ["Admin", "Action", "Time"],
        rows: [["hr.admin", "Updated EMP-001", "10:42"]],
      },
    }),
    mock("roleAccess", 4, {
      subTabs: [{ label: "Device Rules", active: true }],
      heading: "Blocked Android Apps",
      table: {
        headers: ["App", "Package ID", "Delete"],
        rows: [["WhatsApp", "com.whatsapp", "✕"]],
      },
      toolbar: [{ kind: "button", label: "Add blocked app", highlight: true }],
    }),
  ],
  supervisorApp: [
    mock("supervisorApp", 0, {
      heading: "Install APK",
      panelLines: [
        "Admin shares APK securely",
        "Android → Allow unknown sources → Install",
        "One device per account on first login",
      ],
    }),
    mock("supervisorApp", 1, {
      heading: "Supervisor Login",
      formFields: MOBILE_LOGIN_FORM,
      toolbar: [{ kind: "button", label: "Sign In", highlight: true }],
    }),
    mock("supervisorApp", 2, {
      heading: "Today's Visits",
      table: {
        headers: ["School", "Block", "Action"],
        rows: [
          ["Govt. Primary", "Haveli", "Check In →"],
          ["ZP School #4", "Baramati", "Done ✓"],
        ],
      },
      panelLines: ["Tap visit → photos · notes → Submit"],
    }),
    mock("supervisorApp", 3, {
      heading: "Profile & Requests",
      toolbar: [
        { kind: "button", label: "Raise Request", highlight: true },
        { kind: "button", label: "My Profile" },
      ],
      panelLines: ["Profile → photo · language", "Requests → admin responds in portal"],
    }),
    mock("supervisorApp", 4, {
      heading: "Calendar & Commitments",
      panelLines: ["Calendar tab → commitments by date", "Tap → complete visit when due"],
    }),
  ],
  monthlyPayroll: [
    mock("monthlyPayroll", 0, {
      subTabs: [{ label: "Configuration", active: true }],
      heading: "Step 1 — Confirm Setup",
      panelLines: [
        "Employees → Configuration → rules · bank · locations",
        "Employee List → all active staff correct",
      ],
    }),
    mock("monthlyPayroll", 1, {
      activeSidebar: "Attendance",
      heading: "Step 2 — Mark Attendance",
      toolbar: [
        { kind: "filter", label: "Month: June ▾", highlight: true },
        { kind: "button", label: "Bulk Mark Attendance" },
      ],
      panelLines: ["Mark every day P or A · Bulk for holidays"],
    }),
    mock("monthlyPayroll", 2, {
      activeSidebar: "Advance & Penalty",
      heading: "Step 3 — Ledger Entries",
      toolbar: [{ kind: "button", label: "Settle Selected", highlight: true }],
      panelLines: ["Select employees → Advance/Penalty → batch settle"],
    }),
    mock("monthlyPayroll", 3, {
      activeSidebar: "Salary",
      heading: "Step 4 — Salary & Bank Pay",
      toolbar: [
        { kind: "button", label: "Export PDF" },
        { kind: "button", label: "Bulk Pay", highlight: true },
      ],
      panelLines: ["Verify net pay → Bulk Pay → Saved Bulk Pay archive"],
    }),
  ],
  leave: [
    mock("leave", 0, {
      heading: "Leave Module — Coming Soon",
      panelLines: [
        "Full leave register planned",
        "For now: Attendance → mark A or H on leave days",
        "Sidebar → Leave → read status message",
      ],
    }),
  ],
};

export function getTourThumbnailMock(sectionId: string, stepIndex: number): TourThumbnailMock {
  const steps = STEP_MOCKS[sectionId];
  if (steps?.[stepIndex]) return steps[stepIndex];
  const fallback = SYSTEM_MOCK_DEFAULTS[sectionId] ?? SYSTEM_MOCK_DEFAULTS.gettingStarted;
  return {
    ...fallback,
    month: "June",
    year: "2025-2026",
    heading: fallback.windowTitle.replace("FlexHRM · ", ""),
  };
}
