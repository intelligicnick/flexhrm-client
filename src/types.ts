/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Employee {
  id: string; // internal UUID or unique code
  srNo: number;
  employeeCode: string; // Employees Code **
  location: string;
  nameAsPerAadhar: string; // EMPLOYEE NAME AS PER AADHAR ***
  grossSalary: number; // Gross Salary***
  basicSalary: number; // Basic Salary***
  esic: string; // ESIC (e.g. Yes / No / Exempt)
  uan: string; // UAN
  aadharNo: string; // AADHAR NO **
  nameAsPerAadharColumn: string; // NAME AS PER AADHAR **
  panNo: string; // PAN NO
  nameAsPerPan: string; // NAME AS PER PAN
  bankAccountNo: string; // BANK ACCOUNT NO **
  ifscCode: string; // IFSC CODE **
  nameAsPerBank: string; // EMPLOYEE NAME AS PER BANK **
  fatherName: string; // FATHER **
  husbandName: string; // HUSBAND NAME **
  pfJoiningDate: string; // PF JOINING DATE
  exitDate?: string; // EXIT/LEAVING DATE
  exitReason?: string; // REASON FOR EXIT / SEPARATION
  complianceEnabled?: boolean; // ENABLE STATUTORY COMPLIANCE
  /** PF wage basis: full monthly gross, or gross capped at ₹15,000 when gross ≥ ceiling */
  pfCalculationMode?: "gross" | "ceiling_15000";
  dateOfBirth: string; // DATE OF BIRTH
  gender: string; // GENDER **
  maritalStatus: string; // MARITAL STATUS **
  aadharLinkMobNo: string; // AADHAR LINK MOB.NO. **
  previousUanNo: string; // PREVIOUS UAN NO
  previousEsicNo: string; // PREVIOUS ESIC NO***
  presentAddress: string; // Present Address**
  permanentAddress: string; // Permanent Address**
  nomineeName: string; // Nominee Name (ESIC)
  nomineeDob: string; // Nominee DOB
  nomineeRelation: string; // Nominee Relation
  familyMember1Name: string;
  familyMember1Dob: string;
  familyMember1Relation: string;
  familyMember2Name: string;
  familyMember2Dob: string;
  familyMember2Relation: string;
  familyMember3Name: string;
  familyMember3Dob: string;
  familyMember3Relation: string;
  skillCategory?: string; // Highly Skilled / Skilled / Semi Skilled / Unskilled
  role?: string;
  dailyWage?: number;
  employeeMobile?: string;
  nomineeMobile?: string;
  familyMember1Mobile?: string;
  familyMember2Mobile?: string;
  familyMember3Mobile?: string;
  customFields?: Array<{ name: string; type: string; value: string }>;
  workingDaysType?: string; // Working Days Cycle (22Days / 26Days / 30-31Days)
  advance?: number;
  penalty?: number;
  uniform?: number;
  foodPerk?: number;
  accommodationPerk?: number;
  conveyancePerk?: number;
  monthlyLedger?: Record<string, {
    advance: number;
    penalty: number;
    uniform?: number;
    foodPerk: number;
    accommodationPerk: number;
    conveyancePerk: number;
    penaltyReason: string;
    paymentStatus?: "Unpaid" | "Paid" | "Hold";
  }>;
  photo?: string;
  idCard?: string;
  idCardGeneratedAt?: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  label: string;
  mimeType: string;
  filename: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  quality?: number;
  uploadedBy: string;
  createdAt: string;
}

export interface EmployeeChangeEntry {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  changes: Record<string, unknown>;
  previousSnapshot: Record<string, unknown>;
}

