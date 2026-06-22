import { getSalaryColumnValue } from "../../lib/salary-columns";
import { expiryBand } from "../../lib/renewal-helpers";
import { parseFlexibleDateMs } from "../../lib/date-helpers";
import type {
  CommitmentDiary,
  Contract,
  Employee,
  Renewal,
  SchoolPartner,
  SchoolSupervisor,
  SchoolVisit,
  SchoolWork,
  Tender,
} from "../../types";
import { formatInr } from "./ObserverUI";

export type DetailField = { label: string; value: string };

function formatDate(d: string): string {
  if (!d?.trim()) return "—";
  const ts = parseFlexibleDateMs(d);
  if (ts === null) return d;
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d?: string | null): string {
  if (!d?.trim()) return "—";
  try {
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

export function buildEmployeeDetails(
  emp: Employee,
  selectedMonth: string,
  esicEligibilityLimit: number,
  attendanceDb: Record<string, Record<string, Record<string, string>>>,
  locationCompliance: Record<string, boolean>,
  locationPtEnabled: Record<string, boolean>,
): DetailField[] {
  const net =
    Number(
      getSalaryColumnValue(
        emp,
        "Net Payable",
        selectedMonth,
        esicEligibilityLimit,
        attendanceDb,
        locationCompliance,
        locationPtEnabled,
      ),
    ) || 0;

  return [
    { label: "Name", value: emp.nameAsPerAadhar || "—" },
    { label: "Employee Code", value: emp.employeeCode || "—" },
    { label: "Role", value: emp.role || "—" },
    { label: "Location", value: emp.location || "—" },
    { label: "Skill Category", value: emp.skillCategory || "—" },
    { label: "Mobile", value: emp.employeeMobile || "—" },
    { label: "Gross Salary", value: formatInr(Number(emp.grossSalary) || 0) },
    { label: "Net Payable", value: formatInr(net) },
    { label: "Working Days", value: emp.workingDaysType || "—" },
    { label: "PF Joining", value: formatDate(emp.pfJoiningDate) },
    { label: "Exit Date", value: formatDate(emp.exitDate || "") },
    { label: "Aadhar", value: emp.aadharNo || "—" },
    { label: "PAN", value: emp.panNo || "—" },
    { label: "Bank Account", value: emp.bankAccountNo || "—" },
    { label: "IFSC", value: emp.ifscCode || "—" },
    { label: "Present Address", value: emp.presentAddress || "—" },
  ];
}

export function buildSupervisorDetails(supervisor: SchoolSupervisor): DetailField[] {
  return [
    { label: "Name", value: supervisor.name || "—" },
    { label: "Phone", value: supervisor.phone || "—" },
    { label: "Email", value: supervisor.email || "—" },
    { label: "Designation", value: supervisor.designation || "—" },
    { label: "Status", value: supervisor.status || "—" },
    { label: "Online", value: supervisor.isOnline ? "Yes" : "No" },
    { label: "Last Active", value: formatDateTime(supervisor.lastActiveAt) },
    { label: "Assigned Blocks", value: supervisor.assignedBlocks?.join(", ") || "—" },
    { label: "Login Enabled", value: supervisor.loginEnabled ? "Yes" : "No" },
    { label: "Device Registered", value: supervisor.hasRegisteredDevice ? "Yes" : "No" },
    { label: "Alternate Phone", value: supervisor.alternatePhone || "—" },
    { label: "Bio", value: supervisor.bio || "—" },
  ];
}

export function buildVisitDetails(visit: SchoolVisit): DetailField[] {
  const materials =
    visit.materialsGiven?.length > 0
      ? visit.materialsGiven.map((m) => `${m.item} × ${m.qty}`).join(", ")
      : "—";

  return [
    { label: "School", value: visit.schoolName || "—" },
    { label: "Supervisor", value: visit.supervisorName || "—" },
    { label: "Visit Date", value: formatDate(visit.visitDate) },
    { label: "Status", value: visit.status || "—" },
    { label: "Block", value: visit.block || "—" },
    { label: "UDISE", value: visit.udise || "—" },
    { label: "Visit Type", value: visit.visitType || "—" },
    { label: "Materials Given", value: materials },
    { label: "Notes", value: visit.notes || "—" },
    {
      label: "GPS Location",
      value: visit.gpsLocation
        ? visit.gpsLocation.locationLabel ||
          `${visit.gpsLocation.lat.toFixed(5)}, ${visit.gpsLocation.lng.toFixed(5)}`
        : "—",
    },
    { label: "Photos", value: String(visit.photoCount ?? visit.photos?.length ?? 0) },
  ];
}

export function buildCommitmentDetails(commitment: CommitmentDiary): DetailField[] {
  return [
    { label: "School", value: commitment.schoolName || "—" },
    { label: "Supervisor", value: commitment.supervisorName || "—" },
    { label: "From Date", value: formatDate(commitment.fromDate) },
    { label: "To Date", value: formatDate(commitment.toDate) },
    { label: "Status", value: commitment.status.replace("_", " ") },
    { label: "Block", value: commitment.block || "—" },
    { label: "Notes", value: commitment.notes || "—" },
    { label: "Admin Notes", value: commitment.adminNotes || "—" },
    { label: "Last Updated By", value: commitment.lastUpdatedBy || "—" },
    { label: "Updated Role", value: commitment.lastUpdatedByRole || "—" },
  ];
}

export function buildTenderDetails(tender: Tender): DetailField[] {
  return [
    { label: "Bid No", value: tender.bidNo || "—" },
    { label: "Department", value: tender.department || "—" },
    { label: "Category", value: tender.category || "—" },
    { label: "Officer", value: tender.officerName || "—" },
    { label: "Status", value: tender.status || "—" },
    { label: "End Date", value: formatDate(tender.endDate) },
    { label: "Filed Date", value: formatDate(tender.filedDate) },
    { label: "Pre-Bid At", value: formatDate(tender.preBidAt) },
    { label: "Pre-Bid Venue", value: tender.preBidVenue || "—" },
    { label: "Quantity", value: String(tender.quantity ?? "—") },
    { label: "Rate", value: tender.rate || "—" },
    { label: "Outcome", value: tender.outcome || "—" },
    { label: "Description", value: tender.description || "—" },
    { label: "Notes", value: tender.notes || "—" },
    { label: "Address", value: tender.address || "—" },
  ];
}

export function buildContractDetails(contract: Contract): DetailField[] {
  return [
    { label: "Contract No", value: contract.contractNo || "—" },
    { label: "Company", value: contract.companyName || "—" },
    { label: "Office", value: contract.officeName || "—" },
    { label: "Officer", value: contract.officerName || "—" },
    { label: "Status", value: contract.status || "—" },
    { label: "From Date", value: formatDate(contract.fromDate) },
    { label: "To Date", value: formatDate(contract.toDate) },
    { label: "Extension End", value: formatDate(contract.extensionEndDate) },
    { label: "Contract Value", value: contract.contractValue || "—" },
    { label: "Category", value: contract.category || "—" },
    { label: "Tender Bid No", value: contract.tenderBidNo || "—" },
    { label: "BG Number", value: contract.bgNumber || "—" },
    { label: "BG Amount", value: contract.bgAmount || "—" },
    { label: "Notes", value: contract.notes || "—" },
  ];
}

export function buildRenewalDetails(renewal: Renewal): DetailField[] {
  const band = expiryBand(renewal);
  const status =
    band === "passed" ? "Expired" : band === "soon" ? "Expiring Soon" : band === "ok" ? "OK" : "—";

  return [
    { label: "Title", value: renewal.title || "—" },
    { label: "Category", value: renewal.category || "—" },
    { label: "Sub Type", value: renewal.subType || "—" },
    { label: "Client / Owner", value: renewal.clientName || renewal.ownerType || "—" },
    { label: "Expiry", value: formatDate(renewal.expiresOn || renewal.expiryDate || "") },
    { label: "Status", value: status },
    { label: "Amount", value: renewal.amount || "—" },
    { label: "Issued On", value: formatDate(renewal.issuedOn || renewal.renewalDate || "") },
    { label: "Notes", value: renewal.notes || "—" },
  ];
}

export function buildExpenseDetails(
  school: SchoolWork,
  selectedMonth: string,
): DetailField[] {
  const entry = school.monthlyExpenseLedger?.[selectedMonth];
  const material = Number(entry?.material) || 0;
  const trek = Number(entry?.trek) || 0;
  const misc = Number(entry?.miscellaneous) || 0;

  return [
    { label: "School", value: school.schoolName || "—" },
    { label: "Block", value: school.block || "—" },
    { label: "District", value: school.district || "—" },
    { label: "UDISE", value: school.udise || "—" },
    { label: "Month", value: selectedMonth },
    { label: "Material", value: formatInr(material) },
    { label: "Trek", value: formatInr(trek) },
    { label: "Miscellaneous", value: formatInr(misc) },
    { label: "Total", value: formatInr(material + trek + misc) },
  ];
}

export function buildPartnerDetails(partner: SchoolPartner, selectedMonth: string): DetailField[] {
  const status = partner.monthlyPayLedger?.[selectedMonth]?.paymentStatus || "Unpaid";

  return [
    { label: "Partner Name", value: partner.partnerName || "—" },
    { label: "School", value: partner.schoolName || "—" },
    { label: "Monthly Pay", value: formatInr(Number(partner.monthlyPay) || 0) },
    { label: "Payment Status", value: status },
    { label: "Account Holder", value: partner.accountHolderName || "—" },
    { label: "Account Number", value: partner.accountNumber || "—" },
    { label: "IFSC", value: partner.ifscCode || "—" },
    { label: "Month", value: selectedMonth },
  ];
}

export function matchesSearch(query: string, ...parts: (string | number | undefined | null)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((part) => String(part ?? "").toLowerCase().includes(q));
}
