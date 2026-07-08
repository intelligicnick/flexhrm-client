import { getSalaryColumnValue } from "../../lib/salary-columns";
import { expiryBand } from "../../lib/renewal-helpers";
import { MONTH_NAME_LIST, normalizeMonthKey, parseFlexibleDateMs, formatEmployeeBirthDate, parseDateOfBirth } from "../../lib/date-helpers";
import { resolveGemBidPdfUrl, resolveGemContractPdfUrl, resolveGemContractNoLabel } from "../../lib/gem-helpers";
import { resolvePhotoSrc, resolvePhotoThumbnailSrc } from "../../lib/media-url";
import { formatLatLngDecimal, isValidGpsCoord } from "../../lib/gps-coords";
import { buildAllExpenseRecords, type ExpenseRecordRow } from "../../lib/school-work-helpers";
import {
  getMonthLedger,
  getTotalByType,
  LEDGER_TYPE_LABELS,
  type LedgerItemType,
} from "../../lib/ledger-helpers";
import type { MonitorWorkSession } from "../../lib/monitor-api";
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
import { phoneToTelHref } from "../../lib/phone-helpers";
import { formatInr, formatMonthLabel } from "./ObserverUI";

export type DetailField = {
  label: string;
  value: string;
  href?: string;
  shareUrl?: string;
  shareTitle?: string;
  imageSrc?: string;
  imageThumbSrc?: string;
  tone?: "green" | "amber" | "red" | "blue" | "slate";
  hideLabel?: boolean;
};

export type ObserverDocumentLink = {
  id: string;
  label: string;
  url: string;
  mimeType?: string;
};

