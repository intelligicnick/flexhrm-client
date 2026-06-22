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
import { matchesSearch } from "./observer-details";

export type UniversalSearchResult = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  to: string;
  kind:
    | "employee"
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
};

export function runUniversalSearch(input: SearchInput): UniversalSearchResult[] {
  const { query, canView } = input;
  const q = query.trim();
  if (!q) return [];

  const results: UniversalSearchResult[] = [];
  const limit = 40;

  if (canView("Salary") || canView("Employees")) {
    for (const emp of input.employees) {
      if (
        !matchesSearch(q, emp.nameAsPerAadhar, emp.employeeCode, emp.role, emp.location, emp.skillCategory)
      ) {
        continue;
      }
      results.push({
        id: `emp-${emp.id}`,
        category: "Employees",
        title: emp.nameAsPerAadhar || emp.employeeCode,
        subtitle: `${emp.role || "Staff"} · ${emp.location || "—"}`,
        to: "/observer/salary",
        kind: "employee",
        entity: emp,
      });
      if (results.length >= limit) return results;
    }
  }

  if (canView("Field Team")) {
    for (const sup of input.supervisors) {
      if (!matchesSearch(q, sup.name, sup.phone, sup.designation, sup.assignedBlocks?.join(" "))) {
        continue;
      }
      results.push({
        id: `sup-${sup.id}`,
        category: "Supervisors",
        title: sup.name,
        subtitle: `${sup.designation || "Supervisor"} · ${sup.phone || "—"}`,
        to: "/observer/supervisors",
        kind: "supervisor",
        entity: sup,
      });
      if (results.length >= limit) return results;
    }

    for (const visit of input.visits) {
      if (!matchesSearch(q, visit.schoolName, visit.supervisorName, visit.block, visit.udise, visit.status)) {
        continue;
      }
      results.push({
        id: `visit-${visit.id}`,
        category: "Visits",
        title: visit.schoolName,
        subtitle: `${visit.supervisorName} · ${visit.visitDate}`,
        to: "/observer/visits",
        kind: "visit",
        entity: visit,
      });
      if (results.length >= limit) return results;
    }

    for (const c of input.commitments) {
      if (!matchesSearch(q, c.schoolName, c.supervisorName, c.block, c.status, c.notes)) {
        continue;
      }
      results.push({
        id: `commit-${c.id}`,
        category: "Commitments",
        title: c.schoolName,
        subtitle: `${c.supervisorName} · ${c.fromDate}`,
        to: "/observer/commitments",
        kind: "commitment",
        entity: c,
      });
      if (results.length >= limit) return results;
    }
  }

  if (canView("Tenders")) {
    for (const t of input.tenders.filter((x) => !x.deletedAt?.trim())) {
      if (!matchesSearch(q, t.bidNo, t.department, t.officerName, t.status, t.category)) {
        continue;
      }
      results.push({
        id: `tender-${t.id}`,
        category: "Tenders",
        title: t.bidNo || t.department || "Tender",
        subtitle: `${t.department || "—"} · ${t.endDate || "—"}`,
        to: "/observer/tenders",
        kind: "tender",
        entity: t,
      });
      if (results.length >= limit) return results;
    }
  }

  if (canView("Contracts")) {
    for (const c of input.contracts) {
      if (!matchesSearch(q, c.contractNo, c.companyName, c.officeName, c.officerName, c.status)) {
        continue;
      }
      results.push({
        id: `contract-${c.id}`,
        category: "Contracts",
        title: c.contractNo || c.companyName || "Contract",
        subtitle: `${c.officeName || "—"} · ${c.toDate || "—"}`,
        to: "/observer/contracts",
        kind: "contract",
        entity: c,
      });
      if (results.length >= limit) return results;
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
      if (!matchesSearch(q, r.title, r.subType, r.clientName, r.ownerType, r.amount)) {
        continue;
      }
      const to =
        r.category === "car_papers"
          ? "/observer/car-papers"
          : r.category === "it_renewals"
            ? "/observer/it-renewals"
            : "/observer/licenses";
      results.push({
        id: `renewal-${r.id}`,
        category: perm,
        title: r.title || r.subType || "Renewal",
        subtitle: `${r.clientName || r.ownerType || "—"} · ${r.expiresOn || r.expiryDate || "—"}`,
        to,
        kind: "renewal",
        entity: r,
      });
      if (results.length >= limit) return results;
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
      if (!matchesSearch(q, school.schoolName, school.block, school.district, school.udise)) {
        continue;
      }
      results.push({
        id: `expense-${school.id}`,
        category: "Expenses",
        title: school.schoolName,
        subtitle: `${school.block || "—"} · ${input.selectedMonth}`,
        to: "/observer/expenses",
        kind: "expense",
        entity: school,
      });
      if (results.length >= limit) return results;
    }
  }

  if (canView("Monthly Billing")) {
    for (const p of input.partners) {
      if (!matchesSearch(q, p.partnerName, p.schoolName, p.accountHolderName)) {
        continue;
      }
      results.push({
        id: `partner-${p.id}`,
        category: "Partner Pay",
        title: p.partnerName,
        subtitle: p.schoolName || "—",
        to: "/observer/partner-pay",
        kind: "partner",
        entity: p,
      });
      if (results.length >= limit) return results;
    }
  }

  return results;
}
