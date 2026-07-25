/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Employee {
  id: string; // internal UUID or unique code
  srNo: number;
  employeeCode: string; // Employees Code **
  location: string;
  /** Contract resolved from office location (not set directly on employee) */
  contractId?: string;
  nameAsPerAadhar: string; // EMPLOYEE NAME AS PER AADHAR ***
  grossSalary: number; // Gross Salary***
  basicSalary: number; // Basic Salary***
  esic: string; // ESIC (e.g. Yes / Apply Above 21000 / No / Exempt)
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
  complianceEnabled?: boolean; // ENABLE PF/ESIC COMPLIANCE
  ptEnabled?: boolean; // ENABLE PROFESSIONAL TAX (where applicable by state/location)
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
  /** Whether payroll uses a fixed monthly gross or a per-day daily wage */
  salaryWageMode?: "monthly" | "daily";
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
    ledgerItems?: Array<{
      id: string;
      type: "advance" | "penalty" | "uniform" | "foodPerk" | "accommodationPerk" | "conveyancePerk";
      amount: number;
      entryDate: string;
      note: string;
    }>;
  }>;
  photo?: string;
  photoUrl?: string;
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
  imagekitUrl?: string;
}

export interface EmployeeChangeEntry {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  changes: Record<string, unknown>;
  previousSnapshot: Record<string, unknown>;
}

export interface PendingEmployeeDocument {
  employeeId: string;
  label: string;
  mimeType: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  quality?: number;
  fileBase64?: string;
}