function formatDate(d: string): string {
  if (!d?.trim()) return "—";
  const ts = parseFlexibleDateMs(d);
  if (ts === null) return d.trim();
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function formatDateTime(d?: string | null): string {
  if (!d?.trim()) return "—";
  const ts = parseFlexibleDateMs(d);
  if (ts !== null) {
    return new Date(ts).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  }
  return d.trim();
}

function contractWorksite(contract: Contract): string {
  return contract.linkedLocations?.filter(Boolean).join(", ") || contract.officeName || contract.correspondingOffice || "—";
}

function monthKeySortValue(monthKey: string): number {
  const normalized = normalizeMonthKey(monthKey);
  const parts = normalized.split(" ");
  const monthIndex = MONTH_NAME_LIST.indexOf(parts[0]);
  const year = parseInt(parts[1], 10);
  if (monthIndex < 0 || !Number.isFinite(year)) return 0;
  return year * 12 + monthIndex;
}

/** Last month/year when salary was marked Paid, for observer payment status display. */
export function getLastPaidSalaryLabel(emp: Employee): { label: string; tone: DetailField["tone"] } {
  const ledger = emp.monthlyLedger || {};
  const paidMonths = Object.entries(ledger)
    .filter(([, entry]) => entry?.paymentStatus === "Paid")
    .map(([month]) => month)
    .sort((a, b) => monthKeySortValue(a) - monthKeySortValue(b));

  if (paidMonths.length === 0) {
    return { label: "Not paid yet", tone: "red" };
  }

  const lastPaid = paidMonths[paidMonths.length - 1];
  return { label: formatMonthLabel(lastPaid), tone: "green" };
}

function salaryPaymentStatus(emp: Employee, selectedMonth: string): "Paid" | "Unpaid" | "Hold" {
  return emp.monthlyLedger?.[selectedMonth]?.paymentStatus || "Unpaid";
}

function paymentTone(status: string): DetailField["tone"] {
  if (status === "Paid") return "green";
  if (status === "Hold") return "amber";
  return "red";
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
  const payStatus = getLastPaidSalaryLabel(emp);

  return [
    { label: "Name", value: emp.nameAsPerAadhar || "—" },
    { label: "Employee Code", value: emp.employeeCode || "—" },
    { label: "Role", value: emp.role || "—" },
    { label: "Location", value: emp.location || "—" },
    { label: "Payment Status", value: payStatus.label, tone: payStatus.tone },
    { label: "This Month", value: salaryPaymentStatus(emp, selectedMonth), tone: paymentTone(salaryPaymentStatus(emp, selectedMonth)) },
    { label: "Net Payable", value: formatInr(net) },
    { label: "Month", value: formatMonthLabel(selectedMonth) },
    { label: "Skill Category", value: emp.skillCategory || "—" },
    { label: "Mobile", value: emp.employeeMobile || "—" },
    { label: "Gross Salary", value: formatInr(Number(emp.grossSalary) || 0) },
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

  const fields: DetailField[] = [
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
        ? [
            visit.gpsLocation.locationLabel,
            isValidGpsCoord(visit.gpsLocation.lat, visit.gpsLocation.lng)
              ? formatLatLngDecimal(visit.gpsLocation.lat, visit.gpsLocation.lng)
              : "",
          ]
            .filter(Boolean)
            .join(" · ") || "—"
        : "—",
    },
  ];

  const photos = visit.photos || [];
  photos.forEach((photo, index) => {
    const thumbSrc = resolvePhotoThumbnailSrc(photo);
    const fullSrc = resolvePhotoSrc(photo);
    if (!thumbSrc && !fullSrc) return;
    fields.push({
      label: photos.length > 1 ? `Stamped Photo ${index + 1}` : "Stamped Photo",
      value: [
        photo.caption || formatDate(visit.visitDate),
        photo.locationLabel,
        isValidGpsCoord(photo.lat, photo.lng)
          ? formatLatLngDecimal(photo.lat, photo.lng)
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      imageThumbSrc: thumbSrc || fullSrc,
      imageSrc: fullSrc || thumbSrc,
    });
  });

  if (photos.length === 0) {
    fields.push({ label: "Photos", value: String(visit.photoCount ?? 0) });
  }

  return fields;
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
  const pdfUrl = resolveGemBidPdfUrl(tender);
  const typeLabel = tender.tenderType === "travel" ? "Car" : "Manpower";

  const fields: DetailField[] = [
    { label: "Bid No", value: tender.bidNo || "—" },
    { label: "Type", value: typeLabel, tone: tender.tenderType === "travel" ? "amber" : "green" },
    { label: "End Date", value: formatDate(tender.endDate) },
    { label: "Pre-Bid Date & Time", value: formatDateTime(tender.preBidAt) },
    { label: "Pre-Bid Venue", value: tender.preBidVenue || "—" },
    { label: "Quantity", value: String(tender.quantity ?? "—"), tone: "green", hideLabel: false },
    { label: "Department", value: tender.department || "—" },
    { label: "Officer", value: tender.officerName || "—" },
    { label: "Status", value: tender.status || "—" },
    { label: "Filed Date", value: formatDate(tender.filedDate) },
    { label: "Rate", value: tender.rate || "—" },
    { label: "Outcome", value: tender.outcome || "—" },
    { label: "Description", value: tender.description || "—" },
    { label: "Notes", value: tender.notes || "—" },
    { label: "Address", value: tender.address || "—" },
  ];

  if (pdfUrl) {
    fields.push({
      label: "Bid PDF",
      value: "View bid document",
      href: pdfUrl,
      shareUrl: pdfUrl,
      shareTitle: `Tender ${tender.bidNo || "PDF"}`,
    });
  }

  return fields;
}

export function buildContractDetails(contract: Contract): DetailField[] {
  const pdfUrl = resolveGemContractPdfUrl(contract);
  const contractLabel = resolveGemContractNoLabel(contract);

  const fields: DetailField[] = [
    { label: "Contract No", value: contractLabel || contract.contractNo || "—" },
    { label: "Worksite Location", value: contractWorksite(contract) },
    { label: "Start Date", value: formatDate(contract.fromDate) },
    { label: "End Date", value: formatDate(contract.toDate) },
    { label: "Company", value: contract.companyName || "—" },
    { label: "Office", value: contract.officeName || "—" },
    { label: "Officer", value: contract.officerName || "—" },
    { label: "Status", value: contract.status || "—" },
    { label: "Extension End", value: formatDate(contract.extensionEndDate) },
    { label: "Contract Value", value: contract.contractValue || "—" },
    { label: "Category", value: contract.category || "—" },
    { label: "Tender Bid No", value: contract.tenderBidNo || "—" },
    { label: "BG Number", value: contract.bgNumber || "—" },
    { label: "BG Amount", value: contract.bgAmount || "—" },
    { label: "Notes", value: contract.notes || "—" },
  ];

  if (pdfUrl) {
    fields.push({
      label: "Contract PDF",
      value: "View contract document",
      href: pdfUrl,
      shareUrl: pdfUrl,
      shareTitle: `Contract ${contractLabel || contract.contractNo || "PDF"}`,
    });
  }

  return fields;
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
  const records = buildAllExpenseRecords([school]).filter((row) => row.monthKey === selectedMonth);
  const monthTotal = records.reduce((sum, row) => sum + row.amount, 0);

  if (records.length === 0) {
    const entry = school.monthlyExpenseLedger?.[selectedMonth];
    const material = Number(entry?.material) || 0;
    const trek = Number(entry?.trek) || 0;
    const misc = Number(entry?.miscellaneous) || 0;
    const total = material + trek + misc;
    return [
      { label: "Date", value: "—" },
      { label: "Total Expenses", value: formatInr(total) },
      { label: "Expense Type", value: "Combined" },
      { label: "District", value: school.district || "—" },
      { label: "Block", value: school.block || "—" },
      { label: "Month", value: formatMonthLabel(selectedMonth) },
      { label: "Amount", value: formatInr(total) },
      { label: "Remark", value: school.remarks || "—" },
    ];
  }

  const fields: DetailField[] = [
    { label: "School", value: school.schoolName || "—" },
    { label: "Total Expenses", value: formatInr(monthTotal) },
    { label: "Month", value: formatMonthLabel(selectedMonth) },
  ];

  records.forEach((row, index) => {
    fields.push(
      { label: `Entry ${index + 1} — Date`, value: row.date ? formatDate(row.date) : "—" },
      { label: `Entry ${index + 1} — Type`, value: row.type },
      { label: `Entry ${index + 1} — District`, value: row.district || school.district || "—" },
      { label: `Entry ${index + 1} — Block`, value: row.block || school.block || "—" },
      { label: `Entry ${index + 1} — Amount`, value: formatInr(row.amount) },
      { label: `Entry ${index + 1} — Remark`, value: row.remarks || "—" },
    );
  });

  return fields;
}

export function buildExpenseRecordDetails(
  row: ExpenseRecordRow,
  monthTotal: number,
): DetailField[] {
  return [
    { label: "Date", value: row.date ? formatDate(row.date) : "—" },
    { label: "Total Expenses", value: formatInr(monthTotal) },
    { label: "Expense Type", value: row.type },
    { label: "District", value: row.district || "—" },
    { label: "Block", value: row.block || "—" },
    { label: "Month", value: formatMonthLabel(row.monthKey) },
    { label: "Amount", value: formatInr(row.amount) },
    { label: "Remark", value: row.remarks || "—" },
  ];
}

export function buildPartnerDetails(partner: SchoolPartner, selectedMonth: string): DetailField[] {
  const status = partner.monthlyPayLedger?.[selectedMonth]?.paymentStatus || "Unpaid";

  return [
    { label: "Name", value: partner.partnerName || "—" },
    { label: "School Name", value: partner.schoolName || "—" },
    { label: "Status", value: status, tone: paymentTone(status) },
    { label: "Amount", value: formatInr(Number(partner.monthlyPay) || 0) },
    { label: "Month", value: formatMonthLabel(selectedMonth) },
    { label: "Account Holder", value: partner.accountHolderName || "—" },
    { label: "Account Number", value: partner.accountNumber || "—" },
    { label: "IFSC", value: partner.ifscCode || "—" },
  ];
}

export function buildLedgerDetails(emp: Employee, monthKey: string): DetailField[] {
  const ledger = getMonthLedger(emp, monthKey);
  const fields: DetailField[] = [
    { label: "Name", value: emp.nameAsPerAadhar || emp.employeeCode || "—" },
    { label: "Employee Code", value: emp.employeeCode || "—" },
    { label: "Location", value: emp.location || "—" },
    { label: "Month", value: formatMonthLabel(monthKey) },
  ];

  const monthTotals: string[] = [];
  (["advance", "penalty", "uniform", "foodPerk", "accommodationPerk", "conveyancePerk"] as LedgerItemType[]).forEach(
    (type) => {
      const total = getTotalByType(ledger, type);
      if (total > 0) monthTotals.push(`${LEDGER_TYPE_LABELS[type]} ${formatInr(total)}`);
    },
  );
  if (monthTotals.length > 0) {
    fields.push({ label: "Month Totals", value: monthTotals.join(" · ") });
  }

  return fields;
}

export function buildAttendanceDetails(
  emp: Employee,
  monthKey: string,
  presents: number,
  absents: number,
): DetailField[] {
  const total = presents + absents;
  const presentPct = total > 0 ? `${Math.round((presents / total) * 100)}%` : "—";

  return [
    { label: "Name", value: emp.nameAsPerAadhar || emp.employeeCode || "—" },
    { label: "Employee Code", value: emp.employeeCode || "—" },
    { label: "Role", value: emp.role || "—" },
    { label: "Location", value: emp.location || "—" },
    { label: "Month", value: formatMonthLabel(monthKey) },
    { label: "Present Days", value: String(presents), tone: "green" },
    { label: "Absent Days", value: String(absents), tone: absents > 0 ? "red" : "slate" },
    { label: "Attendance Rate", value: presentPct },
    { label: "Working Days Type", value: emp.workingDaysType || "—" },
  ];
}

export function buildDirectoryEmployeeDetails(emp: Employee): DetailField[] {
  const photoSrc = resolvePhotoSrc({ photoUrl: emp.photoUrl || emp.photo });
  const photoThumb = resolvePhotoThumbnailSrc({ photoUrl: emp.photoUrl || emp.photo });

  return [
    ...(photoSrc
      ? [{ label: "Photo", value: emp.nameAsPerAadhar || "Employee", imageSrc: photoSrc, imageThumbSrc: photoThumb, hideLabel: true }]
      : []),
    { label: "Name", value: emp.nameAsPerAadhar || "—" },
    { label: "Employee Code", value: emp.employeeCode || "—" },
    { label: "Designation", value: emp.role || "—" },
    { label: "Location", value: emp.location || "—" },
    { label: "Mobile", value: emp.employeeMobile || "—", href: phoneToTelHref(emp.employeeMobile) },
    { label: "Aadhar Linked Mobile", value: emp.aadharLinkMobNo || "—", href: phoneToTelHref(emp.aadharLinkMobNo) },
    { label: "Gender", value: emp.gender || "—" },
  ];
}

export function buildHelplineDetails(helpline: {
  name?: string;
  phone?: string;
  location?: string;
  category?: string;
}): DetailField[] {
  return [
    { label: "Name", value: helpline.name || "—" },
    { label: "Phone", value: helpline.phone || "—", href: phoneToTelHref(helpline.phone) },
    { label: "Location", value: helpline.location || "—" },
    { label: "Category", value: helpline.category || "—" },
  ];
}

export function buildBirthdayDetails(emp: Employee, age?: number): DetailField[] {
  const dob = parseDateOfBirth(emp.dateOfBirth);
  const resolvedAge = age ?? (dob ? new Date().getFullYear() - dob.year : undefined);

  return [
    { label: "Name", value: emp.nameAsPerAadhar || emp.employeeCode || "—" },
    { label: "Employee Code", value: emp.employeeCode || "—" },
    { label: "Date of Birth", value: formatEmployeeBirthDate(emp.dateOfBirth) },
    { label: "Age", value: resolvedAge != null ? String(resolvedAge) : "—" },
    { label: "Role", value: emp.role || "—" },
    { label: "Location", value: emp.location || "—" },
    { label: "Mobile", value: emp.employeeMobile || "—", href: phoneToTelHref(emp.employeeMobile) },
  ];
}

export function buildMonitorSessionDetails(session: MonitorWorkSession): DetailField[] {
  const hours = session.totalHoursWorkedSeconds
    ? `${(session.totalHoursWorkedSeconds / 3600).toFixed(1)}h`
    : `${session.totalHoursWorked.toFixed(1)}h`;

  return [
    { label: "Employee", value: session.employeeName || "—" },
    { label: "Employee Code", value: session.employeeCode || "—" },
    { label: "Login", value: formatDateTime(session.loginTime || "") },
    { label: "Logout", value: formatDateTime(session.logoutTime || "") },
    { label: "Hours Worked", value: hours },
    { label: "Breaks", value: String(session.totalBreaks ?? 0) },
  ];
}

export function matchesSearch(query: string, ...parts: (string | number | undefined | null)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((part) => String(part ?? "").toLowerCase().includes(q));
}

export function getSalaryStatusTone(status: string): "green" | "amber" | "red" | "blue" | "slate" {
  return paymentTone(status) || "red";
}

export function getTenderTypeBadge(tender: Tender): { label: string; tone: "green" | "amber" } {
  if (tender.tenderType === "travel") return { label: "Car", tone: "amber" };
  return { label: "Manpower", tone: "green" };
}

export { contractWorksite, salaryPaymentStatus, formatDate, formatDateTime };
