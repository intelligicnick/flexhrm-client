import React, { useMemo } from "react";
import {
  Users,
  IndianRupee,
  Heart,
  Map,
  Clock,
  Coins,
  Calculator,
  School,
  Gavel,
  RotateCw,
  Cake,
  Contact,
  Shield,
  CalendarOff,
  Bell,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  BarChart3,
  FileCheck,
  Building2,
  ClipboardList,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { useHRMS } from "../context/HRMSContext";
import type { FieldTeamView } from "../lib/notification-navigation";
import { getModuleKey } from "../lib/permissions";
import { countMonthAttendance, type AttendanceRecordFilter } from "../lib/attendance-helpers";
import { isEmployeeExitedOnDayStatic, isEmployeeExitedForMonth } from "../lib/employee-helpers";
import { getDaysInMonthStatic } from "../lib/date-helpers";
import { getSalaryColumnValue } from "../lib/salary-columns";
import { expiryBand } from "../lib/renewal-helpers";
import { Tender } from "../types";

function isTenderDeleted(tender: Tender): boolean {
  return Boolean(tender.deletedAt?.trim());
}

type KpiCardProps = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick?: () => void;
  cta?: string;
  highlight?: boolean;
};

function KpiCard({ label, value, sub, icon, iconBg, onClick, cta, highlight }: KpiCardProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`bg-white p-5 rounded-xl border shadow-xs text-left w-full transition group ${
        onClick ? "cursor-pointer hover:border-[#ff791a]/40 hover:shadow-md" : ""
      } ${highlight ? "border-amber-300 ring-1 ring-amber-100" : "border-slate-200"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">{label}</span>
          <span className="text-2xl font-black text-slate-850 mt-1 block truncate">{value}</span>
          {sub && <span className="text-xs text-slate-500 mt-0.5 block">{sub}</span>}
          {onClick && cta && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#ff791a] mt-2 group-hover:gap-1.5 transition-all">
              {cta} <ChevronRight size={12} />
            </span>
          )}
        </div>
        <div className={`p-3 rounded-xl shrink-0 ${iconBg}`}>{icon}</div>
      </div>
    </Tag>
  );
}

type BarRowProps = { label: string; value: number; max: number; color: string; onClick?: () => void };

function BarRow({ label, value, max, color, onClick }: BarRowProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full text-left ${onClick ? "cursor-pointer hover:opacity-90" : ""}`}
    >
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-slate-700 truncate pr-2">{label}</span>
        <span className="font-bold text-slate-500 shrink-0">{value}</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </Tag>
  );
}