export interface EmployeeChangeRequest {
  id: string;
  submittedBy: string;
  status: "pending" | "approved" | "rejected";
  notes: string;
  reviewNotes: string;
  reviewedBy: string;
  reviewedAt?: string;
  updates: EmployeeChangeEntry[];
  employeeCount: number;
  fieldChangeCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export const EXCEL_ROW_HEADERS = [
  "SR NO",
  "Employees Code **",
  "EMPLOYEE NAME AS PER AADHAR ***",
  "Location",
  "Skill Category",
  "Job Role",
  "Working Days Cycle",
  "Gross Salary***",
  "Basic Salary***",
  "ESIC",
  "UAN",
  "AADHAR NO **",
  "NAME AS PER AADHAR **",
  "PAN NO",
  "NAME AS PER PAN",
  "BANK ACCOUNT NO **",
  "IFSC CODE **",
  "EMPLOYEE NAME AS PER BANK **",
  "FATHER **",
  "HUSBAND NAME **",
  "PF JOINING DATE",
  "DATE OF BIRTH",
  "GENDER **",
  "MARITAL STATUS **",
  "AADHAR LINK MOB.NO. **",
  "PREVIOUS UAN NO",
  "PREVIOUS ESIC NO***",
  "Present Address**",
  "Permanent Address**",
  "Nominee Name (ESIC)",
  "Nominee DOB",
  "Nominee Relation",
  "Family Member Name (1)",
  "Family Member DOB (1)",
  "Family Member Relation (1)",
  "Family Member Name (2)",
  "Family Member DOB (2)",
  "Family Member Relation (2)",
  "Family Member Name (3)",
  "Family Member DOB (3)",
  "Family Member Relation (3)",
  "Daily Wage",
  "Employee Mobile",
  "Nominee Mobile",
  "Family Member Mobile (1)",
  "Family Member Mobile (2)",
  "Family Member Mobile (3)"
];

export interface SchoolMaterialItem {
  item: string;
  qty: number;
  cost: number;
}

export interface SchoolMonthlyExpenseEntry {
  material: number;
  trek: number;
  miscellaneous: number;
  materialRemark?: string;
  trekRemark?: string;
  miscellaneousRemark?: string;
  materialDate?: string;
  trekDate?: string;
  miscellaneousDate?: string;
  materialItems?: SchoolMaterialItem[];
}

export interface SchoolMonthlyWorkdaysEntry {
  cleaningDays: number;
  billingToilets?: number;
}

export interface SchoolDistrict {
  id: string;
  name: string;
  deleted?: boolean;
}

export interface SchoolBlock {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  deleted?: boolean;
}

export interface SchoolWork {
  id: string;
  srNo: number;
  udise: string;
  schoolName: string;
  schoolCategory: string;
  headmasterName: string;
  headmasterNumber: string;
  sweeperName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  paymentMethod: string;
  noOfToilets: number;
  rates: number;
  govtUnitRate: number;
  partnerMonthlyPay: number;
  rateExplanation: string;
  block: string;
  district: string;
  assignedSupervisorId: string;
  materialCost: number;
  remarks: string;
  monthlyExpenseLedger?: Record<string, SchoolMonthlyExpenseEntry>;
  monthlyWorkdaysLedger?: Record<string, SchoolMonthlyWorkdaysEntry>;
}

export interface SchoolPartner {
  id: string;
  schoolWorkId: string;
  schoolName: string;
  partnerName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  perToiletPay: number;
  noOfToilets: number;
  monthlyPay: number;
  block: string;
  district: string;
  status: string;
  remarks?: string;
  monthlyPayLedger?: Record<string, { paymentStatus?: "Unpaid" | "Paid" | "Hold" }>;
}

export interface SchoolSupervisor {
  id: string;
  name: string;
  phone: string;
  assignedBlocks: string[];
  loginEnabled?: boolean;
  loginPhone?: string;
  status: string;
  hasRegisteredDevice?: boolean;
  profilePhotoBase64?: string;
  registeredDeviceId?: string;
  registeredDeviceName?: string;
  deviceRegisteredAt?: string | null;
  defaultLanguage?: "en" | "hi";
  email?: string;
  alternatePhone?: string;
  designation?: string;
  bio?: string;
  isOnline?: boolean;
  lastActiveAt?: string | null;
}

export interface SupervisorActivitySession {
  id: string;
  supervisorId: string;
  startedAt: string;
  endedAt: string | null;
  lastActiveAt: string;
  durationMinutes: number;
  isOngoing: boolean;
}

export interface SupervisorActivitySummary {
  todayMinutes: number;
  last7DaysMinutes: number;
  sessionCount: number;
}

export interface SupervisorActivityHistory {
  sessions: SupervisorActivitySession[];
  summary: SupervisorActivitySummary;
}

export interface PlannedVisit {
  id: string;
  supervisorId: string;
  schoolWorkId: string;
  schoolName: string;
  block: string;
  plannedDate: string;
  notes: string;
  status: "planned" | "completed" | "cancelled";
}

export interface CommitmentDiary {
  id: string;
  supervisorId: string;
  supervisorName: string;
  fromDate: string;
  toDate: string;
  schoolWorkId: string;
  schoolName: string;
  block: string;
  notes: string;
  adminNotes: string;
  status: "committed" | "in_progress" | "completed" | "cancelled";
  lastUpdatedBy: string;
  lastUpdatedByRole: "supervisor" | "admin";
  createdAt?: string;
  updatedAt?: string;
}

export interface SchoolBillingLineItem {
  schoolWorkId: string;
  udise: string;
  schoolName: string;
  schoolCategory: string;
  toilets: number;
  govtUnitRate: number;
  cleaningDays: number;
  totalCleanings: number;
  govtAmount: number;
  remarks: string;
}

export interface SchoolMonthlyBilling {
  id: string;
  block: string;
  district: string;
  monthKey: string;
  financialYear: string;
  cleaningDays: number;
  category: "elementary" | "secondary" | "all";
  schools: SchoolBillingLineItem[];
  totals: { schools: number; toilets: number; cleanings: number; amount: number };
}

export interface SchoolVisitPhoto {
  id: string;
  caption: string;
  mimeType: string;
  filename: string;
  photoDataBase64: string;
  takenAt: string;
  lat?: number;
  lng?: number;
  locationLabel?: string;
}

export interface SchoolVisit {
  id: string;
  supervisorId: string;
  supervisorName: string;
  schoolWorkId: string;
  schoolName: string;
  udise: string;
  block: string;
  visitDate: string;
  materialsGiven: { item: string; qty: number }[];
  notes: string;
  photos: SchoolVisitPhoto[];
  gpsLocation?: { lat: number; lng: number; locationLabel?: string };
  status: "submitted" | "approved" | "rejected";
  visitType?: "commitment" | "adhoc";
  commitmentId?: string;
}

export interface SupervisorRequestPhoto {
  id: string;
  caption: string;
  mimeType: string;
  filename: string;
  photoDataBase64: string;
  takenAt: string;
}

export interface SupervisorRequestSchool {
  id: string;
  schoolName: string;
  udise: string;
  block: string;
}

export interface SupervisorRequestFollowUp {
  id: string;
  message: string;
  photos: SupervisorRequestPhoto[];
  createdAt?: string;
}

export interface SupervisorRequest {
  id: string;
  supervisorId: string;
  supervisorName: string;
  schools: SupervisorRequestSchool[];
  message: string;
  photos: SupervisorRequestPhoto[];
  status: "pending" | "responded" | "closed" | "escalated";
  adminResponse: string;
  respondedBy: string;
  respondedAt?: string;
  supervisorReadAt?: string;
  followUps?: SupervisorRequestFollowUp[];
  escalationMessage?: string;
  escalatedAt?: string;
  escalationResolution?: string;
  escalationResolvedBy?: string;
  escalationResolvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NotificationType =
  | "commitment_created"
  | "commitment_overdue"
  | "commitment_reminder"
  | "commitment_admin_update"
  | "supervisor_request_new"
  | "supervisor_request_response"
  | "supervisor_request_escalated"
  | "visit_submitted"
  | "visit_reviewed"
  | "planned_visit_due"
  | "planned_visit_missed";

export interface AppNotification {
  id: string;
  recipientType: "admin" | "supervisor";
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  refType: string;
  refId: string;
  readAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const SCHOOL_CATEGORIES = [
  "Primary School",
  "Middle School",
  "High School",
  "UHS",
  "UMV",
  "UMS",
];

export const SCHOOL_EXCEL_ROW_HEADERS = [
  "SR NO",
  "School Name",
  "UDISE",
  "School Category",
  "Headmaster Name",
  "Headmaster Number",
  "Cleaning Partner",
  "Account Holder Name",
  "Account Number",
  "IFSC Code",
  "Payment Method",
  "No of Toilets",
  "Govt Unit Rate",
  "Partner Monthly Pay",
  "Rates",
  "Explanation for Rate",
  "Block",
  "District",
  "Material Cost",
  "Remarks",
];

export const SCHOOL_MATERIAL_ITEMS = [
  "Phenyl",
  "Brush",
  "Jhaadu",
  "Harpic",
  "Broom",
  "Mop",
];

export interface RolePermission {
  view: boolean;
  edit: boolean;
}

export interface CustomRole {
  name: string;
  description: string;
  permissions: {
    employees: RolePermission;
    schoolWork: RolePermission;
    salary: RolePermission;
    ledger: RolePermission;
    attendance: RolePermission;
    leave: RolePermission;
    birthdays: RolePermission;
    directory: RolePermission;
    admin: RolePermission;
  };
}

