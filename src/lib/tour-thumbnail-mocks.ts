export interface TourThumbnailMock {
  windowTitle: string;
  activeSidebar: string;
  sidebarItems: string[];
  showMonthBar?: boolean;
  month?: string;
  year?: string;
  subTabs?: Array<{ label: string; active?: boolean }>;
  heading?: string;
  subheading?: string;
  toolbar?: Array<{ kind: "search" | "filter" | "button"; label: string; highlight?: boolean }>;
  table?: { headers: string[]; rows: string[][] };
  cards?: Array<{ label: string; value: string }>;
  panelLines?: string[];
}

const DEFAULT_SIDEBAR = [
  "Dashboard",
  "Employees",
  "Attendance",
  "Salary",
  "Advance & Penalty",
  "Leave",
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
    sidebarItems: data.sidebarItems ?? section?.sidebarItems ?? DEFAULT_SIDEBAR,
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
  employees: {
    windowTitle: "FlexHRM · Employees",
    activeSidebar: "Employees",
    sidebarItems: DEFAULT_SIDEBAR,
    showMonthBar: true,
  },
  attendance: {
    windowTitle: "FlexHRM · Attendance",
    activeSidebar: "Attendance",
    sidebarItems: DEFAULT_SIDEBAR,
    showMonthBar: true,
  },
  salary: {
    windowTitle: "FlexHRM · Salary",
    activeSidebar: "Salary",
    sidebarItems: ["Dashboard", "Employees", "Attendance", "Salary", "Saved Bulk Pay"],
    showMonthBar: true,
  },
  ledger: {
    windowTitle: "FlexHRM · Advance & Penalty",
    activeSidebar: "Advance & Penalty",
    sidebarItems: ["Dashboard", "Salary", "Advance & Penalty", "Leave", "Attendance"],
    showMonthBar: true,
  },
  leave: {
    windowTitle: "FlexHRM · Leave",
    activeSidebar: "Leave",
    sidebarItems: DEFAULT_SIDEBAR,
    showMonthBar: true,
  },
  directory: {
    windowTitle: "FlexHRM · Directory",
    activeSidebar: "Directory",
    sidebarItems: ["Dashboard", "Employees", "Directory", "Birthdays"],
    showMonthBar: false,
  },
  schoolWork: {
    windowTitle: "FlexHRM · Schools",
    activeSidebar: "School Work",
    sidebarItems: ["Dashboard", "Employees", "School Work", "Schools", "Field Team"],
    showMonthBar: true,
  },
  bids: {
    windowTitle: "FlexHRM · Tenders",
    activeSidebar: "Bids",
    sidebarItems: ["Dashboard", "Bids", "Tenders", "Contracts", "Renewals"],
    showMonthBar: false,
  },
  roleAccess: {
    windowTitle: "FlexHRM · Role & Access",
    activeSidebar: "Role & Access",
    sidebarItems: ["Dashboard", "Role & Access", "Employees", "Attendance"],
    showMonthBar: false,
  },
  supervisorApp: {
    windowTitle: "FlexHRM Field Team",
    activeSidebar: "",
    sidebarItems: [],
    showMonthBar: false,
  },
  portalTips: {
    windowTitle: "FlexHRM · Dashboard",
    activeSidebar: "Dashboard",
    sidebarItems: DEFAULT_SIDEBAR,
    showMonthBar: true,
  },
};