function AttendanceRing({
  presentPct,
  presents,
  absents,
  absentEmployeeCount,
  presentOnlyEmployeeCount,
  onOpenAll,
  onOpenPresent,
  onOpenAbsent,
}: {
  presentPct: number;
  presents: number;
  absents: number;
  absentEmployeeCount: number;
  presentOnlyEmployeeCount: number;
  onOpenAll: () => void;
  onOpenPresent: () => void;
  onOpenAbsent: () => void;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (presentPct / 100) * c;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <button
        type="button"
        onClick={onOpenAll}
        className="relative w-36 h-36 shrink-0 cursor-pointer hover:opacity-90 transition rounded-full"
        title="Open full attendance sheet"
      >
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="#ff791a"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black text-slate-800">{presentPct}%</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Present</span>
        </div>
      </button>
      <div className="flex-1 grid grid-cols-2 gap-3 w-full">
        <button
          type="button"
          onClick={onOpenPresent}
          className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center cursor-pointer hover:border-emerald-300 hover:shadow-sm transition"
          title="Show present-only employees"
        >
          <span className="text-[10px] font-bold text-emerald-600 uppercase block">Presents</span>
          <span className="text-xl font-black text-emerald-800">{presents.toLocaleString("en-IN")}</span>
          <span className="text-[9px] font-semibold text-emerald-600/80 block mt-0.5">
            {presentOnlyEmployeeCount} staff · tap to list
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenAbsent}
          className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center cursor-pointer hover:border-rose-300 hover:shadow-sm transition"
          title="Show employees with absent days"
        >
          <span className="text-[10px] font-bold text-rose-600 uppercase block">Absents</span>
          <span className="text-xl font-black text-rose-800">{absents.toLocaleString("en-IN")}</span>
          <span className="text-[9px] font-semibold text-rose-600/80 block mt-0.5">
            {absentEmployeeCount} staff · tap to list
          </span>
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const {
    sessionUser,
    isLoading,
    employees,
    dashboardStats,
    selectedMonth,
    attendanceDb,
    schoolDashboardStats,
    pendingChangeCount,
    pendingSupervisorRequestCount,
    adminNotificationUnreadCount,
    birthdayTodayList,
    rawTenders,
    rawRenewals,
    rawContracts,
    filteredSalaryEmployees,
    esicEligibilityLimit,
    locationCompliance,
    locationPtEnabled,
    navigateToTab,
    setFieldTeamView,
    setTenderDeadlineFilter,
    setAttendanceRecordFilter,
    setAttendanceSubView,
    userPermissions,
    companyBranch,
  } = useHRMS();

  const goToFieldTeam = (view: FieldTeamView) => {
    setFieldTeamView(view);
    navigateToTab("Field Team");
  };

  const openAttendance = (filter: AttendanceRecordFilter = "all") => {
    setAttendanceRecordFilter(filter);
    setAttendanceSubView("grid");
    navigateToTab("Attendance");
  };

  const goToUpcomingTenders = () => {
    setTenderDeadlineFilter("upcoming");
    navigateToTab("Tenders");
  };

  const heroQuickBtn =
    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-md shadow-black/20 transition cursor-pointer";

  const canView = (tab: string) => {
    const key = getModuleKey(tab);
    if (!key) return true;
    return !!userPermissions[key]?.view;
  };

  const attendanceSummary = useMemo(() => {
    const daysInMonth = getDaysInMonthStatic(selectedMonth);
    let presents = 0;
    let absents = 0;
    let absentEmployeeCount = 0;
    let presentOnlyEmployeeCount = 0;
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
      if (counts.absents > 0) absentEmployeeCount += 1;
      if (counts.presents > 0 && counts.absents === 0) presentOnlyEmployeeCount += 1;
    });
    const total = presents + absents;
    const presentPct = total > 0 ? Math.round((presents / total) * 100) : 0;
    return { presents, absents, presentPct, absentEmployeeCount, presentOnlyEmployeeCount };
  }, [employees, attendanceDb, selectedMonth]);

  const locationChart = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((e) => {
      const loc = e.location?.trim() || "Unassigned";
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [employees]);

  const roleChart = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((e) => {
      const role = e.role?.trim() || "Unassigned";
      counts[role] = (counts[role] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [employees]);

  const payrollNet = useMemo(
    () =>
      filteredSalaryEmployees.reduce(
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
    [filteredSalaryEmployees, selectedMonth, esicEligibilityLimit, attendanceDb, locationCompliance, locationPtEnabled],
  );

  const tenderStats = useMemo(() => {
    const active = rawTenders.filter((t) => !isTenderDeleted(t));
    const now = Date.now();
    let upcoming = 0;
    active.forEach((t) => {
      const ts = Date.parse(t.endDate || "");
      if (!Number.isNaN(ts) && ts >= now) upcoming += 1;
    });
    return { total: active.length, upcoming };
  }, [rawTenders]);

  const renewalStats = useMemo(() => {
    let expired = 0;
    let soon = 0;
    rawRenewals.forEach((r) => {
      const band = expiryBand(r);
      if (band === "passed") expired += 1;
      else if (band === "soon") soon += 1;
    });
    return { total: rawRenewals.length, expired, soon };
  }, [rawRenewals]);

  const pendingActions = useMemo(() => {
    const items: { label: string; count: number; tab: string; icon: React.ReactNode; urgent?: boolean }[] = [];
    if (pendingChangeCount > 0 && canView("Employees")) {
      items.push({
        label: "Employee bulk edits awaiting approval",
        count: pendingChangeCount,
        tab: "Employees",
        icon: <FileCheck size={16} />,
        urgent: true,
      });
    }
    if (pendingSupervisorRequestCount > 0 && canView("Field Team")) {
      items.push({
        label: "Field team supervisor requests",
        count: pendingSupervisorRequestCount,
        tab: "Field Team",
        icon: <AlertTriangle size={16} />,
        urgent: true,
      });
    }
    if (adminNotificationUnreadCount > 0) {
      items.push({
        label: "Unread admin notifications",
        count: adminNotificationUnreadCount,
        tab: "Employees",
        icon: <Bell size={16} />,
      });
    }
    if (renewalStats.soon + renewalStats.expired > 0 && canView("Car Papers")) {
      items.push({
        label: "Renewals expiring or expired",
        count: renewalStats.soon + renewalStats.expired,
        tab: "Car Papers",
        icon: <RotateCw size={16} />,
        urgent: renewalStats.expired > 0,
      });
    }
    return items;
  }, [
    pendingChangeCount,
    pendingSupervisorRequestCount,
    adminNotificationUnreadCount,
    renewalStats,
    userPermissions,
  ]);

  const quickLinks = useMemo(
    () =>
      [
        { tab: "Employees", label: "Employees", icon: Users, desc: "Roster & registry" },
        { tab: "Attendance", label: "Attendance", icon: Clock, desc: "Monthly records" },
        { tab: "Salary", label: "Salary", icon: Coins, desc: "Payroll & exports" },
        { tab: "Advance & Penalty", label: "Ledger", icon: Calculator, desc: "Advances & perks" },
        { tab: "Schools", label: "Schools", icon: School, desc: "School registry" },
        { tab: "Tenders", label: "Tenders", icon: Gavel, desc: "Bid pipeline" },
        { tab: "Car Papers", label: "Renewals", icon: RotateCw, desc: "Expiry tracking" },
        { tab: "Birthdays", label: "Birthdays", icon: Cake, desc: "Celebrations" },
        { tab: "Directory", label: "Directory", icon: Contact, desc: "Contacts" },
        { tab: "Role & Access", label: "Admin", icon: Shield, desc: "Roles & access" },
        { tab: "Leave", label: "Leave", icon: CalendarOff, desc: "Leave module" },
        { tab: "Field Team", label: "Field Team", icon: Building2, desc: "Visits & supervisors" },
      ].filter((l) => canView(l.tab)),
    [userPermissions],
  );

  const locMax = locationChart[0]?.[1] ?? 1;
  const roleMax = roleChart[0]?.[1] ?? 1;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in" id="admin-dashboard-view">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,121,26,0.35)_0%,_transparent_55%)]" />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-orange-300 uppercase tracking-widest mb-1">Executive Dashboard</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Welcome back, {sessionUser}
            </h1>
            <p className="text-sm text-slate-300 mt-1">{today} · {companyBranch}</p>
            {(canView("Field Team") || canView("Tenders")) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {canView("Field Team") && (
                  <>
                    <button
                      type="button"
                      onClick={() => goToFieldTeam("visits")}
                      className={`${heroQuickBtn} bg-[#ff791a] hover:bg-[#e4640c] border border-orange-400/50`}
                    >
                      <ClipboardList size={11} />
                      Visits
                    </button>
                    <button
                      type="button"
                      onClick={() => goToFieldTeam("requests")}
                      className={`${heroQuickBtn} bg-amber-500 hover:bg-amber-600 border border-amber-300/50`}
                    >
                      <MessageSquare size={11} />
                      Requests
                      {pendingSupervisorRequestCount > 0 && (
                        <span className="min-w-[14px] h-3.5 px-1 rounded-full bg-white text-amber-700 text-[8px] font-black flex items-center justify-center">
                          {pendingSupervisorRequestCount > 99 ? "99+" : pendingSupervisorRequestCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => goToFieldTeam("commitments")}
                      className={`${heroQuickBtn} bg-violet-500 hover:bg-violet-600 border border-violet-300/50`}
                    >
                      <BookOpen size={11} />
                      Commitment Diary
                    </button>
                  </>
                )}
                {canView("Tenders") && (
                  <button
                    type="button"
                    onClick={goToUpcomingTenders}
                    className={`${heroQuickBtn} bg-emerald-500 hover:bg-emerald-600 border border-emerald-300/50`}
                  >
                    <Gavel size={11} />
                    Upcoming tenders
                    {tenderStats.upcoming > 0 && (
                      <span className="min-w-[14px] h-3.5 px-1 rounded-full bg-white text-emerald-700 text-[8px] font-black flex items-center justify-center">
                        {tenderStats.upcoming > 99 ? "99+" : tenderStats.upcoming}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canView("Employees") && (
              <button
                type="button"
                onClick={() => navigateToTab("Employees")}
                className="px-4 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                View Employees
              </button>
            )}
            {canView("Attendance") && (
              <button
                type="button"
                onClick={() => openAttendance("all")}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Open Attendance
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-kpi-grid">
        {canView("Employees") && (
          <KpiCard
            label="Total Employees"
            value={isLoading ? "..." : String(dashboardStats.totalCount)}
            sub="Active registry records"
            icon={<Users size={20} className="text-[#ff791a]" />}
            iconBg="bg-orange-50"
            onClick={() => navigateToTab("Employees")}
            cta="Open employee list"
          />
        )}
        {canView("Salary") && (
          <KpiCard
            label="Net Payroll"
            value={isLoading ? "..." : `₹${payrollNet.toLocaleString("en-IN")}`}
            sub={`${selectedMonth} · after deductions`}
            icon={<IndianRupee size={20} className="text-green-600" />}
            iconBg="bg-green-50/70"
            onClick={() => navigateToTab("Salary")}
            cta="View salary sheet"
          />
        )}
        {canView("Attendance") && (
          <KpiCard
            label="Attendance Rate"
            value={isLoading ? "..." : `${attendanceSummary.presentPct}%`}
            sub={`${selectedMonth} · ${attendanceSummary.presents} presents`}
            icon={<TrendingUp size={20} className="text-blue-600" />}
            iconBg="bg-blue-50"
            onClick={() => openAttendance("all")}
            cta="Review attendance"
          />
        )}
        {canView("Employees") && (
          <KpiCard
            label="ESIC Covered"
            value={isLoading ? "..." : String(dashboardStats.esicCoveredCount)}
            sub={`of ${dashboardStats.totalCount} employees`}
            icon={<Heart size={20} className="text-purple-600" />}
            iconBg="bg-purple-50"
            onClick={() => navigateToTab("Employees")}
            cta="View roster"
          />
        )}
      </section>

      {/* Secondary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canView("Employees") && (
          <KpiCard
            label="Worksite Locations"
            value={String(dashboardStats.uniqueLocsCount)}
            sub="Distinct mapped sites"
            icon={<Map size={20} className="text-blue-600" />}
            iconBg="bg-blue-50"
            onClick={() => navigateToTab("Employees")}
            cta="Manage locations"
          />
        )}
        {canView("Schools") && (
          <KpiCard
            label="Schools"
            value={String(schoolDashboardStats.totalCount)}
            sub={`${schoolDashboardStats.uniqueDistricts} districts · ${schoolDashboardStats.totalToilets} toilets`}
            icon={<School size={20} className="text-indigo-600" />}
            iconBg="bg-indigo-50"
            onClick={() => navigateToTab("Schools")}
            cta="Open schools"
          />
        )}
        {canView("Tenders") && (
          <KpiCard
            label="Active Tenders"
            value={String(tenderStats.total)}
            sub={`${tenderStats.upcoming} upcoming deadlines`}
            icon={<Gavel size={20} className="text-amber-700" />}
            iconBg="bg-amber-50"
            onClick={() => navigateToTab("Tenders")}
            cta="View bid pipeline"
          />
        )}
        {canView("Car Papers") && (
          <KpiCard
            label="Renewals Alert"
            value={String(renewalStats.soon + renewalStats.expired)}
            sub={`${renewalStats.expired} expired · ${renewalStats.soon} due soon`}
            icon={<RotateCw size={20} className="text-rose-600" />}
            iconBg="bg-rose-50"
            onClick={() => navigateToTab("Car Papers")}
            cta="Review renewals"
            highlight={renewalStats.expired > 0}
          />
        )}
      </section>

      {/* Charts row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {canView("Attendance") && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => openAttendance("all")}
                className="text-sm font-extrabold text-slate-800 flex items-center gap-2 cursor-pointer hover:text-[#ff791a] transition"
              >
                <Clock size={16} className="text-[#ff791a]" />
                Attendance — {selectedMonth}
              </button>
              <button
                type="button"
                onClick={() => openAttendance("all")}
                className="text-[10px] font-bold text-[#ff791a] flex items-center gap-0.5 hover:gap-1 transition-all cursor-pointer"
              >
                Open <ChevronRight size={12} />
              </button>
            </div>
            <AttendanceRing
              presentPct={attendanceSummary.presentPct}
              presents={attendanceSummary.presents}
              absents={attendanceSummary.absents}
              absentEmployeeCount={attendanceSummary.absentEmployeeCount}
              presentOnlyEmployeeCount={attendanceSummary.presentOnlyEmployeeCount}
              onOpenAll={() => openAttendance("all")}
              onOpenPresent={() => openAttendance("present")}
              onOpenAbsent={() => openAttendance("absent")}
            />
          </div>
        )}

        {canView("Employees") && (
          <button
            type="button"
            onClick={() => navigateToTab("Employees")}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left cursor-pointer hover:border-[#ff791a]/40 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-500" />
                Top Locations
              </h3>
              <span className="text-[10px] font-bold text-[#ff791a] flex items-center gap-0.5 group-hover:gap-1 transition-all">
                View all <ChevronRight size={12} />
              </span>
            </div>
            <div className="space-y-3">
              {locationChart.length === 0 ? (
                <p className="text-xs text-slate-400">No location data yet.</p>
              ) : (
                locationChart.map(([loc, count]) => (
                  <BarRow key={loc} label={loc} value={count} max={locMax} color="bg-blue-500" />
                ))
              )}
            </div>
          </button>
        )}

        {canView("Employees") && (
          <button
            type="button"
            onClick={() => navigateToTab("Employees")}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left cursor-pointer hover:border-[#ff791a]/40 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Users size={16} className="text-purple-500" />
                Top Roles
              </h3>
              <span className="text-[10px] font-bold text-[#ff791a] flex items-center gap-0.5 group-hover:gap-1 transition-all">
                View roster <ChevronRight size={12} />
              </span>
            </div>
            <div className="space-y-3">
              {roleChart.length === 0 ? (
                <p className="text-xs text-slate-400">No role data yet.</p>
              ) : (
                roleChart.map(([role, count]) => (
                  <BarRow key={role} label={role} value={count} max={roleMax} color="bg-purple-500" />
                ))
              )}
            </div>
          </button>
        )}
      </section>

      {/* Payroll & school summary */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {canView("Salary") && (
          <button
            type="button"
            onClick={() => navigateToTab("Salary")}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left cursor-pointer hover:border-[#ff791a]/40 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Coins size={16} className="text-[#ff791a]" />
                Payroll Overview — {selectedMonth}
              </h3>
              <span className="text-[10px] font-bold text-[#ff791a] flex items-center gap-0.5 group-hover:gap-1 transition-all">
                Open salary <ChevronRight size={12} />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Gross Payroll</span>
                <span className="text-lg font-black text-slate-800">
                  ₹{dashboardStats.totalGrossPayroll.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Net Payable</span>
                <span className="text-lg font-black text-emerald-800">₹{payrollNet.toLocaleString("en-IN")}</span>
              </div>
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 col-span-2">
                <span className="text-[10px] font-bold text-orange-600 uppercase block">Employees on sheet</span>
                <span className="text-lg font-black text-orange-800">{filteredSalaryEmployees.length}</span>
              </div>
            </div>
          </button>
        )}

        {canView("Schools") && (
          <button
            type="button"
            onClick={() => navigateToTab("Schools")}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left cursor-pointer hover:border-[#ff791a]/40 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <School size={16} className="text-indigo-500" />
                School Work Summary
              </h3>
              <span className="text-[10px] font-bold text-[#ff791a] flex items-center gap-0.5 group-hover:gap-1 transition-all">
                Open schools <ChevronRight size={12} />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                <span className="text-[10px] font-bold text-indigo-600 uppercase block">Schools</span>
                <span className="text-lg font-black text-indigo-800">{schoolDashboardStats.totalCount}</span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Districts</span>
                <span className="text-lg font-black text-slate-800">{schoolDashboardStats.uniqueDistricts}</span>
              </div>
              <div className="rounded-xl bg-teal-50 border border-teal-100 p-3">
                <span className="text-[10px] font-bold text-teal-600 uppercase block">Toilets</span>
                <span className="text-lg font-black text-teal-800">{schoolDashboardStats.totalToilets}</span>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <span className="text-[10px] font-bold text-amber-700 uppercase block">Partner Pay/mo</span>
                <span className="text-lg font-black text-amber-900">
                  ₹{schoolDashboardStats.totalPartnerPay.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </button>
        )}
      </section>

      {/* Action center */}
      {pendingActions.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-500" />
            Action Required
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingActions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => navigateToTab(item.tab)}
                className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-left cursor-pointer transition hover:shadow-md ${
                  item.urgent
                    ? "border-amber-200 bg-amber-50/50 hover:border-amber-300"
                    : "border-slate-200 bg-slate-50/50 hover:border-[#ff791a]/30"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${item.urgent ? "bg-amber-100 text-amber-700" : "bg-white text-slate-600 border border-slate-200"}`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 block truncate">{item.label}</span>
                    <span className="text-[10px] text-slate-500">Tap to review</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-lg font-black ${item.urgent ? "text-amber-700" : "text-[#ff791a]"}`}>
                    {item.count}
                  </span>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Birthdays today */}
      {canView("Birthdays") && birthdayTodayList.length > 0 && (
        <button
          type="button"
          onClick={() => navigateToTab("Birthdays")}
          className="w-full bg-gradient-to-r from-pink-50 to-orange-50 border border-pink-200 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white rounded-xl text-pink-500 shadow-sm">
              <Cake size={20} />
            </div>
            <div className="text-left">
              <span className="text-sm font-extrabold text-slate-800">
                {birthdayTodayList.length} birthday{birthdayTodayList.length !== 1 ? "s" : ""} today
              </span>
              <span className="text-xs text-slate-500 block">
                {birthdayTodayList.slice(0, 3).map((e) => e.nameAsPerAadhar || e.employeeCode).join(", ")}
                {birthdayTodayList.length > 3 ? "…" : ""}
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-[#ff791a] flex items-center gap-1 group-hover:gap-2 transition-all">
            Celebrate <ChevronRight size={14} />
          </span>
        </button>
      )}

      {/* Quick links */}
      <section>
        <h3 className="text-sm font-extrabold text-slate-800 mb-3">Quick Links</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.tab}
                type="button"
                onClick={() => navigateToTab(link.tab)}
                className="bg-white border border-slate-200 rounded-xl p-4 text-left cursor-pointer hover:border-[#ff791a]/40 hover:shadow-md transition group"
              >
                <div className="p-2 rounded-lg bg-orange-50 text-[#ff791a] w-fit mb-2 group-hover:bg-[#ff791a] group-hover:text-white transition">
                  <Icon size={18} />
                </div>
                <span className="text-xs font-extrabold text-slate-800 block">{link.label}</span>
                <span className="text-[10px] text-slate-500">{link.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Footer stats strip */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 border-t border-slate-200 pt-4">
        {canView("Contracts") && (
          <button type="button" onClick={() => navigateToTab("Contracts")} className="hover:text-[#ff791a] cursor-pointer font-semibold">
            {rawContracts.length} contracts →
          </button>
        )}
        {canView("Tenders") && (
          <button type="button" onClick={() => navigateToTab("Tenders")} className="hover:text-[#ff791a] cursor-pointer font-semibold">
            {tenderStats.total} tenders →
          </button>
        )}
        {canView("Car Papers") && (
          <button type="button" onClick={() => navigateToTab("Car Papers")} className="hover:text-[#ff791a] cursor-pointer font-semibold">
            {renewalStats.total} renewal records →
          </button>
        )}
      </div>
    </div>
  );
}
