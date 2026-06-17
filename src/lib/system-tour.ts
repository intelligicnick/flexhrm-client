import type { LucideIcon } from "lucide-react";
import {
  Users,
  Clock,
  Coins,
  Calculator,
  CalendarOff,
  Contact,
  School,
  Gavel,
  Shield,
  Smartphone,
  Settings,
  FileText,
} from "lucide-react";

export interface TourStep {
  title: string;
  body: string;
  tip?: string;
}

export interface TourSection {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  steps: TourStep[];
  sidebarTab?: string;
}

export const SYSTEM_TOUR_SECTIONS: TourSection[] = [
  {
    id: "employees",
    title: "Employees",
    icon: Users,
    summary: "Add staff, keep records updated, and prepare data for payroll.",
    sidebarTab: "Employees",
    steps: [
      {
        title: "Open the employee list",
        body: "Go to Employees → Employee List. This is your main roster. Use the search bar and filters (location, role, status) to find people quickly.",
        tip: "Default view shows Active staff only. Switch to Exited Staff to see people who have left.",
      },
      {
        title: "Add or edit an employee",
        body: "Click Add Employee for someone new, or the edit icon on a row. Fill in name, code, location, role, salary details, and photo. Click Save when done.",
        tip: "Set up office locations and job roles first under Employees → Configuration.",
      },
      {
        title: "Import many employees at once",
        body: "On Employee List, use the CSV import tool. Download the template, fill it in Excel, then upload. The system will validate rows before saving.",
        tip: "Fix any red error rows in the preview before confirming the import.",
      },
      {
        title: "Set up configuration",
        body: "Before payroll, open Employees → Configuration. Add payroll rules, bank accounts for bulk pay, office locations, and job roles.",
        tip: "Mark a bank account as default if you plan to use Saved Bulk Pay.",
      },
    ],
  },
  {
    id: "attendance",
    title: "Attendance",
    icon: Clock,
    summary: "Mark who was present or absent each day. Salary uses these marks.",
    sidebarTab: "Attendance",
    steps: [
      {
        title: "Select the correct month",
        body: "Use the Month and Year selectors in the orange top bar. The attendance grid always shows the month you pick there.",
        tip: "Attendance and Salary both follow the same month selection.",
      },
      {
        title: "Mark each day",
        body: "In the grid, click a cell and choose P (Present), A (Absent), or leave it blank (—). Blank days do not count in salary.",
        tip: "Only days you explicitly mark as P or A are counted.",
      },
      {
        title: "Use bulk marking for holidays",
        body: "Click Bulk Mark Attendance. Pick a date range, choose Present or Absent, filter by location/role if needed, then apply to many employees at once.",
        tip: "Great for marking a public holiday as absent for everyone in one go.",
      },
      {
        title: "Export records",
        body: "Download attendance as CSV or PDF for your records or audits.",
        tip: "Export after you finish marking the full month.",
      },
    ],
  },
  {
    id: "salary",
    title: "Salary",
    icon: Coins,
    summary: "Review monthly pay, deductions, and export for bank transfer.",
    sidebarTab: "Salary",
    steps: [
      {
        title: "Open the salary sheet",
        body: "Go to Salary and confirm the month matches your attendance. The sheet calculates gross pay, PF, ESIC, PT, and net pay per employee.",
        tip: "If presents look wrong, go back to Attendance and mark missing days first.",
      },
      {
        title: "Filter before exporting",
        body: "Use filters (location, role, payment status) to narrow the list. This helps when paying one branch or role at a time.",
        tip: "Clear filters to see the full company payroll.",
      },
      {
        title: "Export CSV or PDF",
        body: "Click Export CSV or PDF to download the payroll sheet for accounts or records.",
        tip: "CSV is best for Excel; PDF is best for printing or sharing.",
      },
      {
        title: "Save bulk bank payment",
        body: "Generate an Axis bulk pay file, then save it under Saved Bulk Pay for future reference.",
        tip: "You need a default debit account in Configuration → Bank Accounts.",
      },
    ],
  },
  {
    id: "ledger",
    title: "Advance & Penalty",
    icon: Calculator,
    summary: "Record money given in advance or penalties to deduct from salary.",
    sidebarTab: "Advance & Penalty",
    steps: [
      {
        title: "Pick employees",
        body: "Use the checklist on the left to select employees. You can filter by location or role first.",
        tip: "Select All matches only employees visible after your filters.",
      },
      {
        title: "Enter amounts",
        body: "Choose Advance or Penalty, type the amount, and save. Each entry is tied to the month selected in the top bar.",
        tip: "Advances increase what you owe the employee; penalties reduce their pay.",
      },
      {
        title: "Settle at month-end",
        body: "Use batch settlement to apply pending ledger entries onto the salary sheet for the current month.",
        tip: "Settle before finalizing salary export so net pay is correct.",
      },
    ],
  },
  {
    id: "leave",
    title: "Leave",
    icon: CalendarOff,
    summary: "Track employee leave by month.",
    sidebarTab: "Leave",
    steps: [
      {
        title: "View leave register",
        body: "Open Leave and select the month. You will see leave entries for employees in that period.",
        tip: "Use the same month selector in the top bar as other modules.",
      },
      {
        title: "Add or update leave",
        body: "Add new leave records or edit existing ones for employees as your policy requires.",
        tip: "Coordinate with attendance — some teams mark leave in attendance as L or A.",
      },
    ],
  },
  {
    id: "directory",
    title: "Directory & Birthdays",
    icon: Contact,
    summary: "Quick contacts and birthday reminders.",
    sidebarTab: "Directory",
    steps: [
      {
        title: "Manage directory contacts",
        body: "Open Directory to add helpline numbers and contact cards. Include name, phone, role, and location.",
        tip: "Useful for emergency numbers and vendor contacts.",
      },
      {
        title: "Check birthdays",
        body: "Open Birthdays and pick a month to see whose birthday falls in that period.",
        tip: "Plan greetings or small celebrations ahead of time.",
      },
    ],
  },
  {
    id: "schoolWork",
    title: "School Work",
    icon: School,
    summary: "Schools, billing, expenses, and field supervisors.",
    sidebarTab: "Schools",
    steps: [
      {
        title: "Register schools",
        body: "Under School Work → Schools, add each school with district, block, and partner details. Import from Excel or add manually.",
        tip: "Set up districts and blocks in Employees → Configuration first.",
      },
      {
        title: "Monthly billing",
        body: "Go to Monthly Billing to create invoices and partner payment sheets for each billing cycle.",
        tip: "Confirm school data is complete before generating bills.",
      },
      {
        title: "Track expenses",
        body: "Under Expenses, log material and miscellaneous costs with amounts and notes.",
        tip: "Attach receipt details in notes for audit trail.",
      },
      {
        title: "Manage field team",
        body: "Field Team lets you add supervisors, assign blocks, review visits, and handle supervisor requests.",
        tip: "Supervisors use the FlexHRM Field Team mobile app for daily visits.",
      },
    ],
  },
  {
    id: "bids",
    title: "Bids & Renewals",
    icon: Gavel,
    summary: "Tenders, contracts, and renewal deadlines.",
    sidebarTab: "Tenders",
    steps: [
      {
        title: "Track tenders",
        body: "Under Bids → Tenders, add tender filings with bid number, department, dates, and amounts.",
        tip: "Set end dates so you can follow up before deadlines.",
      },
      {
        title: "Manage contracts",
        body: "Under Contracts, record active agreements with key dates and values.",
        tip: "Link contracts to the tender they came from when possible.",
      },
      {
        title: "Watch renewals",
        body: "Renewals covers car papers, IT domains/servers, and licenses. Add expiry dates to get ahead of renewals.",
        tip: "Check Renewals weekly so nothing expires unnoticed.",
      },
    ],
  },
  {
    id: "roleAccess",
    title: "Role & Access",
    icon: Shield,
    summary: "Who can log in and what they are allowed to do.",
    sidebarTab: "Role & Access",
    steps: [
      {
        title: "Invite administrators",
        body: "Open Role & Access → Admin Accounts. Enter username, temporary password, role, and optional location limits. Click Grant Access.",
        tip: "Leave locations unchecked to give access to all branches.",
      },
      {
        title: "Create custom roles",
        body: "Go to Roles & Permissions. Name the role, then tick View (see the menu) and Edit (save changes) per module.",
        tip: "Example: HR Assistant — View+Edit on Employees and Attendance, View only on Salary.",
      },
      {
        title: "Review activity log",
        body: "The Activity Log tab shows who logged in and what they changed — useful for security checks.",
        tip: "Only super-admins can flush the log.",
      },
      {
        title: "Set device rules",
        body: "Device Rules lists Android apps supervisors must uninstall before using the Field Team app.",
        tip: "Use package IDs like com.whatsapp for reliable detection.",
      },
    ],
  },
  {
    id: "supervisorApp",
    title: "Field Team App",
    icon: Smartphone,
    summary: "Mobile app for supervisors — visits, photos, and check-ins.",
    steps: [
      {
        title: "Install the app",
        body: "Supervisors install FlexHRM Field Team (APK) on their Android phone. Each account locks to one device on first login.",
        tip: "Share the APK file securely — do not post it publicly.",
      },
      {
        title: "Log in",
        body: "Use the phone number and password set by admin. If Device Rules block certain apps, uninstall them first.",
        tip: "Blocked apps screen appears automatically before login if configured.",
      },
      {
        title: "Daily visits",
        body: "Home shows today's work. Calendar lists scheduled visits. Tap a visit to check in, take photos, and add notes.",
        tip: "Good photos and notes help admins review visit quality.",
      },
      {
        title: "Profile & requests",
        body: "Supervisors update photo and language in Profile. Leave or issue requests appear in admin under Field Team → Requests.",
        tip: "Admins get bell notifications for new supervisor requests.",
      },
    ],
  },
  {
    id: "portalTips",
    title: "Portal tips",
    icon: Settings,
    summary: "Essential tips for the admin web portal.",
    steps: [
      {
        title: "Month and year bar",
        body: "The orange top bar sets the active month and financial year. Attendance, salary, ledger, and more follow this selection.",
        tip: "Always check the month before marking attendance or running payroll.",
      },
      {
        title: "Your profile menu",
        body: "Click your name (top right) for My Account Profile, System Tour, Portal Settings, and Sign Out.",
        tip: "Set a recovery email so you can reset password from the login page.",
      },
      {
        title: "Missing menu items",
        body: "If you cannot see a sidebar tab, your role may not have View permission for that module.",
        tip: "Ask a super-admin to update your role under Role & Access.",
      },
      {
        title: "Notifications",
        body: "The bell icon shows field-team alerts — new visits, requests, and updates — when you have School Work access.",
        tip: "Click a notification to jump to the relevant screen.",
      },
    ],
  },
];

export const MY_INFO_TABS = ["account", "tour"] as const;
export type MyInfoTab = (typeof MY_INFO_TABS)[number];

export const ROLE_ACCESS_SECTIONS = [
  { id: "admins", label: "Admin Accounts", icon: Users },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
  { id: "audit", label: "Activity Log", icon: FileText },
  { id: "devices", label: "Device Rules", icon: Smartphone },
] as const;

export type RoleAccessSection = (typeof ROLE_ACCESS_SECTIONS)[number]["id"];
