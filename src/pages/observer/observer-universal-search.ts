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
import { getSalaryColumnValue } from "../../lib/salary-columns";
import { parseFlexibleDateMs } from "../../lib/date-helpers";
import { formatInr, formatMonthLabel } from "./ObserverUI";
import { matchesSearch, getLastPaidSalaryLabel } from "./observer-details";

export type UniversalSearchResult = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  dateLabel?: string;
  to: string;
  kind:
    | "employee"
    | "salary"
    | "supervisor"
    | "visit"
    | "commitment"
    | "tender"
    | "contract"
    | "renewal"
    | "expense"
    | "partner";
  entity:
    | Employee
    | SchoolSupervisor
    | SchoolVisit
    | CommitmentDiary
    | Tender
    | Contract
    | Renewal
    | SchoolWork
    | SchoolPartner;
  score: number;
};

type SearchInput = {
  query: string;
  canView: (tab: string) => boolean;
  employees: Employee[];
  supervisors: SchoolSupervisor[];
  visits: SchoolVisit[];
  commitments: CommitmentDiary[];
  tenders: Tender[];
  contracts: Contract[];
  renewals: Renewal[];
  schools: SchoolWork[];
  partners: SchoolPartner[];
  selectedMonth: string;
  esicEligibilityLimit: number;
  attendanceDb: Record<string, Record<string, Record<string, string>>>;
  locationCompliance: Record<string, boolean>;
  locationPtEnabled: Record<string, boolean>;
};

