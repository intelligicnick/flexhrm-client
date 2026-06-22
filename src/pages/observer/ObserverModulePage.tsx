import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  IndianRupee,
  ClipboardList,
  BookOpen,
  Gavel,
  FileText,
  Car,
  Monitor,
  BadgeCheck,
  Receipt,
  HandCoins,
  MapPin,
  Users,
} from "lucide-react";
import { useHRMS } from "../../context/HRMSContext";
import { useObserverStats } from "./useObserverStats";
import {
  ObserverEmptyState,
  ObserverListRow,
  ObserverSection,
  ObserverStatCard,
  ObserverStatGrid,
  formatInr,
  formatMonthLabel,
} from "./ObserverUI";
import { expiryBand } from "../../lib/renewal-helpers";
import { getSalaryColumnValue } from "../../lib/salary-columns";
import { parseFlexibleDateMs } from "../../lib/date-helpers";
import type { Renewal } from "../../types";
import ObserverSearchInput from "./ObserverSearchInput";
import { ObserverDetailSheet } from "./ObserverDetailSheet";
import {
  buildCommitmentDetails,
  buildContractDetails,
  buildEmployeeDetails,
  buildExpenseDetails,
  buildPartnerDetails,
  buildRenewalDetails,
  buildSupervisorDetails,
  buildTenderDetails,
  buildVisitDetails,
  matchesSearch,
  type DetailField,
} from "./observer-details";

const MODULE_CONFIG: Record<
  string,
  { title: string; icon: typeof IndianRupee; permission: string; renewalCategory?: string }
> = {
  salary: { title: "Salary", icon: IndianRupee, permission: "Salary" },
  employees: { title: "Employees & Guards", icon: Users, permission: "Employees" },
  supervisors: { title: "Supervisors", icon: MapPin, permission: "Field Team" },
  visits: { title: "Visits", icon: ClipboardList, permission: "Field Team" },
  commitments: { title: "Commitment Diary", icon: BookOpen, permission: "Field Team" },
  tenders: { title: "Tenders", icon: Gavel, permission: "Tenders" },
  contracts: { title: "Contracts", icon: FileText, permission: "Contracts" },
  "car-papers": { title: "Car Papers", icon: Car, permission: "Car Papers", renewalCategory: "car_papers" },
  "it-renewals": { title: "IT Renewals", icon: Monitor, permission: "IT Renewals", renewalCategory: "it_renewals" },
  licenses: { title: "Licenses", icon: BadgeCheck, permission: "Licenses", renewalCategory: "licenses" },
  expenses: { title: "Expenses", icon: Receipt, permission: "Expenses" },
  "partner-pay": { title: "Partner Pay", icon: HandCoins, permission: "Monthly Billing" },
};

function renewalBadge(r: Renewal): { label: string; tone: "red" | "amber" | "green" | "slate" } {
  const band = expiryBand(r);
  if (band === "passed") return { label: "Expired", tone: "red" };
  if (band === "soon") return { label: "Expiring", tone: "amber" };
  if (band === "ok") return { label: "OK", tone: "green" };
  return { label: "—", tone: "slate" };
}

function formatDate(d: string): string {
  if (!d?.trim()) return "—";
  const ts = parseFlexibleDateMs(d);
  if (ts === null) return d;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ModuleSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-3">
      <ObserverSearchInput value={value} onChange={onChange} />
    </div>
  );
}

