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
import { getDateRangeForPeriod } from "../../lib/supervisor-dates";
import { buildAllExpenseRecords, formatExpenseDate } from "../../lib/school-work-helpers";
import { resolveGemContractNoLabel } from "../../lib/gem-helpers";
import { fetchRenewalDocuments, getRenewalDocumentUrl } from "../../lib/renewals";
import type { Employee, Renewal, SchoolPartner } from "../../types";
import ObserverSearchInput from "./ObserverSearchInput";
import { ObserverDetailSheet } from "./ObserverDetailSheet";
import { ObserverPeriodTabs, type ObserverPeriod } from "./ObserverPeriodTabs";
import { ObserverSupervisorSelect } from "./ObserverPeriodTabs";
import {
  ObserverCommitmentActions,
  ObserverContractStatusActions,
  ObserverPaymentStatusActions,
  ObserverRenewalActions,
  ObserverTenderStatusActions,
  ObserverVisitActions,
} from "./ObserverEditActions";
import {
  buildCommitmentDetails,
  buildContractDetails,
  buildEmployeeDetails,
  buildExpenseRecordDetails,
  buildPartnerDetails,
  buildRenewalDetails,
  buildSupervisorDetails,
  buildTenderDetails,
  buildVisitDetails,
  contractWorksite,
  formatDateTime,
  getSalaryStatusTone,
  getTenderTypeBadge,
  getLastPaidSalaryLabel,
  matchesSearch,
  type DetailField,
  type ObserverDocumentLink,
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
  if (ts === null) return d.trim();
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function ModuleSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="mb-3">
      <ObserverSearchInput value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function filterByPeriod<T extends { visitDate?: string; fromDate?: string }>(
  items: T[],
  period: ObserverPeriod,
  dateField: "visitDate" | "fromDate",
): T[] {
  const range = getDateRangeForPeriod(period);
  return items.filter((item) => {
    const date = item[dateField]?.trim();
    if (!date) return false;
    return date >= range.fromDate && date <= range.toDate;
  });
}

type DetailState = {
  title: string;
  fields: DetailField[];
  documents?: ObserverDocumentLink[];
  actions?: React.ReactNode;
};

function salaryPaymentStatus(emp: Employee, month: string): "Paid" | "Unpaid" | "Hold" {
  return emp.monthlyLedger?.[month]?.paymentStatus || "Unpaid";
}

function partnerPaymentStatus(partner: SchoolPartner, month: string): "Paid" | "Unpaid" | "Hold" {
  return partner.monthlyPayLedger?.[month]?.paymentStatus || "Unpaid";
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
    canViewObserverModule,
    canEdit,
    selectedMonth,
    payrollNet,
    salarySheetEmployees,
    visitStats,
    commitmentStats,
    tenderStats,
    rawTenders,
    observerContracts,
    rawRenewals,
    expenseStats,
    partnerPayStats,
    rawSchoolPartners,
    rawSchoolWorks,
    rawSchoolSupervisors,
    rawSchoolVisits,
    rawCommitmentDiary,
    supervisorStats,
  } = stats;

  const {
    handleUpdateVisitStatus,
    handleUpdateCommitmentDiary,
    handleUpdatePaymentStatus,
    handleSavePartnerPaymentStatus,
    handleUpdateTender,
    handleUpdateContract,
    handleUpdateRenewal,
  } = useHRMS();

  const [moduleSearch, setModuleSearch] = useState("");
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [visitPeriod, setVisitPeriod] = useState<ObserverPeriod>("month");
  const [visitSupervisorId, setVisitSupervisorId] = useState("all");
  const [commitmentPeriod, setCommitmentPeriod] = useState<ObserverPeriod>("month");
  const [commitmentSupervisorId, setCommitmentSupervisorId] = useState("all");

  const monthLabel = formatMonthLabel(selectedMonth);

  const salaryRows = useMemo(() => {
    return salarySheetEmployees
      .map((emp) => ({
        emp,
        id: emp.id,
        name: emp.nameAsPerAadhar || emp.employeeCode,
        role: emp.role || "—",
        status: getLastPaidSalaryLabel(emp).label,
        statusTone: getLastPaidSalaryLabel(emp).tone,
        location: emp.location || "—",
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
      .filter((row) =>
        matchesSearch(
          moduleSearch,
          row.name,
          row.role,
          row.emp.employeeCode,
          row.emp.location,
          row.status,
        ),
      )
      .sort((a, b) => b.net - a.net);
  }, [
    salarySheetEmployees,
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
    const monthRecords = buildAllExpenseRecords(rawSchoolWorks).filter(
      (row) => row.monthKey === selectedMonth,
    );
    const monthTotal = monthRecords.reduce((sum, row) => sum + row.amount, 0);
    return monthRecords
      .map((row, index) => ({
        row,
        id: `${row.monthKey}-${row.block}-${row.type}-${index}`,
        monthTotal,
      }))
      .filter(({ row }) =>
        matchesSearch(
          moduleSearch,
          row.type,
          row.block,
          row.district,
          row.remarks,
          row.date,
          formatMonthLabel(selectedMonth),
        ),
      );
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

  const filteredVisits = useMemo(() => {
    let items = filterByPeriod(rawSchoolVisits, visitPeriod, "visitDate");
    if (visitSupervisorId !== "all") {
      items = items.filter((v) => v.supervisorId === visitSupervisorId);
    }
    return items
      .filter((v) =>
        matchesSearch(moduleSearch, v.schoolName, v.supervisorName, v.block, v.udise, v.status),
      )
      .sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || ""));
  }, [rawSchoolVisits, visitPeriod, visitSupervisorId, moduleSearch]);

  const filteredCommitments = useMemo(() => {
    let items = filterByPeriod(rawCommitmentDiary, commitmentPeriod, "fromDate");
    if (commitmentSupervisorId !== "all") {
      items = items.filter((c) => c.supervisorId === commitmentSupervisorId);
    }
    return items
      .filter((c) =>
        matchesSearch(moduleSearch, c.schoolName, c.supervisorName, c.block, c.status, c.notes),
      )
      .sort((a, b) => (b.fromDate || "").localeCompare(a.fromDate || ""));
  }, [rawCommitmentDiary, commitmentPeriod, commitmentSupervisorId, moduleSearch]);

  const filteredTenders = useMemo(
    () =>
      rawTenders
        .filter((t) => !t.deletedAt?.trim())
        .filter((t) => matchesSearch(moduleSearch, t.bidNo, t.department, t.officerName, t.status, t.category)),
    [rawTenders, moduleSearch],
  );

  const filteredContracts = useMemo(
    () =>
      observerContracts.filter((c) =>
        matchesSearch(moduleSearch, c.contractNo, c.companyName, c.officeName, c.officerName, c.status),
      ),
    [observerContracts, moduleSearch],
  );

  const openDetail = (
    title: string,
    fields: DetailField[],
    documents?: ObserverDocumentLink[],
    actions?: React.ReactNode,
  ) => setDetail({ title, fields, documents, actions });

  const closeDetail = () => setDetail(null);

  const openRenewalDetail = async (title: string, renewal: Renewal) => {
    try {
      const docs = await fetchRenewalDocuments(renewal.id);
      openDetail(
        title,
        buildRenewalDetails(renewal),
        docs.map((doc) => ({
          id: doc.id,
          label: doc.label || doc.filename,
          url: getRenewalDocumentUrl(renewal.id, doc),
          mimeType: doc.mimeType,
        })),
        canEdit(config?.permission || "Car Papers") ? (
          <ObserverRenewalActions
            renewal={renewal}
            onUpdate={handleUpdateRenewal}
            onComplete={closeDetail}
          />
        ) : undefined,
      );
    } catch {
      openDetail(
        title,
        buildRenewalDetails(renewal),
        undefined,
        canEdit(config?.permission || "Car Papers") ? (
          <ObserverRenewalActions
            renewal={renewal}
            onUpdate={handleUpdateRenewal}
            onComplete={closeDetail}
          />
        ) : undefined,
      );
    }
  };

  if (!config) {
    return <ObserverEmptyState icon={ClipboardList} title="Module not found" />;
  }

  if (!canViewObserverModule(moduleId)) {
    return (
      <ObserverEmptyState
        icon={config.icon}
        title="Access denied"
        hint="You don't have permission to view this module."
      />
    );
  }

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
          <ObserverDetailSheet
            title={detail.title}
            fields={detail.fields}
            documents={detail.documents}
            actions={detail.actions}
            onClose={closeDetail}
          />
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
                    undefined,
                    canEdit("Salary") ? (
                      <ObserverPaymentStatusActions
                        currentStatus={salaryPaymentStatus(row.emp, selectedMonth)}
                        onSave={async (status) => {
                          await handleUpdatePaymentStatus(row.emp.id, status);
                        }}
                        onComplete={closeDetail}
                      />
                    ) : undefined,
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet
            title={detail.title}
            fields={detail.fields}
            documents={detail.documents}
            actions={detail.actions}
            onClose={closeDetail}
          />
        )}
      </div>
    );
  }

  if (moduleId === "salary") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={IndianRupee} label="Total Net Pay" value={formatInr(payrollNet)} sub={monthLabel} accent="orange" />
          <ObserverStatCard icon={IndianRupee} label="Employees" value={salarySheetEmployees.length} sub="On payroll" accent="blue" />
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
                subtitle={`${row.role} · ${row.location} · ${formatInr(row.net)}`}
                badge={row.status}
                badgeTone={row.statusTone || getSalaryStatusTone(row.status)}
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
                    undefined,
                    canEdit("Salary") ? (
                      <ObserverPaymentStatusActions
                        currentStatus={salaryPaymentStatus(row.emp, selectedMonth)}
                        onSave={async (status) => {
                          await handleUpdatePaymentStatus(row.emp.id, status);
                        }}
                        onComplete={closeDetail}
                      />
                    ) : undefined,
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet
            title={detail.title}
            fields={detail.fields}
            documents={detail.documents}
            actions={detail.actions}
            onClose={closeDetail}
          />
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
        <ObserverSection title="Visits">
          <div className="space-y-2 mb-3">
            <ObserverPeriodTabs period={visitPeriod} onPeriodChange={setVisitPeriod} />
            <ObserverSupervisorSelect
              supervisors={rawSchoolSupervisors}
              value={visitSupervisorId}
              onChange={setVisitSupervisorId}
            />
          </div>
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
                onClick={() =>
                  openDetail(
                    v.schoolName,
                    buildVisitDetails(v),
                    undefined,
                    canEdit("Field Team") ? (
                      <ObserverVisitActions
                        visitId={v.id}
                        status={v.status}
                        onUpdate={handleUpdateVisitStatus}
                        onComplete={closeDetail}
                      />
                    ) : undefined,
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet
            title={detail.title}
            fields={detail.fields}
            documents={detail.documents}
            actions={detail.actions}
            onClose={closeDetail}
          />
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
        <ObserverSection title="Commitment Diary">
          <div className="space-y-2 mb-3">
            <ObserverPeriodTabs period={commitmentPeriod} onPeriodChange={setCommitmentPeriod} />
            <ObserverSupervisorSelect
              supervisors={rawSchoolSupervisors}
              value={commitmentSupervisorId}
              onChange={setCommitmentSupervisorId}
            />
          </div>
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
                onClick={() =>
                  openDetail(
                    c.schoolName,
                    buildCommitmentDetails(c),
                    undefined,
                    canEdit("Field Team") ? (
                      <ObserverCommitmentActions
                        commitment={c}
                        onUpdate={handleUpdateCommitmentDiary}
                        onComplete={closeDetail}
                      />
                    ) : undefined,
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet
            title={detail.title}
            fields={detail.fields}
            documents={detail.documents}
            actions={detail.actions}
            onClose={closeDetail}
          />
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
            filteredTenders.map((t) => {
              const typeBadge = getTenderTypeBadge(t);
              return (
                <ObserverListRow
                  key={t.id}
                  title={t.bidNo || "Tender"}
                  subtitle={[t.department, t.officerName].filter(Boolean).join(" · ") || undefined}
                  dateLabel={`Pre-bid ${formatDateTime(t.preBidAt)} · End ${formatDate(t.endDate || "")}`}
                  value={t.quantity ? String(t.quantity) : undefined}
                  valueTone="green"
                  badge={typeBadge.label}
                  badgeTone={typeBadge.tone}
                  onClick={() =>
                    openDetail(
                      t.bidNo || "Tender",
                      buildTenderDetails(t),
                      undefined,
                      canEdit("Tenders") ? (
                        <ObserverTenderStatusActions
                          tender={t}
                          onUpdate={handleUpdateTender}
                          onComplete={closeDetail}
                        />
                      ) : undefined,
                    )
                  }
                />
              );
            })
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet
            title={detail.title}
            fields={detail.fields}
            documents={detail.documents}
            actions={detail.actions}
            onClose={closeDetail}
          />
        )}
      </div>
    );
  }

  if (moduleId === "contracts") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={FileText} label="Total Contracts" value={observerContracts.length} accent="slate" />
        </ObserverStatGrid>
        <ObserverSection title="Contracts">
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} />
          {filteredContracts.length === 0 ? (
            <ObserverEmptyState icon={FileText} title="No contracts found" />
          ) : (
            filteredContracts.map((c) => (
              <ObserverListRow
                key={c.id}
                title={resolveGemContractNoLabel(c) || c.contractNo || "Contract"}
                subtitle={contractWorksite(c)}
                dateLabel={`${formatDate(c.fromDate || "")} – ${formatDate(c.toDate || "")}`}
                badge={c.status || "—"}
                badgeTone="slate"
                onClick={() =>
                  openDetail(
                    resolveGemContractNoLabel(c) || c.contractNo || "Contract",
                    buildContractDetails(c),
                    undefined,
                    canEdit("Contracts") ? (
                      <ObserverContractStatusActions
                        contract={c}
                        onUpdate={handleUpdateContract}
                        onComplete={closeDetail}
                      />
                    ) : undefined,
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet
            title={detail.title}
            fields={detail.fields}
            documents={detail.documents}
            actions={detail.actions}
            onClose={closeDetail}
          />
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
                  onClick={() => openRenewalDetail(r.title || r.subType || "Item", r)}
                />
              );
            })
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet
            title={detail.title}
            fields={detail.fields}
            documents={detail.documents}
            actions={detail.actions}
            onClose={closeDetail}
          />
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
        <ObserverSection title={`Expenses · ${monthLabel}`}>
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} />
          {expenseRows.length === 0 ? (
            <ObserverEmptyState icon={Receipt} title="No expenses this month" />
          ) : (
            expenseRows.map(({ row, id, monthTotal }) => (
              <ObserverListRow
                key={id}
                title={row.date ? formatExpenseDate(row.date) : row.type}
                subtitle={`${row.type} · ${row.district || "—"} · ${row.block}`}
                value={formatInr(row.amount)}
                onClick={() =>
                  openDetail(
                    `${row.type} · ${row.block}`,
                    buildExpenseRecordDetails(row, monthTotal),
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet
            title={detail.title}
            fields={detail.fields}
            documents={detail.documents}
            actions={detail.actions}
            onClose={closeDetail}
          />
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
                badge={row.status}
                badgeTone={row.status === "Paid" ? "green" : row.status === "Hold" ? "amber" : "red"}
                value={formatInr(row.pay)}
                onClick={() =>
                  openDetail(
                    row.name,
                    buildPartnerDetails(row.partner, selectedMonth),
                    undefined,
                    canEdit("Monthly Billing") ? (
                      <ObserverPaymentStatusActions
                        currentStatus={partnerPaymentStatus(row.partner, selectedMonth)}
                        onSave={async (status) =>
                          handleSavePartnerPaymentStatus([{ id: row.partner.id, paymentStatus: status }])
                        }
                        onComplete={closeDetail}
                      />
                    ) : undefined,
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet
            title={detail.title}
            fields={detail.fields}
            documents={detail.documents}
            actions={detail.actions}
            onClose={closeDetail}
          />
        )}
      </div>
    );
  }

  return null;
}
