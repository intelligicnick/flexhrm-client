import type { LucideIcon } from "lucide-react";
import {
  Users,
  Clock,
  Coins,
  Calculator,
  Contact,
  Cake,
  School,
  Gavel,
  Shield,
  Smartphone,
  FileText,
  LayoutDashboard,
  Archive,
  Landmark,
  RotateCw,
  ClipboardList,
  Compass,
  Wallet,
  Building2,
  Lock,
} from "lucide-react";

export interface TourStep {
  title: string;
  body: string;
  clicks?: string[];
  tip?: string;
}

export interface TourSection {
  id: string;
  categoryId: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  steps: TourStep[];
  sidebarTab?: string;
}

export interface TourCategory {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

/** Top-level groups — open one section at a time to avoid overlap */
export const SYSTEM_TOUR_CATEGORIES: TourCategory[] = [
  {
    id: "portal",
    title: "Portal Basics",
    description: "Layout, navigation, month bar, profile, and notifications.",
    icon: Compass,
  },
  {
    id: "hr",
    title: "HR & Employees",
    description: "Configuration, roster, onboarding, exits, and reports.",
    icon: Users,
  },
  {
    id: "payroll",
    title: "Payroll & Finance",
    description: "Monthly checklist, attendance, ledger, salary, and bank pay.",
    icon: Wallet,
  },
  {
    id: "people",
    title: "Directory & Birthdays",
    description: "Contact cards, helplines, and birthday planning.",
    icon: Contact,
  },
  {
    id: "school",
    title: "School Work & Field Team",
    description: "Schools, billing, expenses, supervisors, and mobile app.",
    icon: School,
  },
  {
    id: "business",
    title: "Bids & Compliance",
    description: "Tenders, contracts, renewals, and bank guarantees.",
    icon: Building2,
  },
  {
    id: "security",
    title: "Security & Access",
    description: "Admin accounts, roles, audit log, and device rules.",
    icon: Lock,
  },
];

export const SYSTEM_TOUR_SECTIONS: TourSection[] = [
  // ─── SECTION 1: PORTAL BASICS ───────────────────────────────────────────
  {
    id: "gettingStarted",
    categoryId: "portal",
    title: "Using the Portal",
    icon: Compass,
    summary: "Month bar, sidebar, search, profile menu, and notification bell.",
    steps: [
      {
        title: "Set month and year first",
        body: "The orange bar at the top controls which month Attendance, Salary, Ledger, and School Billing use. Set it before doing any month work.",
        clicks: [
          "Find the orange strip at the top of every page.",
          "Click Month ▾ → choose the working month (e.g. June).",
          "Click Year ▾ → choose the financial year (e.g. 2025-2026).",
          "Open Attendance or Salary and confirm the page shows the same month.",
        ],
        tip: "Wrong month = wrong payroll. Always check the orange bar first.",
      },
      {
        title: "Navigate with the sidebar",
        body: "The left sidebar lists all modules. School Work, Bids, and Renewals expand when you click the group name.",
        clicks: [
          "Click any module name to open it (e.g. Employees, Salary).",
          "For grouped menus: click School Work ▾ → then Schools, Field Team, etc.",
          "Use the search box at the top of the sidebar to filter modules by name.",
          "Mobile: tap the hamburger icon (top-left) to open the menu.",
        ],
        tip: "Missing a menu item? Your role may lack View permission — see Security & Access.",
      },
      {
        title: "Profile menu and notifications",
        body: "Account settings live under your name (top-right). The bell icon shows Field Team alerts when you have School Work access.",
        clicks: [
          "Click your username (top-right) → My Account Profile for password and recovery email.",
          "Same menu → System Tour (this guide) or Portal Settings.",
          "Click the bell icon → read alerts → click a row to jump to Field Team.",
        ],
        tip: "Set a recovery email so you can reset your password from the login page.",
      },
    ],
  },
  {
    id: "dashboard",
    categoryId: "portal",
    title: "Dashboard",
    icon: LayoutDashboard,
    summary: "KPI overview, action items, and quick shortcuts to every module.",
    sidebarTab: "Dashboard",
    steps: [
      {
        title: "Open and read the Dashboard",
        body: "Dashboard is your home screen — employee counts, payroll totals, attendance rate, pending alerts, and quick links.",
        clicks: [
          "Sidebar → click Dashboard.",
          "Scan KPI cards: Active Employees, Net Payroll, Attendance Rate, Renewals Alert.",
          "Check Action Required for pending tasks (requests, renewals, bulk edits).",
        ],
        tip: "Widgets hide automatically if your role cannot view that module.",
      },
      {
        title: "Act on alerts and use quick links",
        body: "Action Required rows are clickable — they take you straight to the module that needs attention.",
        clicks: [
          "Scroll to Action Required → click any alert → complete the task.",
          "Click a KPI card (e.g. Net Payroll) → opens Salary.",
          "Use the Quick Links grid for one-click access to Employees, Schools, Tenders, etc.",
        ],
      },
      {
        title: "Field Team shortcuts on Dashboard",
        body: "Review supervisor work without digging through School Work every time.",
        clicks: [
          "Hero area → click Visits, Requests, or Commitment Diary.",
          "Each button opens Field Team on the correct tab.",
          "Pair with the notification bell for fastest response.",
        ],
        tip: "Request badge shows how many supervisor messages are pending.",
      },
    ],
  },

  // ─── SECTION 2: HR & EMPLOYEES ──────────────────────────────────────────
  {
    id: "employees",
    categoryId: "hr",
    title: "Employees",
    icon: Users,
    summary: "Setup configuration, manage roster, add staff, import CSV, and handle exits.",
    sidebarTab: "Employees",
    steps: [
      {
        title: "Configuration (do this first)",
        body: "Before adding staff or running payroll, set up payroll rules, bank accounts, locations, roles, and school districts.",
        clicks: [
          "Sidebar → Employees → sub-tab Configuration.",
          "Payroll Rules → set ESIC ceiling and basic % → Save Payroll Rules.",
          "Bank Accounts → Add account → mark one as Default (needed for Bulk Pay).",
          "Office Locations → Add Location. Job Roles → Add Role.",
          "For schools: District & Blocks → add districts and blocks.",
        ],
        tip: "No default bank account = Bulk Pay from Salary will fail.",
      },
      {
        title: "Employee List and filters",
        body: "Your master roster. Search by code, name, Aadhar, UAN, or PAN. Filter by status, location, and role.",
        clicks: [
          "Employees → sub-tab Employee List.",
          "Search bar → type employee code or name.",
          "Status filter → Active Staff (default), Exited Staff, Eligible for Exit, or All.",
          "Click edit (pencil) on a row to open the employee form.",
        ],
        tip: "Exited Staff = people who left. They are hidden from Active payroll views.",
      },
      {
        title: "Add one employee or import CSV",
        body: "Add individually via the form, or bulk-import using the CSV template on Employee List.",
        clicks: [
          "Single: sub-tab Add Employee → fill form → Save Employee.",
          "Bulk: Employee List → Download CSV Template → fill in Excel.",
          "Upload CSV File → fix red error rows in preview → Confirm Import.",
        ],
        tip: "Locations and roles must exist in Configuration before assigning them.",
      },
      {
        title: "Mark exit and run reports",
        body: "When someone leaves, set an exit date. Use Reports for custom filtered exports.",
        clicks: [
          "Exit: edit employee → Exit / Leaving Date + reason → Save.",
          "Bulk exit: select rows → Mark Exit → enter date and reason.",
          "Reports sub-tab → set filters → choose columns → Export CSV / Excel / PDF.",
        ],
        tip: "After exit date, attendance days lock as — and are excluded from salary.",
      },
    ],
  },

  // ─── SECTION 3: PAYROLL & FINANCE ─────────────────────────────────────────
  {
    id: "monthlyPayroll",
    categoryId: "payroll",
    title: "Monthly Payroll Checklist",
    icon: Coins,
    summary: "The full month-end flow in order — follow these four steps every payroll cycle.",
    sidebarTab: "Attendance",
    steps: [
      {
        title: "① Confirm setup",
        body: "Verify configuration and employee data before starting the payroll month.",
        clicks: [
          "Employees → Configuration → locations, roles, payroll rules, default bank.",
          "Employee List → all active staff present with correct salaries and bank details.",
        ],
        tip: "Fix missing UAN or bank accounts before marking attendance.",
      },
      {
        title: "② Mark attendance",
        body: "Complete the full month register. Salary calculates from these marks.",
        clicks: [
          "Set Month + Year in orange bar.",
          "Attendance → mark each day P (Present) or A (Absent). Blank (—) = not counted.",
          "Use Bulk Mark Attendance for holidays or branch-wide marks.",
        ],
      },
      {
        title: "③ Record ledger entries",
        body: "Enter advances, penalties, and perks, then settle into salary.",
        clicks: [
          "Advance & Penalty → select employees → enter amounts → Save.",
          "Click batch settlement before opening Salary.",
        ],
      },
      {
        title: "④ Run salary and bank pay",
        body: "Review net pay, export, and generate the Axis bank file.",
        clicks: [
          "Salary → verify Present Days and Net Payable.",
          "Export CSV/PDF for records OR click Bulk Pay for Axis .xls.",
          "Saved Bulk Pay → re-download archived file if needed.",
        ],
        tip: "Do not change Month + Year mid-process — use the same period throughout.",
      },
    ],
  },
  {
    id: "attendance",
    categoryId: "payroll",
    title: "Attendance",
    icon: Clock,
    summary: "Daily grid marking, bulk wizard, filters, and export.",
    sidebarTab: "Attendance",
    steps: [
      {
        title: "Open the attendance grid",
        body: "Each cell = one employee on one day. Only P and A marks count toward salary.",
        clicks: [
          "Confirm Month + Year in orange bar.",
          "Sidebar → Attendance.",
          "Click a cell → choose P, A, H (Holiday), or leave blank (—).",
        ],
        tip: "Exited employees: days after exit date auto-lock and cannot be edited.",
      },
      {
        title: "Bulk Mark Attendance wizard",
        body: "Mark many employees across multiple dates — ideal for public holidays.",
        clicks: [
          "Click Bulk Mark Attendance.",
          "Step 1: Select staff (location, role, employees) → Next.",
          "Step 2: Select dates on calendar → Next.",
          "Step 3: Confirm & Mark Bulk Present (or Absent).",
        ],
      },
      {
        title: "Filter and export",
        body: "Narrow by location or role when marking one branch. Export when the month is complete.",
        clicks: [
          "Use search, Location, Role, and Skill filters.",
          "Export Excel (Landscape) or Export PDF (Landscape) for records.",
        ],
      },
    ],
  },
  {
    id: "ledger",
    categoryId: "payroll",
    title: "Advance & Penalty",
    icon: Calculator,
    summary: "Record advances, penalties, perks, and settle into salary.",
    sidebarTab: "Advance & Penalty",
    steps: [
      {
        title: "Select employees and enter amounts",
        body: "Split layout: checklist on the left, entry form on the right. Entries tie to the month in the orange bar.",
        clicks: [
          "Set Month + Year → Sidebar → Advance & Penalty.",
          "Left panel: tick employee checkboxes (filter by location/role first).",
          "Right panel: choose Advance, Penalty, or Perk → enter amount → Save Entry.",
        ],
        tip: "Advances increase pay owed; penalties reduce net pay.",
      },
      {
        title: "Review totals and settle",
        body: "Summary cards show month totals. Settle before running Salary so net pay is correct.",
        clicks: [
          "Check Advance, Penalty, and Perk totals in summary cards.",
          "Click Save batch settlement (Settle Selected for [Month]).",
          "Open Salary → confirm Net Payable updated for those employees.",
        ],
      },
    ],
  },
  {
    id: "salary",
    categoryId: "payroll",
    title: "Salary",
    icon: Coins,
    summary: "Review calculated payroll, filter, export, payment status, and Bulk Pay.",
    sidebarTab: "Salary",
    steps: [
      {
        title: "Verify the salary sheet",
        body: "Salary auto-calculates from attendance, ledger, and employee data. Check Present Days before exporting.",
        clicks: [
          "Confirm Month + Year → Sidebar → Salary.",
          "Read summary: Gross Payroll, Net Payable, Deductions.",
          "If Present Days look wrong → go back to Attendance first.",
        ],
        tip: "Blank attendance (—) does not count as a present day.",
      },
      {
        title: "Filter and export",
        body: "Filter by location, role, or payment status when paying one branch at a time.",
        clicks: [
          "Open filter panel → set Location, Role, Payment Status.",
          "Export CSV, Excel, or PDF (respects filters and row selection).",
          "Mark Payment Status per row: Unpaid, Paid, or Hold.",
        ],
      },
      {
        title: "Generate Axis Bulk Pay",
        body: "Creates a bank-ready .xls file. Requires a default debit account in Configuration.",
        clicks: [
          "Employees → Configuration → Bank Accounts → confirm Default account set.",
          "Salary → click Bulk Pay → file downloads and archives automatically.",
          "Banner after export → View All → Saved Bulk Pay.",
        ],
      },
    ],
  },
  {
    id: "savedBulkPay",
    categoryId: "payroll",
    title: "Saved Bulk Pay",
    icon: Archive,
    summary: "Archive of Axis bank files — view, re-download, or delete past exports.",
    sidebarTab: "Saved Bulk Pay",
    steps: [
      {
        title: "Browse and re-download bank files",
        body: "Every Bulk Pay from Salary is stored here with date, month, record count, and total amount.",
        clicks: [
          "Sidebar → Saved Bulk Pay.",
          "Filter by Year → click Refresh after a new export.",
          "Click View (Excel preview), Re-download (.xls for bank), or Delete.",
        ],
        tip: "If empty, generate your first file from Salary → Bulk Pay.",
      },
    ],
  },

  // ─── SECTION 4: DIRECTORY & BIRTHDAYS ───────────────────────────────────
  {
    id: "directory",
    categoryId: "people",
    title: "Directory",
    icon: Contact,
    summary: "Employee contact cards and important helpline numbers.",
    sidebarTab: "Directory",
    steps: [
      {
        title: "Employee Profiles tab",
        body: "Contact cards for active employees with phone numbers. Data comes from the employee master.",
        clicks: [
          "Sidebar → Directory → Employee Profiles tab.",
          "Search or filter by location / gender.",
          "Click a card → click-to-call on mobile.",
        ],
        tip: "Update phone numbers in Employees → edit row.",
      },
      {
        title: "Important Helplines tab",
        body: "Store emergency numbers and vendor contacts separate from employee records.",
        clicks: [
          "Directory → Important Helplines tab.",
          "Fill Name, Phone, Role, Category, Location → Add Helpline.",
          "Delete outdated contacts from the list.",
        ],
      },
    ],
  },
  {
    id: "birthdays",
    categoryId: "people",
    title: "Birthdays",
    icon: Cake,
    summary: "Monthly birthday list and today’s celebration banner.",
    sidebarTab: "Birthdays",
    steps: [
      {
        title: "View birthdays by month",
        body: "Plan greetings and celebrations. Today’s birthdays appear highlighted at the top.",
        clicks: [
          "Sidebar → Birthdays.",
          "Use month picker to select a fiscal month.",
          "Today's birthdays show at top → click Celebrate for confetti.",
          "Scroll the list for upcoming dates in that month.",
        ],
        tip: "Today's birthdays also appear on the Dashboard.",
      },
    ],
  },

  // ─── SECTION 5: SCHOOL WORK & FIELD TEAM ──────────────────────────────────
  {
    id: "schoolWork",
    categoryId: "school",
    title: "School Work",
    icon: School,
    summary: "School registry, monthly billing, partner pay, and expenses.",
    sidebarTab: "Schools",
    steps: [
      {
        title: "Register schools",
        body: "Add schools with district, block, and partner. Set up districts in Employees → Configuration first.",
        clicks: [
          "Employees → Configuration → District & Blocks.",
          "School Work → Schools → Add School or Import Excel.",
        ],
        tip: "Complete school registry before generating invoices.",
      },
      {
        title: "Monthly Billing",
        body: "Create Invoice generates bills by block. View Saved browses past invoices. Partner Pay handles partner payments.",
        clicks: [
          "School Work → Monthly Billing.",
          "Create Invoice → pick block → Generate → Save.",
          "View Saved → find period → Export PDF.",
          "Partner Pay → Bulk Pay → file saves to Saved School Bulk Pay.",
        ],
      },
      {
        title: "Expenses and Saved School Bulk Pay",
        body: "Log school costs and re-download archived partner bank files.",
        clicks: [
          "School Work → Expenses → Add Expense (school, amount, notes).",
          "School Work → Saved School Bulk Pay → View / Re-download.",
        ],
      },
    ],
  },
  {
    id: "fieldTeam",
    categoryId: "school",
    title: "Field Team (Admin Web)",
    icon: ClipboardList,
    summary: "Supervisors, visit approval, requests, and commitment diary.",
    sidebarTab: "Field Team",
    steps: [
      {
        title: "Four tabs overview",
        body: "Field Team lives under School Work. Four views: Visits, Supervisors, Requests, Commitment Diary.",
        clicks: [
          "School Work → Field Team (or Dashboard shortcuts).",
          "Visits — approve/reject supervisor reports.",
          "Supervisors — add accounts for the mobile app.",
          "Requests — respond to supervisor messages.",
          "Commitment Diary — track scheduled visit commitments.",
        ],
        tip: "Notification bell clicks open the matching tab directly.",
      },
      {
        title: "Add supervisor and approve visits",
        body: "Create mobile app accounts, then review submitted visit photos and notes.",
        clicks: [
          "Supervisors tab → Add Supervisor → name, phone, password, blocks → Save.",
          "Visits tab → filter Submitted → expand row → Approve or Reject.",
        ],
      },
      {
        title: "Handle requests and commitments",
        body: "Respond to supervisor leave/issue requests. Follow up on overdue commitments.",
        clicks: [
          "Requests tab → click request → Respond → Close when done.",
          "Commitment Diary → update status or add admin notes on overdue items.",
        ],
      },
    ],
  },
  {
    id: "supervisorApp",
    categoryId: "school",
    title: "Field Team Mobile App",
    icon: Smartphone,
    summary: "Supervisor Android app — install, login, visits, and requests.",
    steps: [
      {
        title: "Install and log in",
        body: "One device per account on first login. Uninstall blocked apps if Device Rules are configured.",
        clicks: [
          "Admin shares FlexHRM Field Team APK securely.",
          "Supervisor installs on Android → opens app.",
          "Enter phone + password (set in Field Team → Supervisors) → Sign In.",
        ],
        tip: "Device Rules (Security section) block certain apps before login.",
      },
      {
        title: "Daily visits and requests",
        body: "Check in at schools with photos and notes. Raise requests that appear in admin Field Team → Requests.",
        clicks: [
          "Home → Today's Visits → tap visit → Check In → photos → Submit.",
          "Calendar → view commitments and planned dates.",
          "Requests → Raise Request → admin responds in web portal.",
        ],
      },
    ],
  },

  // ─── SECTION 6: BIDS & COMPLIANCE ─────────────────────────────────────────
  {
    id: "bids",
    categoryId: "business",
    title: "Tenders & Contracts",
    icon: Gavel,
    summary: "Track tender filings, deadlines, and active contracts.",
    sidebarTab: "Tenders",
    steps: [
      {
        title: "Manage tenders",
        body: "Record bids with department, dates, and amounts. Stat cards filter by status.",
        clicks: [
          "Bids → Tenders.",
          "Click stat card: Upcoming, Filed, Qualified, etc.",
          "Add Tender or Import Excel → fill details → Save.",
        ],
        tip: "Needs Attention banner flags deadlines within 7 days.",
      },
      {
        title: "Manage contracts",
        body: "Record agreements linked to won tenders. Connect to BG & DD when guarantees are required.",
        clicks: [
          "Bids → Contracts → Add Contract.",
          "Fill party, dates, value → link source tender if applicable.",
        ],
      },
    ],
  },
  {
    id: "renewals",
    categoryId: "business",
    title: "Renewals",
    icon: RotateCw,
    summary: "Car papers, IT domains/servers, and license expiry tracking.",
    sidebarTab: "Car Papers",
    steps: [
      {
        title: "Car Papers",
        body: "Vehicle registration, insurance, and document expiry.",
        clicks: [
          "Renewals → Car Papers.",
          "Add Renewal → vehicle, document, expiry → Save.",
          "Click Expiring Soon or Expired stat cards weekly.",
        ],
      },
      {
        title: "IT Renewals and Licenses",
        body: "Domains, servers, software licenses, and permits.",
        clicks: [
          "Renewals → IT Renewals → Add Renewal (domain, owner, expiry).",
          "Renewals → Licenses → Add Renewal or Import Excel.",
        ],
        tip: "Dashboard Renewals Alert KPI links here when items are due.",
      },
    ],
  },
  {
    id: "bgDd",
    categoryId: "business",
    title: "BG & DD",
    icon: Landmark,
    summary: "Bank guarantees and demand drafts linked to contracts.",
    sidebarTab: "BG & DD",
    steps: [
      {
        title: "Register and track BG / DD",
        body: "Track instrument number, beneficiary, bank, amount, expiry, and linked contract.",
        clicks: [
          "Sidebar → BG & DD.",
          "Add BG / DD → type, number, beneficiary, bank, amount, expiry → Save.",
          "Upload documents on each row for audit trail.",
          "Monitor Expiring Soon and Expired stat cards.",
        ],
        tip: "Link records to Bids → Contracts when the guarantee supports a contract.",
      },
    ],
  },

  // ─── SECTION 7: SECURITY & ACCESS ───────────────────────────────────────
  {
    id: "roleAccess",
    categoryId: "security",
    title: "Role & Access",
    icon: Shield,
    summary: "Invite admins, define roles, audit log, and mobile device rules.",
    sidebarTab: "Role & Access",
    steps: [
      {
        title: "Invite and manage admins",
        body: "Create login accounts with a role and optional location limits.",
        clicks: [
          "Role & Access → Admin Accounts.",
          "Fill Username, Password, Role → optional location checkboxes.",
          "Click Grant Administrator Access.",
          "Configure existing admins: change role, disable login, adjust locations.",
        ],
        tip: "Empty location checkboxes = access to all branches.",
      },
      {
        title: "Create roles and permissions",
        body: "View = see the menu. Edit = save changes. Assign roles when inviting admins.",
        clicks: [
          "Roles & Permissions tab → enter Role Name.",
          "Tick View and/or Edit per module row.",
          "Save role permissions.",
        ],
        tip: "Example: HR Assistant — View+Edit on Employees & Attendance, View-only Salary.",
      },
      {
        title: "Activity Log and Device Rules",
        body: "Audit trail of all changes. Device Rules block Android apps before Field Team login.",
        clicks: [
          "Activity Log → search, filter, expand rows, Export Excel/PDF.",
          "Device Rules → Add blocked app → App Name + Package ID (e.g. com.whatsapp).",
        ],
        tip: "Only super-admin can flush the Activity Log.",
      },
    ],
  },
];

/** Flat list in category order — used for next/prev navigation */
export function getOrderedTourSections(): TourSection[] {
  const order = SYSTEM_TOUR_CATEGORIES.map((c) => c.id);
  return [...SYSTEM_TOUR_SECTIONS].sort(
    (a, b) => order.indexOf(a.categoryId) - order.indexOf(b.categoryId),
  );
}

export function getSectionsForCategory(categoryId: string): TourSection[] {
  return SYSTEM_TOUR_SECTIONS.filter((s) => s.categoryId === categoryId);
}

export function getCategoryForSection(sectionId: string): TourCategory | undefined {
  const section = SYSTEM_TOUR_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return undefined;
  return SYSTEM_TOUR_CATEGORIES.find((c) => c.id === section.categoryId);
}

export const MY_INFO_TABS = ["account", "tour"] as const;
export type MyInfoTab = (typeof MY_INFO_TABS)[number];

export const ROLE_ACCESS_SECTIONS = [
  { id: "admins", label: "Admin Accounts", icon: Users },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
  { id: "audit", label: "Activity Log", icon: FileText },
  { id: "devices", label: "Device Rules", icon: Smartphone },
] as const;

export type RoleAccessSection = (typeof ROLE_ACCESS_SECTIONS)[number]["id"];