const STEP_MOCKS: Record<string, TourThumbnailMock[]> = {
  employees: [
    mock("employees", 0, {
      subTabs: [
        { label: "Configuration" },
        { label: "Employee List", active: true },
        { label: "Add Employee" },
        { label: "Reports" },
      ],
      heading: "ECR-Structured Employee Master Registry",
      toolbar: [
        { kind: "search", label: "Search by Employee Code, Name, Aadhar No..." },
        { kind: "filter", label: "Active Staff (Current)" },
        { kind: "filter", label: "All Locations" },
        { kind: "filter", label: "All Roles" },
      ],
      table: {
        headers: ["Code", "Name", "Location", "Job Role", "Gross Salary"],
        rows: [
          ["EMP-001", "Priya Sharma", "Mumbai HO", "Accountant", "₹28,000"],
          ["EMP-002", "Rahul Verma", "Pune Branch", "Supervisor", "₹22,500"],
        ],
      },
    }),
    mock("employees", 1, {
      subTabs: [
        { label: "Configuration" },
        { label: "Employee List" },
        { label: "Add Employee", active: true },
        { label: "Reports" },
      ],
      heading: "Add New Employee",
      panelLines: [
        "Employee Code · Full Name · Location · Job Role",
        "Gross Salary · Basic Salary · Bank Account · IFSC",
        "UAN · Aadhar No · PAN · Date of Birth",
      ],
      toolbar: [
        { kind: "button", label: "Save Employee", highlight: true },
        { kind: "button", label: "Cancel" },
      ],
    }),
    mock("employees", 2, {
      subTabs: [
        { label: "Configuration" },
        { label: "Employee List", active: true },
        { label: "Add Employee" },
        { label: "Reports" },
      ],
      heading: "Bulk Registry Operations",
      subheading: "Import new employees from CSV or edit multiple ECR fields",
      toolbar: [
        { kind: "button", label: "Download CSV Template", highlight: true },
        { kind: "button", label: "Upload CSV File" },
        { kind: "button", label: "ECR Bulk Edit" },
      ],
      panelLines: ["Preview grid · Validate rows · Confirm import"],
    }),
    mock("employees", 3, {
      subTabs: [{ label: "Configuration", active: true }, { label: "Employee List" }, { label: "Reports" }],
      heading: "Employees Configuration",
      cards: [
        { label: "Payroll Rules", value: "PF · ESIC · PT" },
        { label: "Bank Accounts", value: "2 accounts" },
        { label: "Office Locations", value: "4 sites" },
        { label: "Job Roles", value: "12 roles" },
      ],
      toolbar: [{ kind: "button", label: "Save Payroll Rules", highlight: true }],
    }),
  ],
  attendance: [
    mock("attendance", 0, {
      heading: "Monthly Attendance Register",
      toolbar: [
        { kind: "filter", label: "Month: June", highlight: true },
        { kind: "filter", label: "Year: 2025-2026", highlight: true },
        { kind: "filter", label: "All Locations" },
      ],
      table: {
        headers: ["Code", "Name", "01", "02", "03", "P", "A"],
        rows: [
          ["EMP-001", "Priya Sharma", "P", "P", "A", "18", "2"],
          ["EMP-002", "Rahul Verma", "P", "—", "P", "20", "0"],
        ],
      },
    }),
    mock("attendance", 1, {
      heading: "Monthly Attendance Register",
      subheading: "Click a cell → P (Present) · A (Absent) · — (blank)",
      table: {
        headers: ["Code", "Name", "15 Jun", "16 Jun", "17 Jun"],
        rows: [
          ["EMP-001", "Priya Sharma", "P", "A", "P"],
          ["EMP-002", "Rahul Verma", "—", "P", "P"],
        ],
      },
    }),
    mock("attendance", 2, {
      heading: "Bulk Mark Attendance Wizard",
      panelLines: [
        "Date range · Present or Absent",
        "Filter by Location · Filter by Role",
        "⚡ Confirm & Mark Bulk Present",
      ],
      toolbar: [{ kind: "button", label: "Bulk Mark Attendance", highlight: true }],
    }),
    mock("attendance", 3, {
      heading: "Monthly Attendance Register",
      toolbar: [
        { kind: "button", label: "Export CSV", highlight: true },
        { kind: "button", label: "Export PDF" },
      ],
      table: {
        headers: ["SR NO", "Employee Code", "Employee Name", "Presents", "Absents"],
        rows: [["1", "EMP-001", "Priya Sharma", "18", "2"]],
      },
    }),
  ],
  salary: [
    mock("salary", 0, {
      heading: "Salary Sheet — June 2025",
      cards: [
        { label: "Total Gross Payroll", value: "₹4,82,000" },
        { label: "Total Net Payable", value: "₹4,15,200" },
      ],
      table: {
        headers: ["Code", "Name", "Present Days", "Gross Pay", "Net Payable"],
        rows: [
          ["EMP-001", "Priya Sharma", "18", "₹28,000", "₹24,100"],
          ["EMP-002", "Rahul Verma", "20", "₹22,500", "₹19,800"],
        ],
      },
    }),
    mock("salary", 1, {
      heading: "Salary Sheet — June 2025",
      toolbar: [
        { kind: "filter", label: "Location: Pune Branch", highlight: true },
        { kind: "filter", label: "Role: Supervisor" },
        { kind: "filter", label: "Payment Status: All" },
      ],
      table: {
        headers: ["Code", "Name", "Location", "Role", "Net Payable"],
        rows: [["EMP-002", "Rahul Verma", "Pune Branch", "Supervisor", "₹19,800"]],
      },
    }),
    mock("salary", 2, {
      heading: "Salary Sheet — June 2025",
      toolbar: [
        { kind: "button", label: "Export CSV", highlight: true },
        { kind: "button", label: "Export PDF" },
      ],
      table: {
        headers: ["Employee Code", "Employee Name", "Net Payable", "Payment Status"],
        rows: [["EMP-001", "Priya Sharma", "₹24,100", "Pending"]],
      },
    }),
    mock("salary", 3, {
      windowTitle: "FlexHRM · Saved Bulk Pay",
      activeSidebar: "Saved Bulk Pay",
      heading: "Axis Bulk Pay Files",
      toolbar: [{ kind: "button", label: "Generate Axis Bulk Pay XLS", highlight: true }],
      panelLines: ["Default debit account · Axis format · Archive saved files"],
    }),
  ],
  ledger: [
    mock("ledger", 0, {
      heading: "Advance & Penalty Ledger",
      panelLines: ["☑ Select employees · Filter by location / role"],
      table: {
        headers: ["☑", "Code", "Name", "Location", "Role"],
        rows: [
          ["☑", "EMP-001", "Priya Sharma", "Mumbai HO", "Accountant"],
          ["☐", "EMP-002", "Rahul Verma", "Pune Branch", "Supervisor"],
        ],
      },
    }),
    mock("ledger", 1, {
      heading: "Record Advance or Penalty",
      toolbar: [
        { kind: "filter", label: "Type: Advance", highlight: true },
        { kind: "filter", label: "Type: Penalty" },
        { kind: "button", label: "Save Entry", highlight: true },
      ],
      panelLines: ["Amount · Month: June 2025 · Notes"],
    }),
    mock("ledger", 2, {
      heading: "Batch Settlement",
      toolbar: [{ kind: "button", label: "Settle Selected for June", highlight: true }],
      panelLines: ["Apply pending advances & penalties to salary sheet"],
    }),
  ],
  leave: [
    mock("leave", 0, {
      heading: "Leave Register — June 2025",
      table: {
        headers: ["Code", "Name", "Leave Type", "From", "To", "Days"],
        rows: [["EMP-001", "Priya Sharma", "Casual", "10 Jun", "11 Jun", "2"]],
      },
    }),
    mock("leave", 1, {
      heading: "Add Leave Record",
      panelLines: ["Employee · Leave type · Date range · Reason"],
      toolbar: [{ kind: "button", label: "Save Leave", highlight: true }],
    }),
  ],
  directory: [
    mock("directory", 0, {
      windowTitle: "FlexHRM · Directory",
      heading: "Directory Contacts",
      cards: [
        { label: "HR Helpline", value: "+91 98765 43210" },
        { label: "IT Support", value: "it@company.com" },
      ],
      panelLines: ["Name · Phone · Role · Location"],
    }),
    mock("directory", 1, {
      windowTitle: "FlexHRM · Birthdays",
      activeSidebar: "Birthdays",
      heading: "Birthdays — June 2025",
      table: {
        headers: ["Name", "Date of Birth", "Location", "Role"],
        rows: [["Priya Sharma", "15 Jun", "Mumbai HO", "Accountant"]],
      },
    }),
  ],
  schoolWork: [
    mock("schoolWork", 0, {
      activeSidebar: "Schools",
      heading: "School Registry",
      toolbar: [
        { kind: "search", label: "Search schools..." },
        { kind: "button", label: "Add School", highlight: true },
      ],
      table: {
        headers: ["School Name", "District", "Block", "Partner"],
        rows: [["Govt. Primary School", "Pune", "Haveli", "ABC Foundation"]],
      },
    }),
    mock("schoolWork", 1, {
      activeSidebar: "Monthly Billing",
      sidebarItems: ["Dashboard", "School Work", "Schools", "Monthly Billing", "Field Team"],
      windowTitle: "FlexHRM · Monthly Billing",
      heading: "Monthly Billing — June 2025",
      toolbar: [{ kind: "button", label: "Generate Invoice", highlight: true }],
      table: {
        headers: ["School", "Students", "Amount", "Status"],
        rows: [["Govt. Primary School", "120", "₹48,000", "Draft"]],
      },
    }),
    mock("schoolWork", 2, {
      activeSidebar: "Expenses",
      sidebarItems: ["Dashboard", "School Work", "Monthly Billing", "Expenses", "Field Team"],
      windowTitle: "FlexHRM · Expenses",
      heading: "School Work Expenses",
      toolbar: [{ kind: "button", label: "Add Expense", highlight: true }],
      table: {
        headers: ["Date", "Category", "Amount", "Notes"],
        rows: [["12 Jun", "Materials", "₹2,400", "Stationery supply"]],
      },
    }),
    mock("schoolWork", 3, {
      windowTitle: "FlexHRM · Field Team",
      activeSidebar: "Field Team",
      heading: "Field Team — Supervisors",
      toolbar: [{ kind: "button", label: "Add Supervisor", highlight: true }],
      table: {
        headers: ["Name", "Phone", "Blocks", "Visits Today"],
        rows: [["Amit Patil", "+91 98xxx", "Haveli", "3"]],
      },
    }),
  ],
  bids: [
    mock("bids", 0, {
      activeSidebar: "Tenders",
      windowTitle: "FlexHRM · Tenders",
      heading: "Tender Filings",
      toolbar: [{ kind: "button", label: "Add Tender", highlight: true }],
      table: {
        headers: ["Bid No", "Department", "End Date", "Amount"],
        rows: [["TND-2025-04", "Education Dept", "30 Jun", "₹12,00,000"]],
      },
    }),
    mock("bids", 1, {
      windowTitle: "FlexHRM · Contracts",
      activeSidebar: "Contracts",
      heading: "Active Contracts",
      table: {
        headers: ["Contract", "Party", "Start", "End", "Value"],
        rows: [["CTR-101", "ABC Corp", "01 Jan", "31 Dec", "₹24,00,000"]],
      },
    }),
    mock("bids", 2, {
      windowTitle: "FlexHRM · Car Papers",
      activeSidebar: "Renewals",
      heading: "Renewals — Car Papers",
      table: {
        headers: ["Vehicle", "Document", "Expiry", "Status"],
        rows: [["MH-12-AB-1234", "Insurance", "15 Jul", "Due soon"]],
      },
    }),
  ],
  roleAccess: [
    mock("roleAccess", 0, {
      heading: "Admin Accounts",
      toolbar: [{ kind: "button", label: "Grant Access", highlight: true }],
      panelLines: ["Username · Password · Role · Location limits"],
      table: {
        headers: ["Username", "Role", "Locations", "Status"],
        rows: [["hr.admin", "Super Admin", "All", "Active"]],
      },
    }),
    mock("roleAccess", 1, {
      heading: "Roles & Permissions",
      table: {
        headers: ["Module", "View", "Edit"],
        rows: [
          ["Employees", "✓", "✓"],
          ["Salary", "✓", "—"],
        ],
      },
      toolbar: [{ kind: "button", label: "Save Role", highlight: true }],
    }),
    mock("roleAccess", 2, {
      heading: "Activity Log",
      toolbar: [{ kind: "search", label: "Search audit logs..." }],
      table: {
        headers: ["Admin", "Action", "Time"],
        rows: [["hr.admin", "Updated employee EMP-001", "Today 10:42"]],
      },
    }),
    mock("roleAccess", 3, {
      heading: "Device Rules",
      panelLines: ["Blocked Android apps before Field Team login"],
      table: {
        headers: ["App Name", "Package ID"],
        rows: [["WhatsApp", "com.whatsapp"]],
      },
    }),
  ],
  supervisorApp: [
    mock("supervisorApp", 0, {
      heading: "Install FlexHRM Field Team",
      panelLines: ["Android APK · One device per account · Secure share only"],
    }),
    mock("supervisorApp", 1, {
      heading: "Supervisor Login",
      panelLines: ["Phone number · Password", "Device Rules check before sign-in"],
      toolbar: [{ kind: "button", label: "Sign In", highlight: true }],
    }),
    mock("supervisorApp", 2, {
      heading: "Today's Visits",
      table: {
        headers: ["School", "Block", "Status"],
        rows: [
          ["Govt. Primary School", "Haveli", "Check in"],
          ["ZP School No. 4", "Baramati", "Done ✓"],
        ],
      },
    }),
    mock("supervisorApp", 3, {
      heading: "Profile & Requests",
      panelLines: ["Update photo · Language · Submit leave request"],
      toolbar: [{ kind: "button", label: "My Profile", highlight: true }],
    }),
  ],
  portalTips: [
    mock("portalTips", 0, {
      heading: "Dashboard",
      toolbar: [
        { kind: "filter", label: "Month: June", highlight: true },
        { kind: "filter", label: "Year: 2025-2026", highlight: true },
      ],
      cards: [
        { label: "Active Employees", value: "142" },
        { label: "This Month Payroll", value: "₹4.8L" },
      ],
    }),
    mock("portalTips", 1, {
      heading: "Profile Menu",
      panelLines: [
        "My Account Profile",
        "System Tour",
        "Portal Settings",
        "Sign Out / Logout",
      ],
    }),
    mock("portalTips", 2, {
      heading: "Sidebar — Role Permissions",
      panelLines: ["Missing tab? Your role may lack View access.", "Ask super-admin under Role & Access"],
      sidebarItems: ["Dashboard", "Employees", "Attendance", "Salary (hidden)"],
    }),
    mock("portalTips", 3, {
      heading: "Notifications",
      toolbar: [{ kind: "button", label: "Bell · 3 unread", highlight: true }],
      panelLines: ["New supervisor request", "Visit photo uploaded", "Field team alert"],
    }),
  ],
};

export function getTourThumbnailMock(sectionId: string, stepIndex: number): TourThumbnailMock {
  const steps = STEP_MOCKS[sectionId];
  if (steps?.[stepIndex]) return steps[stepIndex];
  const fallback = SYSTEM_MOCK_DEFAULTS[sectionId] ?? SYSTEM_MOCK_DEFAULTS.portalTips;
  return {
    ...fallback,
    month: "June",
    year: "2025-2026",
    heading: fallback.windowTitle.replace("FlexHRM · ", ""),
  };
}
