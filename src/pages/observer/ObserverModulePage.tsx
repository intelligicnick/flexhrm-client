import React, { useMemo } from "react";
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
} from "lucide-react";
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

const MODULE_CONFIG: Record<
  string,
  { title: string; icon: typeof IndianRupee; permission: string; renewalCategory?: string }
> = {
  salary: { title: "Salary", icon: IndianRupee, permission: "Salary" },
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

export default function ObserverModulePage() {
  const { moduleId = "" } = useParams<{ moduleId: string }>();
  const config = MODULE_CONFIG[moduleId];
  const stats = useObserverStats();
  const {
    canView,
    selectedMonth,
    payrollNet,
    filteredSalaryEmployees,
    esicEligibilityLimit,
    attendanceDb,
    locationCompliance,
    locationPtEnabled,
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
  } = stats;

  const monthLabel = formatMonthLabel(selectedMonth);

  const salaryRows = useMemo(() => {
    return filteredSalaryEmployees
      .map((emp) => ({
        id: emp.id,
        name: emp.name,
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
      .sort((a, b) => b.net - a.net)
      .slice(0, 50);
  }, [
    filteredSalaryEmployees,
    selectedMonth,
    esicEligibilityLimit,
    attendanceDb,
    locationCompliance,
    locationPtEnabled,
  ]);

  const renewalItems = useMemo(() => {
    if (!config?.renewalCategory) return [];
    return rawRenewals
      .filter((r) => r.category === config.renewalCategory)
      .sort((a, b) => {
        const bandA = expiryBand(a);
        const bandB = expiryBand(b);
        const rank = (b: string) => (b === "passed" ? 0 : b === "soon" ? 1 : 2);
        return rank(bandA) - rank(bandB);
      });
  }, [rawRenewals, config?.renewalCategory]);

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
        return { id: school.id, name: school.schoolName, block: school.block, total };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.total || 0) - (a?.total || 0)) as { id: string; name: string; block: string; total: number }[];
  }, [rawSchoolWorks, selectedMonth]);

  const partnerRows = useMemo(() => {
    return rawSchoolPartners
      .map((p) => ({
        id: p.id,
        name: p.partnerName,
        school: p.schoolName,
        pay: Number(p.monthlyPay) || 0,
        status: p.monthlyPayLedger?.[selectedMonth]?.paymentStatus || "Unpaid",
      }))
      .sort((a, b) => {
        const order = { Unpaid: 0, Hold: 1, Paid: 2 };
        return (order[a.status as keyof typeof order] ?? 0) - (order[b.status as keyof typeof order] ?? 0);
      });
  }, [rawSchoolPartners, selectedMonth]);

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

  if (moduleId === "salary") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={IndianRupee} label="Total Net Pay" value={formatInr(payrollNet)} sub={monthLabel} accent="orange" />
          <ObserverStatCard icon={IndianRupee} label="Employees" value={filteredSalaryEmployees.length} sub="On payroll" accent="blue" />
        </ObserverStatGrid>
        <ObserverSection title={`Top earners · ${monthLabel}`}>
          {salaryRows.length === 0 ? (
            <ObserverEmptyState icon={IndianRupee} title="No salary data" />
          ) : (
            salaryRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={row.role}
                value={formatInr(row.net)}
              />
            ))
          )}
        </ObserverSection>
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
        <ObserverSection title="Recent Visits">
          {visitStats.recent.length === 0 ? (
            <ObserverEmptyState icon={ClipboardList} title="No visits yet" />
          ) : (
            visitStats.recent.map((v) => (
              <ObserverListRow
                key={v.id}
                title={v.schoolName}
                subtitle={`${v.supervisorName} · ${formatDate(v.visitDate)}`}
                badge={v.status}
                badgeTone={v.status === "pending" ? "amber" : v.status === "approved" ? "green" : "slate"}
              />
            ))
          )}
        </ObserverSection>
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
          {commitmentStats.items.length === 0 ? (
            <ObserverEmptyState icon={BookOpen} title="No commitments" />
          ) : (
            commitmentStats.items.slice(0, 40).map((c) => (
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
              />
            ))
          )}
        </ObserverSection>
      </div>
    );
  }

  if (moduleId === "tenders") {
    const activeTenders = rawTenders.filter((t) => !t.deletedAt?.trim());
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={Gavel} label="Active Tenders" value={tenderStats.total} accent="indigo" />
          <ObserverStatCard icon={Gavel} label="Upcoming Deadlines" value={tenderStats.upcoming} accent="amber" />
        </ObserverStatGrid>
        <ObserverSection title="Tender Pipeline">
          {activeTenders.length === 0 ? (
            <ObserverEmptyState icon={Gavel} title="No tenders" />
          ) : (
            activeTenders.slice(0, 40).map((t) => (
              <ObserverListRow
                key={t.id}
                title={t.bidNo || t.department || "Tender"}
                subtitle={`${t.department || "—"} · Due ${formatDate(t.endDate || "")}`}
                badge={t.status || "—"}
                badgeTone="blue"
              />
            ))
          )}
        </ObserverSection>
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
          {rawContracts.length === 0 ? (
            <ObserverEmptyState icon={FileText} title="No contracts" />
          ) : (
            rawContracts.slice(0, 40).map((c) => (
              <ObserverListRow
                key={c.id}
                title={c.contractNo || c.companyName || "Contract"}
                subtitle={`${c.officeName || "—"} · Until ${formatDate(c.toDate || "")}`}
                badge={c.status || "—"}
                badgeTone="slate"
              />
            ))
          )}
        </ObserverSection>
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
                />
              );
            })
          )}
        </ObserverSection>
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
          {expenseRows.length === 0 ? (
            <ObserverEmptyState icon={Receipt} title="No expenses this month" />
          ) : (
            expenseRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={row.block}
                value={formatInr(row.total)}
              />
            ))
          )}
        </ObserverSection>
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
          {partnerRows.length === 0 ? (
            <ObserverEmptyState icon={HandCoins} title="No partners" />
          ) : (
            partnerRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={row.school}
                value={formatInr(row.pay)}
                badge={row.status}
                badgeTone={row.status === "Paid" ? "green" : row.status === "Hold" ? "amber" : "red"}
              />
            ))
          )}
        </ObserverSection>
      </div>
    );
  }

  return null;
}
