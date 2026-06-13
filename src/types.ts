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

export interface SchoolMonthlyExpenseEntry {
  material: number;
  miscellaneous: number;
  materialRemark?: string;
  miscellaneousRemark?: string;
}

export interface SchoolWork {
  id: string;
  srNo: number;
  udise: string;
  schoolName: string;
  headmasterName: string;
  headmasterNumber: string;
  sweeperName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  noOfToilets: number;
  rates: number;
  rateExplanation: string;
  block: string;
  district: string;
  materialCost: number;
  remarks: string;
  monthlyExpenseLedger?: Record<string, SchoolMonthlyExpenseEntry>;
}

export const SCHOOL_EXCEL_ROW_HEADERS = [
  "SR NO",
  "School Name",
  "UDISE",
  "Headmaster Name",
  "Headmaster Number",
  "Sweeper Name",
  "Account Holder Name",
  "Account Number",
  "IFSC Code",
  "No of Toilets",
  "Rates",
  "Explanation for Rate",
  "Block",
  "District",
  "Material Cost",
  "Remarks",
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

