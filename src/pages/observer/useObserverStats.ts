import { useMemo } from "react";
import { useHRMS } from "../../context/HRMSContext";
import { countMonthAttendance } from "../../lib/attendance-helpers";
import { getDaysInMonthStatic, parseFlexibleDateMs } from "../../lib/date-helpers";
import { isEmployeeExitedForMonth, isEmployeeExitedOnDayStatic } from "../../lib/employee-helpers";
import { canEditModule, canViewModule } from "../../lib/permissions";
import { expiryBand } from "../../lib/renewal-helpers";
import { getSalaryColumnValue } from "../../lib/salary-columns";
import { computePartnerMonthlyPay } from "../../lib/school-work-helpers";
import type { CommitmentDiary, Renewal, SchoolVisit, Tender } from "../../types";

function isTenderDeleted(tender: Tender): boolean {
  return Boolean(tender.deletedAt?.trim());
}

function filterRenewalsByCategory(renewals: Renewal[], category: string): Renewal[] {
  return renewals.filter((r) => r.category === category);
}

export function useObserverStats() {
  const {
    employees,
    selectedMonth,
    attendanceDb,
    salarySheetEmployees,
    esicEligibilityLimit,
    locationCompliance,
    locationPtEnabled,
    rawTenders,
    rawRenewals,
    rawContracts,
    rawSchoolWorks,
    rawSchoolVisits,
    rawSchoolSupervisors,
    rawCommitmentDiary,
    rawSchoolPartners,
    schoolDashboardStats,
    pendingSupervisorRequestCount,
    adminNotificationUnreadCount,
    userPermissions,
    sessionUser,
    isLoading,
  } = useHRMS();

  const canView = (tab: string) => canViewModule(userPermissions, tab);
  const canEdit = (tab: string) => canEditModule(userPermissions, tab);

  const payrollNet = useMemo(
    () =>
      salarySheetEmployees.reduce(
        (sum, e) =>
          sum +
          (Number(
            getSalaryColumnValue(
              e,
              "Net Payable",
              selectedMonth,
              esicEligibilityLimit,
              attendanceDb,
              locationCompliance,
              locationPtEnabled,
            ),
          ) || 0),
        0,
      ),
    [
      salarySheetEmployees,
      selectedMonth,
      esicEligibilityLimit,
      attendanceDb,
      locationCompliance,
      locationPtEnabled,
    ],
  );

  const attendanceSummary = useMemo(() => {
    const daysInMonth = getDaysInMonthStatic(selectedMonth);
    let presents = 0;
    let absents = 0;
    const monthData = attendanceDb[selectedMonth] || {};
    employees.forEach((emp) => {
      if (isEmployeeExitedForMonth(emp, selectedMonth)) return;
      const empData = monthData[emp.id] || {};
      const counts = countMonthAttendance(
        empData,
        daysInMonth,
        (day) => isEmployeeExitedOnDayStatic(emp, selectedMonth, day),
        { workingDaysType: emp.workingDaysType, monthStr: selectedMonth },
      );
      presents += counts.presents;
      absents += counts.absents;
    });
    const total = presents + absents;
    const presentPct = total > 0 ? Math.round((presents / total) * 100) : 0;
    return { presents, absents, presentPct, activeEmployees: salarySheetEmployees.length };
  }, [employees, attendanceDb, selectedMonth, salarySheetEmployees.length]);

  const tenderStats = useMemo(() => {
    const active = rawTenders.filter((t) => !isTenderDeleted(t));
    const now = Date.now();
    let upcoming = 0;
    active.forEach((t) => {
      const ts = parseFlexibleDateMs(t.endDate || "");
      if (ts !== null && ts >= now) upcoming += 1;
    });
    return { total: active.length, upcoming };
  }, [rawTenders]);

  const renewalStats = useMemo(() => {
    const countByCategory = (category: string) => {
      const items = filterRenewalsByCategory(rawRenewals, category);
      let expired = 0;
      let soon = 0;
      items.forEach((r) => {
        const band = expiryBand(r);
        if (band === "passed") expired += 1;
        else if (band === "soon") soon += 1;
      });
      return { total: items.length, expired, soon, alert: expired + soon };
    };
    return {
      carPapers: countByCategory("car_papers"),
      itRenewals: countByCategory("it_renewals"),
      licenses: countByCategory("licenses"),
      all: (() => {
        let expired = 0;
        let soon = 0;
        rawRenewals.forEach((r) => {
          const band = expiryBand(r);
          if (band === "passed") expired += 1;
          else if (band === "soon") soon += 1;
        });
        return { total: rawRenewals.length, expired, soon, alert: expired + soon };
      })(),
    };
  }, [rawRenewals]);

  const visitStats = useMemo(() => {
    const pending = rawSchoolVisits.filter((v) => v.status === "pending").length;
    const approved = rawSchoolVisits.filter((v) => v.status === "approved").length;
    const recent = [...rawSchoolVisits]
      .sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || ""))
      .slice(0, 20);
    return { total: rawSchoolVisits.length, pending, approved, recent };
  }, [rawSchoolVisits]);

  const commitmentStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const active = rawCommitmentDiary.filter((c) => c.status !== "cancelled" && c.status !== "completed");
    const overdue = active.filter((c) => c.toDate < today).length;
    const upcoming = active.filter((c) => c.fromDate >= today).length;
    const sorted = [...rawCommitmentDiary].sort((a, b) => b.fromDate.localeCompare(a.fromDate));
    return { total: rawCommitmentDiary.length, active: active.length, overdue, upcoming, items: sorted };
  }, [rawCommitmentDiary]);

  const expenseStats = useMemo(() => {
    let material = 0;
    let trek = 0;
    let misc = 0;
    let schoolsWithExpenses = 0;
    rawSchoolWorks.forEach((school) => {
      const entry = school.monthlyExpenseLedger?.[selectedMonth];
      if (!entry) return;
      const m = Number(entry.material) || 0;
      const t = Number(entry.trek) || 0;
      const x = Number(entry.miscellaneous) || 0;
      if (m + t + x > 0) schoolsWithExpenses += 1;
      material += m;
      trek += t;
      misc += x;
    });
    return {
      material,
      trek,
      miscellaneous: misc,
      total: material + trek + misc,
      schoolsWithExpenses,
    };
  }, [rawSchoolWorks, selectedMonth]);

  const partnerPayStats = useMemo(() => {
    let unpaid = 0;
    let paid = 0;
    let hold = 0;
    let totalPay = 0;
    rawSchoolPartners.forEach((p) => {
      const pay = Number(p.monthlyPay) || 0;
      totalPay += pay;
      const status = p.monthlyPayLedger?.[selectedMonth]?.paymentStatus || "Unpaid";
      if (status === "Paid") paid += 1;
      else if (status === "Hold") hold += 1;
      else unpaid += 1;
    });
    const schoolTotal = rawSchoolWorks.reduce((sum, s) => sum + computePartnerMonthlyPay(s), 0);
    return {
      partners: rawSchoolPartners.length,
      unpaid,
      paid,
      hold,
      totalPay,
      schoolTotal,
    };
  }, [rawSchoolPartners, rawSchoolWorks, selectedMonth]);

  const supervisorStats = useMemo(() => {
    const online = rawSchoolSupervisors.filter((s) => s.isOnline).length;
    return { total: rawSchoolSupervisors.length, online };
  }, [rawSchoolSupervisors]);

  const contractCount = rawContracts.length;

  const alertCount = useMemo(() => {
    let count = 0;
    if (visitStats.pending > 0) count += 1;
    if (commitmentStats.overdue > 0) count += 1;
    if (renewalStats.all.alert > 0) count += 1;
    if (pendingSupervisorRequestCount > 0) count += 1;
    if (partnerPayStats.unpaid > 0) count += 1;
    return count;
  }, [
    visitStats.pending,
    commitmentStats.overdue,
    renewalStats.all.alert,
    pendingSupervisorRequestCount,
    partnerPayStats.unpaid,
  ]);

  return {
    canView,
    canEdit,
    userPermissions,
    sessionUser,
    selectedMonth,
    isLoading,
    payrollNet,
    attendanceSummary,
    tenderStats,
    renewalStats,
    visitStats,
    commitmentStats,
    expenseStats,
    partnerPayStats,
    supervisorStats,
    schoolDashboardStats,
    contractCount,
    pendingSupervisorRequestCount,
    adminNotificationUnreadCount,
    alertCount,
    rawSchoolVisits,
    rawSchoolSupervisors,
    rawRenewals,
    rawTenders,
    rawContracts,
    rawSchoolWorks,
    rawSchoolPartners,
    rawCommitmentDiary,
    salarySheetEmployees,
  };
}

export type ObserverCommitment = CommitmentDiary;
export type ObserverVisit = SchoolVisit;