export interface PendingEmployeePhoto {
  employeeId: string;
  photoBase64?: string;
  hasPhoto?: boolean;
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
  source?: "admin_bulk" | "employee_self_service";
  pendingDocuments?: PendingEmployeeDocument[];
  pendingPhoto?: PendingEmployeePhoto;
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
  "Salary Wage Mode",
  "Daily Wage",
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
  "Employee Mobile",
  "Nominee Mobile",
  "Family Member Mobile (1)",
  "Family Member Mobile (2)",
  "Family Member Mobile (3)",
  "PF/ESIC Compliance **",
  "Professional Tax (PT) **",
  "PF Calculation Mode",
  "EXIT/LEAVING DATE",
  "REASON FOR EXIT",
  "Advance",
  "Penalty",
  "Uniform",
  "Food Perk",
  "Accommodation Perk",
  "Conveyance Perk",
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
  lat?: number;
  lng?: number;
  locationVerified?: boolean;
  locationVerifiedAt?: string;
  locationSource?: string;
  locationConfidence?: string;
  geofenceRadiusM?: number;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  matchedPlaceName?: string;
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
  /** Star supervisors can visit assigned-block schools without the 5-day cooldown. */
  isStarSupervisor?: boolean;
  loginEnabled?: boolean;
  loginPhone?: string;
  status: string;
  hasRegisteredDevice?: boolean;
  profilePhotoBase64?: string;
  profilePhotoUrl?: string;
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
  archived?: boolean;
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

export type TenderType = "manpower" | "travel";

export type TenderStatus =
  | "not_filed"
  | "not_evaluated"
  | "filed"
  | "technical_qualified"
  | "qualified"
  | "disqualified"
  | "technical_not_open"
  | "cancelled"
  | "representation_asked"
  | "challenged_representation"
  | "financial"
  | "bid_awarded"
  | "bid_not_awarded"
  | "won_bid";

/** @deprecated Use TenderStatus */
export type PreBidStatus = TenderStatus;

export interface Tender {
  id: string;
  bidNo: string;
  category: string;
  department: string;
  officerName: string;
  address: string;
  tenderType: TenderType;
  quantity: number;
  rate: string;
  endDate: string;
  filedDate: string;
  preBidAt: string;
  preBidVenue: string;
  noPreBid: boolean;
  status: TenderStatus;
  outcome: string;
  notes: string;
  description: string;
  /** GeM / procurement metadata */
  ministry?: string;
  organisation?: string;
  consigneeOfficer?: string;
  additionalRequirements?: string;
  startDate?: string;
  entryDate: string;
  gemDocUrl: string;
  gemCurrentStage: string;
  /** ISO timestamp when soft-deleted; empty when active */
  deletedAt?: string;
  /** ISO timestamp when GeM status was last synced via Smart Capture */
  statusSyncedAt?: string;
  /** Last GeM sync result: "status change found" or "unchanged" */
  statusSyncNote?: string;
  /** Previous status before the most recent GeM sync update */
  statusBeforeSync?: TenderStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateTenderInput = Omit<Tender, "id" | "createdAt" | "updatedAt">;

export type ContractType = "manpower" | "travel";

export type ContractStatus =
  | "active"
  | "upcoming"
  | "expired"
  | "extended"
  | "terminated";

export interface Contract {
  id: string;
  contractNo: string;
  officerName: string;
  officeName: string;
  correspondingOffice: string;
  fromDate: string;
  toDate: string;
  companyName: string;
  category: string;
  contractType: ContractType;
  hasExtension: boolean;
  extensionEndDate: string;
  bgApplicable: boolean;
  bgNumber: string;
  bgAmount: string;
  bgIssuingBank: string;
  bgExpiryDate: string;
  bgDetails: string;
  ddoName: string;
  ddoIssuingDetails: string;
  tenderBidNo: string;
  contractValue: string;
  status: ContractStatus;
  notes: string;
  entryDate: string;
  gemContractPdfUrl?: string;
  gemContractId?: string;
  /** Office locations assigned to this contract, in priority order */
  linkedLocations?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type CreateContractInput = Omit<Contract, "id" | "createdAt" | "updatedAt">;

export type RenewalCategory = "car_papers" | "it_renewals" | "licenses";

export type CarPaperSubtype =
  | "rc_book"
  | "insurance"
  | "road_tax"
  | "permit"
  | "puc";

export type ItRenewalSubtype = "domain" | "server";

export type LicenseSubtype =
  | "travel_plus"
  | "intelligic_solutions"
  | "rent_agreements"
  | "travel_plus_huf"
  | "intelligic_huf"
  | "intelligic_solutions_pvt_ltd";

export type RenewalOwnerType = "mine" | "client";

export type RenewalPeriod = "monthly" | "yearly";

export interface Renewal {
  id: string;
  category: RenewalCategory;
  subType: string;
  title: string;
  clientName: string;
  ownerType: RenewalOwnerType;
  amount: string;
  hasExpiry: boolean;
  issuedOn: string;
  expiresOn: string;
  /** @deprecated Use issuedOn */
  renewalDate: string;
  /** @deprecated Use expiresOn */
  expiryDate: string;
  notes: string;
  entryDate: string;
  renewalPeriod: RenewalPeriod;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateRenewalInput = Omit<Renewal, "id" | "createdAt" | "updatedAt">;

export interface RenewalDocument {
  id: string;
  renewalId: string;
  label: string;
  mimeType: string;
  filename: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  quality?: number;
  uploadedBy: string;
  createdAt: string;
  imagekitUrl?: string;
}

export type BgDdInstrumentType = "bg" | "dd";

export type BgDdStatus =
  | "submitted_to_dept"
  | "received_from_department"
  | "returned_to_bank"
  | "cancelled"
  | "received_fd"
  | "money_credited_back";

export interface BgDdRecord {
  id: string;
  instrumentType: BgDdInstrumentType;
  number: string;
  beneficiary: string;
  dateOfIssue: string;
  expiryDate: string;
  issuingBank: string;
  contractId: string;
  status: BgDdStatus;
  amount: string;
  notes: string;
  entryDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateBgDdInput = Omit<BgDdRecord, "id" | "createdAt" | "updatedAt">;

export interface BgDdDocument {
  id: string;
  bgDdId: string;
  label: string;
  mimeType: string;
  filename: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  quality?: number;
  uploadedBy: string;
  createdAt: string;
  imagekitUrl?: string;
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
  imagekitUrl?: string;
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
  photos?: SchoolVisitPhoto[];
  photoCount?: number;
  gpsLocation?: {
    lat: number;
    lng: number;
    locationLabel?: string;
    accuracyMeters?: number;
    isMock?: boolean;
    capturedAt?: string;
  };
  status: "submitted" | "approved" | "rejected" | "pending";
  visitType?: "commitment" | "adhoc";
  commitmentId?: string;
  distanceToSchoolM?: number;
  gpsAccuracyM?: number;
  locationMatchStatus?: string;
  pingVerificationNotes?: string;
  pingTrailNearSchoolCount?: number;
  pingTrailNearestSchoolM?: number;
  pingTrailNearestVisitM?: number;
  pingTrailPointCount?: number;
  pingTrailWindowMinutes?: number;
  needsReview?: boolean;
  schoolLat?: number;
  schoolLng?: number;
}

export interface SupervisorRequestPhoto {
  id: string;
  caption: string;
  mimeType: string;
  filename: string;
  photoDataBase64: string;
  imagekitUrl?: string;
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
  "No of Toilets",
  "Govt Unit Rate",
  "Partner Monthly Pay",
  "Rates",
  "District",
  "Block",
  "Remarks",
];

export const SCHOOL_MATERIAL_ITEMS = [
  "Phenyl",
  "Brush",
  "Jhaadu",
  "Harpic",
  "Handwash",
  "Mop",
];

export interface RolePermission {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

export interface CustomRole {
  name: string;
  description: string;
  permissions: {
    employees: RolePermission;
    schoolWork: RolePermission;
    bids: RolePermission;
    renewals: RolePermission;
    salary: RolePermission;
    ledger: RolePermission;
    attendance: RolePermission;
    leave: RolePermission;
    birthdays: RolePermission;
    directory: RolePermission;
    admin: RolePermission;
  };
  uiRestrictions?: import("./lib/role-ui-restrictions").RoleUiRestrictions;
}

