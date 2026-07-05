import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
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
  Calculator,
  Clock,
  Contact,
  Cake,
  Activity,
  Camera,
} from "lucide-react";
import { useHRMS } from "../../context/HRMSContext";
import { useObserverStats } from "./useObserverStats";
import { countMonthAttendance } from "../../lib/attendance-helpers";
import { getDaysInMonthStatic, MONTH_NAME_LIST } from "../../lib/date-helpers";
import { isEmployeeExitedForMonth, isEmployeeExitedOnDayStatic } from "../../lib/employee-helpers";
import { getMonthLedger, getTotalByType } from "../../lib/ledger-helpers";
import { monitorApi, todayKey, type MonitorOverview, type MonitoredEmployee } from "../../lib/monitor-api";
import { formatClock } from "../../lib/monitor-time";
import MonitorScreenshotLightbox from "../../components/monitor/MonitorScreenshotLightbox";
import { parseApiError } from "../../api";
import { observerRouteToModuleId } from "../../lib/observer-access";
import { phoneToTelHref } from "../../lib/phone-helpers";
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
  ObserverLedgerActions,
  ObserverAttendanceActions,
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
  buildLedgerDetails,
  buildAttendanceDetails,
  buildDirectoryEmployeeDetails,
  buildHelplineDetails,
  buildBirthdayDetails,
  buildMonitorSessionDetails,
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
  "advance-penalty": { title: "Advance & Penalty", icon: Calculator, permission: "Advance & Penalty" },
  attendance: { title: "Attendance", icon: Clock, permission: "Attendance" },
  directory: { title: "Directory", icon: Contact, permission: "Directory" },
  birthdays: { title: "Birthdays", icon: Cake, permission: "Birthdays" },
  monitor: { title: "Employee Monitor", icon: Activity, permission: "Monitor" },
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
  employeeId?: string;
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
    ledgerStats,
    attendanceSummary,
  } = stats;

  const { fetchHelplines, helplines } = useHRMS();

  const {
    handleUpdateVisitStatus,
    handleUpdateCommitmentDiary,
    handleUpdatePaymentStatus,
    handleSavePartnerPaymentStatus,
    handleUpdateTender,
    handleUpdateContract,
    handleUpdateRenewal,
    handleObserverSaveLedgerBatch,
    handleObserverUpdateLedgerItem,
    handleDeleteLedgerItem,
    handleCellAttendanceChange,
    fetchEmployees,
    userPermissions,
  } = useHRMS();

  const [moduleSearch, setModuleSearch] = useState("");
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [visitPeriod, setVisitPeriod] = useState<ObserverPeriod>("month");
  const [visitSupervisorId, setVisitSupervisorId] = useState("all");
  const [commitmentPeriod, setCommitmentPeriod] = useState<ObserverPeriod>("month");
  const [commitmentSupervisorId, setCommitmentSupervisorId] = useState("all");
  const [directorySubTab, setDirectorySubTab] = useState<"employees" | "contacts">("employees");
  const [birthdayTodayList, setBirthdayTodayList] = useState<Array<Employee & { age?: number }>>([]);
  const [birthdayMonthList, setBirthdayMonthList] = useState<Array<Employee & { birthdayDay?: number; age?: number }>>([]);
  const [birthdaysLoading, setBirthdaysLoading] = useState(false);
  const [monitorOverview, setMonitorOverview] = useState<MonitorOverview | null>(null);
  const [monitoredEmployees, setMonitoredEmployees] = useState<MonitoredEmployee[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [monitorSubTab, setMonitorSubTab] = useState<"sessions" | "screenshots">("sessions");
  const [monitorScreenshots, setMonitorScreenshots] = useState<
    Array<{ id: string; imageUrl: string; timestamp: string; appName: string; employeeId: string; employeeName?: string }>
  >([]);
  const [monitorScreenshotsLoading, setMonitorScreenshotsLoading] = useState(false);
  const [monitorEmployeeFilter, setMonitorEmployeeFilter] = useState("");
  const [monitorScreenshotDate, setMonitorScreenshotDate] = useState(todayKey());
  const [screenshotViewerIndex, setScreenshotViewerIndex] = useState<number | null>(null);

  const monthLabel = formatMonthLabel(selectedMonth);

  useEffect(() => {
    if (moduleId !== "directory") return;
    void fetchHelplines();
  }, [moduleId, fetchHelplines]);

  useEffect(() => {
    if (moduleId !== "birthdays") return;
    const monthParts = selectedMonth.split(" ");
    const monthNum = MONTH_NAME_LIST.indexOf(monthParts[0]) + 1;
    if (monthNum < 1) return;

    let cancelled = false;
    setBirthdaysLoading(true);
    fetch(`/api/employees/birthdays?month=${monthNum}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw await parseApiError(res, "Failed to fetch birthdays.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setBirthdayTodayList(Array.isArray(data.today) ? data.today : []);
        setBirthdayMonthList(Array.isArray(data.month) ? data.month : []);
      })
      .catch(() => {
        if (!cancelled) {
          setBirthdayTodayList([]);
          setBirthdayMonthList([]);
        }
      })
      .finally(() => {
        if (!cancelled) setBirthdaysLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId, selectedMonth]);

  useEffect(() => {
    if (moduleId !== "advance-penalty" && moduleId !== "salary") return;
    void fetchEmployees({ forceLedger: true });
  }, [moduleId, selectedMonth, fetchEmployees]);

  useEffect(() => {
    if (moduleId !== "monitor") return;
    let cancelled = false;
    setMonitorLoading(true);
    setMonitorError(null);
    Promise.all([monitorApi.getOverview(), monitorApi.getEmployees()])
      .then(([overview, employees]) => {
        if (cancelled) return;
        setMonitorOverview(overview);
        setMonitoredEmployees(employees);
      })
      .catch((err: Error) => {
        if (!cancelled) setMonitorError(err.message || "Could not load monitor data.");
      })
      .finally(() => {
        if (!cancelled) setMonitorLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  useEffect(() => {
    if (moduleId !== "monitor" || monitorSubTab !== "screenshots") return;
    let cancelled = false;
    setMonitorScreenshotsLoading(true);
    monitorApi
      .getScreenshots({
        employeeId: monitorEmployeeFilter || undefined,
        date: monitorScreenshotDate,
        period: "daily",
      })
      .then((data) => {
        if (!cancelled) setMonitorScreenshots(data);
      })
      .catch(() => {
        if (!cancelled) setMonitorScreenshots([]);
      })
      .finally(() => {
        if (!cancelled) setMonitorScreenshotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moduleId, monitorSubTab, monitorEmployeeFilter, monitorScreenshotDate]);

  useEffect(() => {
    if (monitorSubTab !== "screenshots") setScreenshotViewerIndex(null);
  }, [monitorSubTab, monitorEmployeeFilter, monitorScreenshotDate, moduleSearch]);

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

  const activeRosterEmployees = useMemo(
    () => employees.filter((emp) => !isEmployeeExitedForMonth(emp, selectedMonth)),
    [employees, selectedMonth],
  );

  const ledgerRows = useMemo(() => {
    return activeRosterEmployees
      .map((emp) => {
        const ledger = getMonthLedger(emp, selectedMonth);
        const advance = getTotalByType(ledger, "advance");
        const penalty = getTotalByType(ledger, "penalty");
        const uniform = getTotalByType(ledger, "uniform");
        const food = getTotalByType(ledger, "foodPerk");
        const accom = getTotalByType(ledger, "accommodationPerk");
        const conveyance = getTotalByType(ledger, "conveyancePerk");
        return {
          emp,
          id: emp.id,
          name: emp.nameAsPerAadhar || emp.employeeCode,
          advance,
          penalty,
          uniform,
          food,
          accom,
          conveyance,
          total: advance + penalty + uniform + food + accom + conveyance,
        };
      })
      .filter((row) =>
        matchesSearch(moduleSearch, row.name, row.emp.employeeCode, row.emp.location, row.advance, row.penalty),
      )
      .sort((a, b) => a.name.localeCompare(b.name) || b.total - a.total);
  }, [activeRosterEmployees, selectedMonth, moduleSearch]);

  const attendanceRows = useMemo(() => {
    const daysInMonth = getDaysInMonthStatic(selectedMonth);
    const monthData = attendanceDb[selectedMonth] || {};
    return activeRosterEmployees
      .map((emp) => {
        const empData = monthData[emp.id] || {};
        const counts = countMonthAttendance(
          empData,
          daysInMonth,
          (day) => isEmployeeExitedOnDayStatic(emp, selectedMonth, day),
          { workingDaysType: emp.workingDaysType, monthStr: selectedMonth },
        );
        const total = counts.presents + counts.absents;
        const presentPct = total > 0 ? Math.round((counts.presents / total) * 100) : 0;
        return {
          emp,
          id: emp.id,
          name: emp.nameAsPerAadhar || emp.employeeCode,
          presents: counts.presents,
          absents: counts.absents,
          presentPct,
        };
      })
      .filter((row) =>
        matchesSearch(
          moduleSearch,
          row.name,
          row.emp.employeeCode,
          row.emp.role,
          row.emp.location,
          row.presents,
          row.absents,
        ),
      )
      .sort((a, b) => a.name.localeCompare(b.name) || b.presentPct - a.presentPct || b.presents - a.presents);
  }, [activeRosterEmployees, attendanceDb, selectedMonth, moduleSearch]);

  const directoryEmployeeRows = useMemo(() => {
    return employees
      .filter((emp) => !emp.exitDate?.trim())
      .map((emp) => ({
        emp,
        id: emp.id,
        name: emp.nameAsPerAadhar || emp.employeeCode,
        role: emp.role || "—",
        phone: emp.employeeMobile || "—",
        location: emp.location || "—",
      }))
      .filter((row) =>
        matchesSearch(moduleSearch, row.name, row.role, row.phone, row.location, row.emp.employeeCode),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, moduleSearch]);

  const helplineRows = useMemo(() => {
    return (helplines || [])
      .map((line: { _id?: string; name?: string; phone?: string; location?: string; category?: string }, index: number) => ({
        line,
        id: line._id || `helpline-${index}`,
        name: line.name || "Helpline",
        phone: line.phone || "—",
        location: line.location || "—",
      }))
      .filter((row) => matchesSearch(moduleSearch, row.name, row.phone, row.location, row.line.category))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [helplines, moduleSearch]);

  const birthdayMonthRows = useMemo(() => {
    return birthdayMonthList
      .map((emp) => ({
        emp,
        id: emp.id,
        name: emp.nameAsPerAadhar || emp.employeeCode,
        day: emp.birthdayDay,
        age: emp.age,
      }))
      .filter((row) => matchesSearch(moduleSearch, row.name, row.emp.employeeCode, row.emp.role, row.emp.location, row.day))
      .sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  }, [birthdayMonthList, moduleSearch]);

  const monitorSessionRows = useMemo(() => {
    return (monitorOverview?.workSessions || [])
      .map((session) => ({
        session,
        id: `${session.employeeId}-${session.loginTime || "unknown"}`,
        name: session.employeeName || session.employeeCode,
        hours: session.totalHoursWorkedSeconds
          ? `${(session.totalHoursWorkedSeconds / 3600).toFixed(1)}h`
          : `${session.totalHoursWorked.toFixed(1)}h`,
      }))
      .filter((row) =>
        matchesSearch(moduleSearch, row.name, row.session.employeeCode, row.session.loginTime, row.hours),
      );
  }, [monitorOverview, moduleSearch]);

  const monitorScreenshotRows = useMemo(() => {
    const empMap = new Map(monitoredEmployees.map((e) => [e.id, e.name || e.employeeCode]));
    return monitorScreenshots
      .map((shot) => ({
        ...shot,
        employeeName: shot.employeeName || empMap.get(shot.employeeId) || "",
      }))
      .filter((shot) =>
        matchesSearch(
          moduleSearch,
          shot.appName,
          shot.employeeName,
          shot.employeeId,
          formatClock(shot.timestamp),
        ),
      );
  }, [monitorScreenshots, monitoredEmployees, moduleSearch]);

  const openDetail = (
    title: string,
    fields: DetailField[],
    documents?: ObserverDocumentLink[],
    actions?: React.ReactNode,
    employeeId?: string,
  ) => setDetail({ title, fields, documents, actions, employeeId });

  const closeDetail = () => setDetail(null);

  const buildLedgerActions = (emp: Employee) =>
    canEdit("Advance & Penalty") ? (
      <ObserverLedgerActions
        employee={emp}
        monthKey={selectedMonth}
        canDelete={!!userPermissions.ledger?.delete}
        onSaveBatch={(entry) => handleObserverSaveLedgerBatch(emp.id, entry)}
        onUpdate={(itemId, patch) => handleObserverUpdateLedgerItem(emp.id, itemId, patch)}
        onDelete={(itemId) => handleDeleteLedgerItem(emp.id, itemId)}
      />
    ) : undefined;

  const buildAttendanceActions = (emp: Employee) =>
    canEdit("Attendance") ? (
      <ObserverAttendanceActions
        employee={emp}
        monthKey={selectedMonth}
        attendanceDb={attendanceDb}
        onCellChange={handleCellAttendanceChange}
      />
    ) : undefined;

  const resolvedDetail = useMemo(() => {
    if (!detail?.employeeId) return detail;
    const emp = employees.find((e) => e.id === detail.employeeId);
    if (!emp) return detail;
    if (moduleId === "advance-penalty") {
      return {
        ...detail,
        fields: buildLedgerDetails(emp, selectedMonth),
        actions: buildLedgerActions(emp),
      };
    }
    if (moduleId === "attendance") {
      const daysInMonth = getDaysInMonthStatic(selectedMonth);
      const monthData = attendanceDb[selectedMonth] || {};
      const empData = monthData[emp.id] || {};
      const counts = countMonthAttendance(
        empData,
        daysInMonth,
        (day) => isEmployeeExitedOnDayStatic(emp, selectedMonth, day),
        { workingDaysType: emp.workingDaysType, monthStr: selectedMonth },
      );
      return {
        ...detail,
        fields: buildAttendanceDetails(emp, selectedMonth, counts.presents, counts.absents),
        actions: buildAttendanceActions(emp),
      };
    }
    return detail;
  }, [
    detail,
    employees,
    attendanceDb,
    selectedMonth,
    moduleId,
    canEdit,
    handleObserverSaveLedgerBatch,
    handleDeleteLedgerItem,
    handleCellAttendanceChange,
  ]);

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

  if (!config || !observerRouteToModuleId(moduleId)) {
    return <Navigate to="/observer/menu" replace />;
  }

  if (!canViewObserverModule(moduleId)) {
    return <Navigate to="/observer/menu" replace />;
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

  if (moduleId === "advance-penalty") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={Calculator} label="Employees" value={activeRosterEmployees.length} sub="Active roster" accent="slate" />
          <ObserverStatCard icon={Calculator} label="Advances" value={formatInr(ledgerStats.advanceTotal)} sub={monthLabel} accent="blue" />
          <ObserverStatCard icon={Calculator} label="Penalties" value={formatInr(ledgerStats.penaltyTotal)} sub={monthLabel} accent="rose" />
          <ObserverStatCard icon={Calculator} label="Perks" value={formatInr(ledgerStats.perkTotal)} sub={monthLabel} accent="indigo" />
        </ObserverStatGrid>
        <ObserverSection title={`Advance & Penalty · ${monthLabel}`}>
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} placeholder="Search by name, code, location…" />
          {ledgerRows.length === 0 ? (
            <ObserverEmptyState icon={Calculator} title="No employees on roster" hint="Active employees for this month will appear here." />
          ) : (
            ledgerRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={
                  row.total > 0
                    ? `${row.emp.location || "—"} · Adv ${formatInr(row.advance)} · Pen ${formatInr(row.penalty)} · Perks ${formatInr(row.uniform + row.food + row.accom + row.conveyance)}`
                    : `${row.emp.location || "—"} · Tap to record advance, penalty & perks`
                }
                value={row.total > 0 ? formatInr(row.total) : "Record"}
                badge={row.total > 0 ? undefined : "No entries"}
                badgeTone={row.total > 0 ? undefined : "slate"}
                onClick={() =>
                  openDetail(
                    row.name,
                    buildLedgerDetails(row.emp, selectedMonth),
                    undefined,
                    buildLedgerActions(row.emp),
                    row.emp.id,
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {resolvedDetail && (
          <ObserverDetailSheet title={resolvedDetail.title} fields={resolvedDetail.fields} documents={resolvedDetail.documents} actions={resolvedDetail.actions} onClose={closeDetail} />
        )}
      </div>
    );
  }

  if (moduleId === "attendance") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={Clock} label="Present Rate" value={`${attendanceSummary.presentPct}%`} sub={monthLabel} accent="emerald" />
          <ObserverStatCard icon={Clock} label="Employees" value={attendanceSummary.activeEmployees} sub="Active roster" accent="blue" />
          <ObserverStatCard icon={Clock} label="Present Days" value={attendanceSummary.presents} accent="emerald" />
          <ObserverStatCard icon={Clock} label="Absent Days" value={attendanceSummary.absents} accent="rose" alert={attendanceSummary.absents > 0} />
        </ObserverStatGrid>
        <ObserverSection title={`Attendance · ${monthLabel}`}>
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} placeholder="Search by name, role, code…" />
          {attendanceRows.length === 0 ? (
            <ObserverEmptyState icon={Clock} title="No attendance data" />
          ) : (
            attendanceRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={`${row.emp.role || "—"} · ${row.emp.location || "—"}`}
                badge={row.presents + row.absents > 0 ? `${row.presentPct}%` : "Not marked"}
                badgeTone={
                  row.presents + row.absents === 0
                    ? "slate"
                    : row.presentPct >= 80
                      ? "green"
                      : row.presentPct >= 50
                        ? "amber"
                        : "red"
                }
                value={row.presents + row.absents > 0 ? `${row.presents}P / ${row.absents}A` : "Tap to mark"}
                onClick={() =>
                  openDetail(
                    row.name,
                    buildAttendanceDetails(row.emp, selectedMonth, row.presents, row.absents),
                    undefined,
                    buildAttendanceActions(row.emp),
                    row.emp.id,
                  )
                }
              />
            ))
          )}
        </ObserverSection>
        {resolvedDetail && (
          <ObserverDetailSheet title={resolvedDetail.title} fields={resolvedDetail.fields} documents={resolvedDetail.documents} actions={resolvedDetail.actions} onClose={closeDetail} />
        )}
      </div>
    );
  }

  if (moduleId === "directory") {
    return (
      <div className="space-y-4 pb-2">
        <div className="flex bg-white border border-slate-200 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setDirectorySubTab("employees")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              directorySubTab === "employees" ? "bg-[#ff791a] text-white" : "text-slate-600"
            }`}
          >
            Employees
          </button>
          <button
            type="button"
            onClick={() => setDirectorySubTab("contacts")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              directorySubTab === "contacts" ? "bg-[#ff791a] text-white" : "text-slate-600"
            }`}
          >
            Helplines
          </button>
        </div>
        <ObserverSection title={directorySubTab === "employees" ? "Employee Directory" : "Important Helplines"}>
          <ModuleSearch value={moduleSearch} onChange={setModuleSearch} placeholder="Search contacts…" />
          {directorySubTab === "employees" ? (
            directoryEmployeeRows.length === 0 ? (
              <ObserverEmptyState icon={Contact} title="No employees found" />
            ) : (
              directoryEmployeeRows.map((row) => (
                <ObserverListRow
                  key={row.id}
                  title={row.name}
                  subtitle={`${row.role} · ${row.location}`}
                  value={row.phone}
                  valueHref={phoneToTelHref(row.phone)}
                  onClick={() => openDetail(row.name, buildDirectoryEmployeeDetails(row.emp))}
                />
              ))
            )
          ) : helplineRows.length === 0 ? (
            <ObserverEmptyState icon={Contact} title="No helplines found" />
          ) : (
            helplineRows.map((row) => (
              <ObserverListRow
                key={row.id}
                title={row.name}
                subtitle={row.location}
                value={row.phone}
                valueHref={phoneToTelHref(row.phone)}
                onClick={() => openDetail(row.name, buildHelplineDetails(row.line))}
              />
            ))
          )}
        </ObserverSection>
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} documents={detail.documents} actions={detail.actions} onClose={closeDetail} />
        )}
      </div>
    );
  }

  if (moduleId === "birthdays") {
    return (
      <div className="space-y-4 pb-2">
        <ObserverStatGrid>
          <ObserverStatCard icon={Cake} label="Today" value={birthdayTodayList.length} accent="orange" alert={birthdayTodayList.length > 0} />
          <ObserverStatCard icon={Cake} label="This Month" value={birthdayMonthRows.length} sub={monthLabel} accent="amber" />
        </ObserverStatGrid>
        {birthdaysLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {birthdayTodayList.length > 0 && (
              <ObserverSection title="Today's Birthdays">
                {birthdayTodayList.map((emp) => (
                  <ObserverListRow
                    key={emp.id}
                    title={emp.nameAsPerAadhar || emp.employeeCode}
                    subtitle={emp.role || emp.location || "—"}
                    badge="Today"
                    badgeTone="amber"
                    onClick={() => openDetail(emp.nameAsPerAadhar || emp.employeeCode, buildBirthdayDetails(emp, emp.age))}
                  />
                ))}
              </ObserverSection>
            )}
            <ObserverSection title={`Birthdays · ${monthLabel}`}>
              <ModuleSearch value={moduleSearch} onChange={setModuleSearch} placeholder="Search birthdays…" />
              {birthdayMonthRows.length === 0 ? (
                <ObserverEmptyState icon={Cake} title="No birthdays this month" />
              ) : (
                birthdayMonthRows.map((row) => (
                  <ObserverListRow
                    key={row.id}
                    title={row.name}
                    subtitle={row.emp.role || row.emp.location || "—"}
                    badge={row.day ? `Day ${row.day}` : "—"}
                    badgeTone="blue"
                    onClick={() => openDetail(row.name, buildBirthdayDetails(row.emp, row.age))}
                  />
                ))
              )}
            </ObserverSection>
          </>
        )}
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} documents={detail.documents} actions={detail.actions} onClose={closeDetail} />
        )}
      </div>
    );
  }

  if (moduleId === "monitor") {
    return (
      <div className="space-y-4 pb-2">
        {monitorLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
          </div>
        ) : monitorError ? (
          <ObserverEmptyState icon={Activity} title="Monitor unavailable" hint={monitorError} />
        ) : (
          <>
            <ObserverStatGrid>
              <ObserverStatCard icon={Activity} label="Online" value={monitorOverview?.employeesOnline ?? 0} accent="emerald" />
              <ObserverStatCard icon={Activity} label="Offline" value={monitorOverview?.employeesOffline ?? 0} accent="slate" />
              <ObserverStatCard icon={Camera} label="Screenshots" value={monitorOverview?.screenshotCount ?? 0} accent="indigo" sub="today" />
              <ObserverStatCard icon={Activity} label="Alerts" value={monitorOverview?.openAlerts ?? 0} accent="rose" alert={(monitorOverview?.openAlerts ?? 0) > 0} />
            </ObserverStatGrid>

            <div className="flex bg-white border border-slate-200 rounded-xl p-1">
              <button
                type="button"
                data-no-busy
                onClick={() => setMonitorSubTab("sessions")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                  monitorSubTab === "sessions" ? "bg-[#ff791a] text-white" : "text-slate-600"
                }`}
              >
                Work Sessions
              </button>
              <button
                type="button"
                data-no-busy
                onClick={() => setMonitorSubTab("screenshots")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                  monitorSubTab === "screenshots" ? "bg-[#ff791a] text-white" : "text-slate-600"
                }`}
              >
                Screenshots
              </button>
            </div>

            {monitorSubTab === "sessions" ? (
              <ObserverSection title="Work Sessions Today">
                <ModuleSearch value={moduleSearch} onChange={setModuleSearch} placeholder="Search employees…" />
                {monitorSessionRows.length === 0 ? (
                  <ObserverEmptyState icon={Activity} title="No work sessions yet" />
                ) : (
                  monitorSessionRows.map((row) => (
                    <ObserverListRow
                      key={row.id}
                      title={row.name}
                      subtitle={row.session.employeeCode || "—"}
                      badge={row.hours}
                      badgeTone="blue"
                      onClick={() => openDetail(row.name, buildMonitorSessionDetails(row.session))}
                    />
                  ))
                )}
              </ObserverSection>
            ) : (
              <ObserverSection title="Employee Screenshots">
                <div className="space-y-2 mb-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Date</span>
                      <input
                        type="date"
                        value={monitorScreenshotDate}
                        onChange={(e) => setMonitorScreenshotDate(e.target.value)}
                        className="mt-1 w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Employee</span>
                      <select
                        value={monitorEmployeeFilter}
                        onChange={(e) => setMonitorEmployeeFilter(e.target.value)}
                        className="mt-1 w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-100 cursor-pointer"
                        aria-label="Filter by employee"
                      >
                        <option value="">All employees</option>
                        {monitoredEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name || emp.employeeCode}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <ModuleSearch value={moduleSearch} onChange={setModuleSearch} placeholder="Search app or employee…" />
                </div>

                {monitorScreenshotsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-7 h-7 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
                  </div>
                ) : monitorScreenshotRows.length === 0 ? (
                  <ObserverEmptyState
                    icon={Camera}
                    title="No screenshots"
                    hint={`No captures found for ${monitorScreenshotDate}.`}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {monitorScreenshotRows.map((shot, shotIndex) => (
                      <button
                        key={shot.id}
                        type="button"
                        data-no-busy
                        onClick={() => setScreenshotViewerIndex(shotIndex)}
                        className="border border-slate-200 rounded-xl overflow-hidden text-left bg-white active:scale-[0.98] transition"
                      >
                        {shot.imageUrl ? (
                          <img
                            src={shot.imageUrl}
                            alt=""
                            className="w-full h-28 object-contain bg-slate-900"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-28 bg-slate-100 flex items-center justify-center text-slate-400">
                            <Camera size={22} />
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-[10px] font-bold text-slate-800 truncate">
                            {shot.employeeName || "Employee"}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{shot.appName || "Screenshot"}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatClock(shot.timestamp)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ObserverSection>
            )}
          </>
        )}
        {detail && (
          <ObserverDetailSheet title={detail.title} fields={detail.fields} documents={detail.documents} actions={detail.actions} onClose={closeDetail} />
        )}
        {screenshotViewerIndex !== null && monitorScreenshotRows.length > 0 && (
          <MonitorScreenshotLightbox
            screenshots={monitorScreenshotRows}
            index={Math.min(screenshotViewerIndex, monitorScreenshotRows.length - 1)}
            onClose={() => setScreenshotViewerIndex(null)}
            onIndexChange={setScreenshotViewerIndex}
          />
        )}
      </div>
    );
  }

  return null;
}