export default function ObserverModulePage() {
  const { moduleId = "" } = useParams<{ moduleId: string }>();
  const config = MODULE_CONFIG[moduleId];
  const stats = useObserverStats();
  const {
    esicEligibilityLimit,
    attendanceDb,
    locationCompliance,
    locationPtEnabled,
    employees,
  } = useHRMS();
  const {
    canView,
    selectedMonth,
    payrollNet,
    filteredSalaryEmployees,
    visitStats,
    commitmentStats,
    tenderStats,
    rawTenders,
    rawContracts,
    rawRenewals,
    expenseStats,
    partnerPayStats,
    rawSchoolPartners,
    rawSchoolWorks,
    supervisorStats,
  } = stats;

  const [moduleSearch, setModuleSearch] = useState("");
  const [detail, setDetail] = useState<{ title: string; fields: DetailField[] } | null>(null);

  const monthLabel = formatMonthLabel(selectedMonth);

  const salaryRows = useMemo(() => {
    return filteredSalaryEmployees
      .map((emp) => ({
        emp,
        id: emp.id,
        name: emp.nameAsPerAadhar || emp.employeeCode,
        role: emp.role || "—",
        net:
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
          ) || 0,
      }))
      .filter((row) => matchesSearch(moduleSearch, row.name, row.role, row.emp.employeeCode, row.emp.location))
      .sort((a, b) => b.net - a.net);
  }, [
    filteredSalaryEmployees,
    selectedMonth,
    esicEligibilityLimit,
    attendanceDb,
    locationCompliance,
    locationPtEnabled,
    moduleSearch,
  ]);

  const employeeRows = useMemo(() => {
    return employees
      .filter((emp) => !emp.exitDate?.trim())
      .map((emp) => ({
        emp,
        id: emp.id,
        name: emp.nameAsPerAadhar || emp.employeeCode,
        role: emp.role || "Staff",
        location: emp.location || "—",
      }))
      .filter((row) =>
        matchesSearch(moduleSearch, row.name, row.role, row.emp.employeeCode, row.location, row.emp.skillCategory),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, moduleSearch]);

  const supervisorRows = useMemo(() => {
    return rawSchoolSupervisors
      .map((sup) => ({
        sup,
        id: sup.id,
        name: sup.name,
        subtitle: `${sup.designation || "Supervisor"} · ${sup.phone || "—"}`,
        online: sup.isOnline,
      }))
      .filter((row) =>
        matchesSearch(
          moduleSearch,
          row.name,
          row.sup.phone,
          row.sup.designation,
          row.sup.assignedBlocks?.join(" "),
        ),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawSchoolSupervisors, moduleSearch]);

  const renewalItems = useMemo(() => {
    if (!config?.renewalCategory) return [];
    return rawRenewals
      .filter((r) => r.category === config.renewalCategory)
      .filter((r) =>
        matchesSearch(moduleSearch, r.title, r.subType, r.clientName, r.ownerType, r.amount),
      )
      .sort((a, b) => {
        const bandA = expiryBand(a);
        const bandB = expiryBand(b);
        const rank = (b: string) => (b === "passed" ? 0 : b === "soon" ? 1 : 2);
        return rank(bandA) - rank(bandB);
      });
  }, [rawRenewals, config?.renewalCategory, moduleSearch]);

  const expenseRows = useMemo(() => {
    return rawSchoolWorks
      .map((school) => {
        const entry = school.monthlyExpenseLedger?.[selectedMonth];
        if (!entry) return null;
        const total =
          (Number(entry.material) || 0) +
          (Number(entry.trek) || 0) +
          (Number(entry.miscellaneous) || 0);
        if (total <= 0) return null;
        return { school, id: school.id, name: school.schoolName, block: school.block, total };
      })
      .filter(Boolean)
      .filter((row) =>
        matchesSearch(moduleSearch, row?.name, row?.block, row?.school.district, row?.school.udise),
      )
      .sort((a, b) => (b?.total || 0) - (a?.total || 0)) as {
      school: (typeof rawSchoolWorks)[0];
      id: string;
      name: string;
      block: string;
      total: number;
    }[];
  }, [rawSchoolWorks, selectedMonth, moduleSearch]);

  const partnerRows = useMemo(() => {
    return rawSchoolPartners
      .map((p) => ({
        partner: p,
        id: p.id,
        name: p.partnerName,
        school: p.schoolName,
        pay: Number(p.monthlyPay) || 0,
        status: p.monthlyPayLedger?.[selectedMonth]?.paymentStatus || "Unpaid",
      }))
      .filter((row) => matchesSearch(moduleSearch, row.name, row.school, row.partner.accountHolderName))
      .sort((a, b) => {
        const order = { Unpaid: 0, Hold: 1, Paid: 2 };
        return (order[a.status as keyof typeof order] ?? 0) - (order[b.status as keyof typeof order] ?? 0);
      });
  }, [rawSchoolPartners, selectedMonth, moduleSearch]);

  const filteredVisits = useMemo(
    () =>
      visitStats.recent.filter((v) =>
        matchesSearch(moduleSearch, v.schoolName, v.supervisorName, v.block, v.udise, v.status),
      ),
    [visitStats.recent, moduleSearch],
  );

  const filteredCommitments = useMemo(
    () =>
      commitmentStats.items.filter((c) =>
        matchesSearch(moduleSearch, c.schoolName, c.supervisorName, c.block, c.status, c.notes),
      ),
    [commitmentStats.items, moduleSearch],
  );

  const filteredTenders = useMemo(
    () =>
      rawTenders
        .filter((t) => !t.deletedAt?.trim())
        .filter((t) => matchesSearch(moduleSearch, t.bidNo, t.department, t.officerName, t.status, t.category)),
    [rawTenders, moduleSearch],
  );

  const filteredContracts = useMemo(
    () =>
      rawContracts.filter((c) =>
        matchesSearch(moduleSearch, c.contractNo, c.companyName, c.officeName, c.officerName, c.status),
      ),
    [rawContracts, moduleSearch],
  );

  if (!config) {
    return <ObserverEmptyState icon={ClipboardList} title="Module not found" />;
  }

  if (!canView(config.permission)) {
    return (
      <ObserverEmptyState
        icon={config.icon}
        title="Access denied"
        hint="You don't have permission to view this module."
      />
    );
  }

  const openDetail = (title: string, fields: DetailField[]) => setDetail({ title, fields });

  if (moduleId === "supervisors") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={MapPin} label="Total" value={supervisorStats.total} accent="blue" />
          <ObserverStatCard icon={MapPin} label="Online Now" value={supervisorStats.online} accent="emerald" />
        </ObserverStatGrid>
        <ObserverSection title="All Supervisors">
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} />
          {supervisorRows.length === 0 ? (
            <ObserverEmptyState icon={MapPin} title="No supervisors found" />
          ) : (
            supervisorRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={row.subtitle}
                badge={row.online ? "Online" : "Offline"}
                badgeTone={row.online ? "green" : "slate"}
                onClick={() => openDetail(row.name, buildSupervisorDetails(row.sup))}
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  if (moduleId === "employees") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={Users} label="Active Staff" value={employeeRows.length} accent="blue" />
        </ObserverStatGrid>
        <ObserverSection title="Employees & Guards">
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} placeholder="Search by name, role, code…" />
          {employeeRows.length === 0 ? (
            <ObserverEmptyState icon={Users} title="No employees found" />
          ) : (
            employeeRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={`${row.role} · ${row.location}`}
                onClick={() =>
                  openDetail(
                    row.name,
                    buildEmployeeDetails(
                      row.emp,
                      selectedMonth,
                      esicEligibilityLimit,
                      attendanceDb,
                      locationCompliance,
                      locationPtEnabled,
                    ),
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  if (moduleId === "salary") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={IndianRupee} label="Total Net Pay" value={formatInr(payrollNet)} sub={monthLabel} accent="orange" />
          <ObserverStatCard icon={IndianRupee} label="Employees" value={filteredSalaryEmployees.length} sub="On payroll" accent="blue" />
        </ObserverStatGrid>
        <ObserverSection title={`Payroll · ${monthLabel}`}>
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} placeholder="Search by name, role, code…" />
          {salaryRows.length === 0 ? (
            <ObserverEmptyState icon={IndianRupee} title="No salary data" />
          ) : (
            salaryRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={row.role}
                value={formatInr(row.net)}
                onClick={() =>
                  openDetail(
                    row.name,
                    buildEmployeeDetails(
                      row.emp,
                      selectedMonth,
                      esicEligibilityLimit,
                      attendanceDb,
                      locationCompliance,
                      locationPtEnabled,
                    ),
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  if (moduleId === "visits") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={ClipboardList} label="Total Visits" value={visitStats.total} accent="slate" />
          <ObserverStatCard icon={ClipboardList} label="Pending" value={visitStats.pending} accent="amber" alert={visitStats.pending > 0} />
          <ObserverStatCard icon={ClipboardList} label="Approved" value={visitStats.approved} accent="emerald" />
        </ObserverStatGrid>
        <ObserverSection title="All Visits">
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} placeholder="Search school, supervisor…" />
          {filteredVisits.length === 0 ? (
            <ObserverEmptyState icon={ClipboardList} title="No visits found" />
          ) : (
            filteredVisits.map((v) => (
              <ObserverListRow
                key={v.id}
                title={v.schoolName}
                subtitle={`${v.supervisorName} · ${formatDate(v.visitDate)}`}
                badge={v.status}
                badgeTone={v.status === "pending" ? "amber" : v.status === "approved" ? "green" : "slate"}
                onClick={() => openDetail(v.schoolName, buildVisitDetails(v))}
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  if (moduleId === "commitments") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={BookOpen} label="Active" value={commitmentStats.active} accent="blue" />
          <ObserverStatCard icon={BookOpen} label="Overdue" value={commitmentStats.overdue} accent="rose" alert={commitmentStats.overdue > 0} />
          <ObserverStatCard icon={BookOpen} label="Upcoming" value={commitmentStats.upcoming} accent="emerald" />
        </ObserverStatGrid>
        <ObserverSection title="All Commitments">
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} />
          {filteredCommitments.length === 0 ? (
            <ObserverEmptyState icon={BookOpen} title="No commitments found" />
          ) : (
            filteredCommitments.map((c) => (
              <ObserverListRow
                key={c.id}
                title={c.schoolName}
                subtitle={`${c.supervisorName} · ${formatDate(c.fromDate)} – ${formatDate(c.toDate)}`}
                badge={c.status.replace("_", " ")}
                badgeTone={
                  c.status === "completed"
                    ? "green"
                    : c.toDate < new Date().toISOString().slice(0, 10) && c.status !== "cancelled"
                      ? "red"
                      : "blue"
                }
                onClick={() => openDetail(c.schoolName, buildCommitmentDetails(c))}
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  if (moduleId === "tenders") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={Gavel} label="Active Tenders" value={tenderStats.total} accent="indigo" />
          <ObserverStatCard icon={Gavel} label="Upcoming Deadlines" value={tenderStats.upcoming} accent="amber" />
        </ObserverStatGrid>
        <ObserverSection title="Tender Pipeline">
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} />
          {filteredTenders.length === 0 ? (
            <ObserverEmptyState icon={Gavel} title="No tenders found" />
          ) : (
            filteredTenders.map((t) => (
              <ObserverListRow
                key={t.id}
                title={t.bidNo || t.department || "Tender"}
                subtitle={`${t.department || "—"} · Due ${formatDate(t.endDate || "")}`}
                badge={t.status || "—"}
                badgeTone="blue"
                onClick={() => openDetail(t.bidNo || "Tender", buildTenderDetails(t))}
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  if (moduleId === "contracts") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={FileText} label="Total Contracts" value={rawContracts.length} accent="slate" />
        </ObserverStatGrid>
        <ObserverSection title="Contracts">
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} />
          {filteredContracts.length === 0 ? (
            <ObserverEmptyState icon={FileText} title="No contracts found" />
          ) : (
            filteredContracts.map((c) => (
              <ObserverListRow
                key={c.id}
                title={c.contractNo || c.companyName || "Contract"}
                subtitle={`${c.officeName || "—"} · Until ${formatDate(c.toDate || "")}`}
                badge={c.status || "—"}
                badgeTone="slate"
                onClick={() => openDetail(c.contractNo || "Contract", buildContractDetails(c))}
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  if (config.renewalCategory) {
    const catStats =
      moduleId === "car-papers"
        ? stats.renewalStats.carPapers
        : moduleId === "it-renewals"
          ? stats.renewalStats.itRenewals
          : stats.renewalStats.licenses;

    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={config.icon} label="Total" value={catStats.total} accent="slate" />
          <ObserverStatCard icon={config.icon} label="Expiring Soon" value={catStats.soon} accent="amber" alert={catStats.soon > 0} />
          <ObserverStatCard icon={config.icon} label="Expired" value={catStats.expired} accent="rose" alert={catStats.expired > 0} />
        </ObserverStatGrid>
        <ObserverSection title={config.title}>
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} />
          {renewalItems.length === 0 ? (
            <ObserverEmptyState icon={config.icon} title={`No ${config.title.toLowerCase()}`} />
          ) : (
            renewalItems.map((r) => {
              const badge = renewalBadge(r);
              return (
                <ObserverListRow
                  key={r.id}
                  title={r.title || r.subType || "Item"}
                  subtitle={`${r.clientName || r.ownerType || "—"} · Exp ${formatDate(r.expiresOn || r.expiryDate || "")}`}
                  badge={badge.label}
                  badgeTone={badge.tone}
                  onClick={() => openDetail(r.title || r.subType || "Item", buildRenewalDetails(r))}
                />
              );
            })
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  if (moduleId === "expenses") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={Receipt} label="Total" value={formatInr(expenseStats.total)} sub={monthLabel} accent="orange" />
          <ObserverStatCard icon={Receipt} label="Material" value={formatInr(expenseStats.material)} accent="blue" />
          <ObserverStatCard icon={Receipt} label="Trek" value={formatInr(expenseStats.trek)} accent="emerald" />
          <ObserverStatCard icon={Receipt} label="Misc" value={formatInr(expenseStats.miscellaneous)} accent="slate" />
        </ObserverStatGrid>
        <ObserverSection title={`School Expenses · ${monthLabel}`}>
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} />
          {expenseRows.length === 0 ? (
            <ObserverEmptyState icon={Receipt} title="No expenses this month" />
          ) : (
            expenseRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={row.block}
                value={formatInr(row.total)}
                onClick={() => openDetail(row.name, buildExpenseDetails(row.school, selectedMonth))}
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  if (moduleId === "partner-pay") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={HandCoins} label="Total Pay" value={formatInr(partnerPayStats.totalPay)} sub={monthLabel} accent="orange" />
          <ObserverStatCard icon={HandCoins} label="Unpaid" value={partnerPayStats.unpaid} accent="rose" alert={partnerPayStats.unpaid > 0} />
          <ObserverStatCard icon={HandCoins} label="Paid" value={partnerPayStats.paid} accent="emerald" />
          <ObserverStatCard icon={HandCoins} label="On Hold" value={partnerPayStats.hold} accent="amber" />
        </ObserverStatGrid>
        <ObserverSection title={`Partners · ${monthLabel}`}>
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} />
          {partnerRows.length === 0 ? (
            <ObserverEmptyState icon={HandCoins} title="No partners found" />
          ) : (
            partnerRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={row.school}
                value={formatInr(row.pay)}
                badge={row.status}
                badgeTone={row.status === "Paid" ? "green" : row.status === "Hold" ? "amber" : "red"}
                onClick={() => openDetail(row.name, buildPartnerDetails(row.partner, selectedMonth))}
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} onClose={() => setDetail(null)} />
        )}
      </div>
    );
  }

  return null;
}