function tokenizeQuery(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function matchesTokens(tokens: string[], ...parts: (string | number | undefined | null)[]): boolean {
  if (tokens.length === 0) return false;
  const haystack = parts.map((part) => String(part ?? "").toLowerCase()).join(" ");
  return tokens.every((token) => haystack.includes(token));
}

function formatDate(d: string): string {
  if (!d?.trim()) return "";
  const ts = parseFlexibleDateMs(d);
  if (ts === null) return d;
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d?: string | null): string {
  if (!d?.trim()) return "";
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

function pushResult(results: UniversalSearchResult[], result: UniversalSearchResult, limit: number): boolean {
  if (results.some((r) => r.id === result.id)) return false;
  results.push(result);
  return results.length >= limit;
}

export function groupUniversalSearchResults(
  results: UniversalSearchResult[],
): { category: string; items: UniversalSearchResult[] }[] {
  const order = [
    "Employees",
    "Salary",
    "Supervisors",
    "Visits",
    "Commitments",
    "Tenders",
    "Contracts",
    "Car Papers",
    "IT Renewals",
    "Licenses",
    "Expenses",
    "Partner Pay",
  ];
  const grouped = new Map<string, UniversalSearchResult[]>();
  for (const result of results) {
    const list = grouped.get(result.category) || [];
    list.push(result);
    grouped.set(result.category, list);
  }
  return order
    .filter((category) => grouped.has(category))
    .map((category) => ({ category, items: grouped.get(category)! }));
}

export function runUniversalSearch(input: SearchInput): UniversalSearchResult[] {
  const { query, canView } = input;
  const q = query.trim();
  if (!q) return [];

  const tokens = tokenizeQuery(q);
  const results: UniversalSearchResult[] = [];
  const limit = 80;
  const monthLabel = formatMonthLabel(input.selectedMonth);

  const match = (...parts: (string | number | undefined | null)[]) =>
    tokens.length > 1 ? matchesTokens(tokens, ...parts) : matchesSearch(q, ...parts);

  if (canView("Salary") || canView("Employees")) {
    for (const emp of input.employees) {
      const name = emp.nameAsPerAadhar || emp.employeeCode;
      if (
        !match(
          emp.nameAsPerAadhar,
          emp.employeeCode,
          emp.role,
          emp.location,
          emp.skillCategory,
          emp.aadharNo,
          emp.panNo,
          emp.employeeMobile,
        )
      ) {
        continue;
      }

      pushResult(results, {
        id: `emp-${emp.id}`,
        category: "Employees",
        title: name,
        subtitle: `${emp.role || "Staff"} · ${emp.location || "—"}`,
        dateLabel: emp.exitDate ? formatDate(emp.exitDate) : "Active",
        to: "/observer/employees",
        kind: "employee",
        entity: emp,
        score: 100,
      }, limit);

      if (canView("Salary")) {
        const net =
          Number(
            getSalaryColumnValue(
              emp,
              "Net Payable",
              input.selectedMonth,
              input.esicEligibilityLimit,
              input.attendanceDb,
              input.locationCompliance,
              input.locationPtEnabled,
            ),
          ) || 0;
        const lastPaid = getLastPaidSalaryLabel(emp);
        pushResult(results, {
          id: `salary-${emp.id}-${input.selectedMonth}`,
          category: "Salary",
          title: name,
          subtitle: `${formatInr(net)} · Last paid ${lastPaid.label} · ${emp.location || "—"}`,
          dateLabel: monthLabel,
          to: "/observer/salary",
          kind: "salary",
          entity: emp,
          score: 95,
        }, limit);
      }

      if (results.length >= limit) return results.sort((a, b) => b.score - a.score);
    }
  }

  if (canView("Field Team")) {
    for (const sup of input.supervisors) {
      if (!match(sup.name, sup.phone, sup.designation, sup.email, sup.assignedBlocks?.join(" "))) {
        continue;
      }
      pushResult(results, {
        id: `sup-${sup.id}`,
        category: "Supervisors",
        title: sup.name,
        subtitle: `${sup.designation || "Supervisor"} · ${sup.phone || "—"}`,
        dateLabel: sup.lastActiveAt ? formatDateTime(sup.lastActiveAt) : undefined,
        to: "/observer/supervisors",
        kind: "supervisor",
        entity: sup,
        score: 90,
      }, limit);
      if (results.length >= limit) return results.sort((a, b) => b.score - a.score);
    }

    for (const visit of input.visits) {
      if (!match(visit.schoolName, visit.supervisorName, visit.block, visit.udise, visit.status, visit.notes)) {
        continue;
      }
      pushResult(results, {
        id: `visit-${visit.id}`,
        category: "Visits",
        title: visit.schoolName,
        subtitle: `${visit.supervisorName} · ${visit.status || "—"}`,
        dateLabel: formatDate(visit.visitDate),
        to: "/observer/visits",
        kind: "visit",
        entity: visit,
        score: 85,
      }, limit);
      if (results.length >= limit) return results.sort((a, b) => b.score - a.score);
    }

    for (const c of input.commitments) {
      if (!match(c.schoolName, c.supervisorName, c.block, c.status, c.notes, c.adminNotes)) {
        continue;
      }
      pushResult(results, {
        id: `commit-${c.id}`,
        category: "Commitments",
        title: c.schoolName,
        subtitle: `${c.supervisorName} · ${c.status.replace("_", " ")}`,
        dateLabel: `${formatDate(c.fromDate)} – ${formatDate(c.toDate)}`,
        to: "/observer/commitments",
        kind: "commitment",
        entity: c,
        score: 80,
      }, limit);
      if (results.length >= limit) return results.sort((a, b) => b.score - a.score);
    }
  }

  if (canView("Tenders")) {
    for (const t of input.tenders.filter((x) => !x.deletedAt?.trim())) {
      if (!match(t.bidNo, t.department, t.officerName, t.status, t.category, t.description, t.notes)) {
        continue;
      }
      pushResult(results, {
        id: `tender-${t.id}`,
        category: "Tenders",
        title: t.bidNo || t.department || "Tender",
        subtitle: `${t.department || "—"} · ${t.tenderType === "travel" ? "Car" : "Manpower"}`,
        dateLabel: t.endDate ? `Due ${formatDate(t.endDate)}` : undefined,
        to: "/observer/tenders",
        kind: "tender",
        entity: t,
        score: 75,
      }, limit);
      if (results.length >= limit) return results.sort((a, b) => b.score - a.score);
    }
  }

  if (canView("Contracts")) {
    for (const c of input.contracts) {
      const worksite = c.linkedLocations?.[0] || c.officeName || c.correspondingOffice;
      if (
        !match(
          c.contractNo,
          c.companyName,
          c.officeName,
          c.officerName,
          c.status,
          worksite,
          c.linkedLocations?.join(" "),
        )
      ) {
        continue;
      }
      pushResult(results, {
        id: `contract-${c.id}`,
        category: "Contracts",
        title: c.contractNo || c.companyName || "Contract",
        subtitle: `${worksite || "—"} · ${c.status || "—"}`,
        dateLabel: `${formatDate(c.fromDate)} – ${formatDate(c.toDate)}`,
        to: "/observer/contracts",
        kind: "contract",
        entity: c,
        score: 70,
      }, limit);
      if (results.length >= limit) return results.sort((a, b) => b.score - a.score);
    }
  }

  if (canView("Car Papers") || canView("IT Renewals") || canView("Licenses")) {
    for (const r of input.renewals) {
      const perm =
        r.category === "car_papers"
          ? "Car Papers"
          : r.category === "it_renewals"
            ? "IT Renewals"
            : "Licenses";
      if (!canView(perm)) continue;
      if (!match(r.title, r.subType, r.clientName, r.ownerType, r.amount, r.notes)) {
        continue;
      }
      const to =
        r.category === "car_papers"
          ? "/observer/car-papers"
          : r.category === "it_renewals"
            ? "/observer/it-renewals"
            : "/observer/licenses";
      pushResult(results, {
        id: `renewal-${r.id}`,
        category: perm,
        title: r.title || r.subType || "Renewal",
        subtitle: `${r.clientName || r.ownerType || "—"}`,
        dateLabel: `Exp ${formatDate(r.expiresOn || r.expiryDate || "")}`,
        to,
        kind: "renewal",
        entity: r,
        score: 65,
      }, limit);
      if (results.length >= limit) return results.sort((a, b) => b.score - a.score);
    }
  }

  if (canView("Expenses")) {
    for (const school of input.schools) {
      const entry = school.monthlyExpenseLedger?.[input.selectedMonth];
      const total =
        (Number(entry?.material) || 0) +
        (Number(entry?.trek) || 0) +
        (Number(entry?.miscellaneous) || 0);
      if (total <= 0) continue;
      if (!match(school.schoolName, school.block, school.district, school.udise, school.headmasterName)) {
        continue;
      }
      pushResult(results, {
        id: `expense-${school.id}-${input.selectedMonth}`,
        category: "Expenses",
        title: school.schoolName,
        subtitle: `${school.block || "—"} · ${formatInr(total)}`,
        dateLabel: monthLabel,
        to: "/observer/expenses",
        kind: "expense",
        entity: school,
        score: 60,
      }, limit);
      if (results.length >= limit) return results.sort((a, b) => b.score - a.score);
    }
  }

  if (canView("Monthly Billing")) {
    for (const p of input.partners) {
      if (!match(p.partnerName, p.schoolName, p.accountHolderName, p.block, p.district)) {
        continue;
      }
      const status = p.monthlyPayLedger?.[input.selectedMonth]?.paymentStatus || "Unpaid";
      pushResult(results, {
        id: `partner-${p.id}`,
        category: "Partner Pay",
        title: p.partnerName,
        subtitle: `${p.schoolName || "—"} · ${status} · ${formatInr(Number(p.monthlyPay) || 0)}`,
        dateLabel: monthLabel,
        to: "/observer/partner-pay",
        kind: "partner",
        entity: p,
        score: 55,
      }, limit);
      if (results.length >= limit) return results.sort((a, b) => b.score - a.score);
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
