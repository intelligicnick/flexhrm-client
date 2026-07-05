import React from "react";
import { Link } from "react-router-dom";
import {
  Users,
  IndianRupee,
  Clock,
  MapPin,
  ClipboardList,
  BookOpen,
  Gavel,
  FileText,
  Car,
  Monitor,
  BadgeCheck,
  Receipt,
  HandCoins,
  AlertTriangle,
  Bell,
  Calculator,
  Cake,
} from "lucide-react";
import { useObserverStats } from "./useObserverStats";
import {
  ObserverSection,
  ObserverStatCard,
  ObserverStatGrid,
  formatInr,
  formatMonthLabel,
} from "./ObserverUI";

export default function ObserverHomePage() {
  const stats = useObserverStats();
  const {
    canViewObserverModule,
    selectedMonth,
    isLoading,
    payrollNet,
    attendanceSummary,
    supervisorStats,
    visitStats,
    commitmentStats,
    tenderStats,
    contractCount,
    renewalStats,
    expenseStats,
    partnerPayStats,
    pendingSupervisorRequestCount,
    adminNotificationUnreadCount,
    ledgerStats,
    birthdayTodayCount,
  } = stats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
      </div>
    );
  }

  const monthLabel = formatMonthLabel(selectedMonth);
  const alerts: { label: string; count: number; to: string }[] = [];

  if (visitStats.pending > 0 && canViewObserverModule("visits")) {
    alerts.push({ label: "Visits pending approval", count: visitStats.pending, to: "/observer/visits" });
  }
  if (commitmentStats.overdue > 0 && canViewObserverModule("commitments")) {
    alerts.push({ label: "Overdue commitments", count: commitmentStats.overdue, to: "/observer/commitments" });
  }
  if (renewalStats.all.alert > 0 && canViewObserverModule("car-papers")) {
    alerts.push({ label: "Renewals expiring/expired", count: renewalStats.all.alert, to: "/observer/car-papers" });
  }
  if (pendingSupervisorRequestCount > 0 && canViewObserverModule("visits")) {
    alerts.push({ label: "Supervisor requests", count: pendingSupervisorRequestCount, to: "/observer/visits" });
  }
  if (partnerPayStats.unpaid > 0 && canViewObserverModule("partner-pay")) {
    alerts.push({ label: "Partners unpaid", count: partnerPayStats.unpaid, to: "/observer/partner-pay" });
  }

  return (
    <div className="space-y-4 pb-2">
      <div className="rounded-2xl bg-gradient-to-r from-[#ff791a]/10 to-orange-50 border border-orange-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Overview</p>
        <p className="text-sm font-bold text-slate-800 mt-0.5">{monthLabel}</p>
      </div>

      {alerts.length > 0 && (
        <ObserverSection title="Needs Attention">
          <div className="space-y-2 -my-1">
            {alerts.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100 active:scale-[0.99] transition"
              >
                <AlertTriangle size={18} className="text-red-500 shrink-0" />
                <span className="text-sm font-bold text-red-800 flex-1">{a.label}</span>
                <span className="text-lg font-black text-red-600">{a.count}</span>
              </Link>
            ))}
          </div>
        </ObserverSection>
      )}

      <ObserverSection title="Key Numbers">
        <ObserverStatGrid>
          {canViewObserverModule("employees") && (
            <ObserverStatCard
              icon={Users}
              label="Employees"
              value={attendanceSummary.activeEmployees}
              sub="Active payroll"
              accent="blue"
              to="/observer/employees"
            />
          )}
          {canViewObserverModule("salary") && (
            <ObserverStatCard
              icon={IndianRupee}
              label="Net Payroll"
              value={formatInr(payrollNet)}
              sub={monthLabel}
              accent="orange"
              to="/observer/salary"
            />
          )}
          {canViewObserverModule("attendance") && (
            <ObserverStatCard
              icon={Clock}
              label="Attendance"
              value={`${attendanceSummary.presentPct}%`}
              sub={`${attendanceSummary.presents} present days`}
              accent="emerald"
              to="/observer/attendance"
            />
          )}
          {canViewObserverModule("advance-penalty") && (
            <ObserverStatCard
              icon={Calculator}
              label="Advances"
              value={formatInr(ledgerStats.advanceTotal)}
              sub={monthLabel}
              accent="blue"
              to="/observer/advance-penalty"
            />
          )}
          {canViewObserverModule("birthdays") && birthdayTodayCount > 0 && (
            <ObserverStatCard
              icon={Cake}
              label="Birthdays"
              value={birthdayTodayCount}
              sub="Today"
              accent="amber"
              to="/observer/birthdays"
            />
          )}
          {canViewObserverModule("supervisors") && (
            <ObserverStatCard
              icon={MapPin}
              label="Supervisors"
              value={supervisorStats.total}
              sub={`${supervisorStats.online} online now`}
              accent="blue"
              to="/observer/supervisors"
            />
          )}
          {canViewObserverModule("visits") && (
            <ObserverStatCard
              icon={ClipboardList}
              label="Visits"
              value={visitStats.total}
              sub={`${visitStats.pending} pending`}
              accent="slate"
              to="/observer/visits"
              alert={visitStats.pending > 0}
            />
          )}
          {canViewObserverModule("commitments") && (
            <ObserverStatCard
              icon={BookOpen}
              label="Commitments"
              value={commitmentStats.active}
              sub={`${commitmentStats.overdue} overdue`}
              accent="amber"
              to="/observer/commitments"
              alert={commitmentStats.overdue > 0}
            />
          )}
          {canViewObserverModule("tenders") && (
            <ObserverStatCard
              icon={Gavel}
              label="Tenders"
              value={tenderStats.total}
              sub={`${tenderStats.upcoming} upcoming`}
              accent="indigo"
              to="/observer/tenders"
            />
          )}
          {canViewObserverModule("contracts") && (
            <ObserverStatCard
              icon={FileText}
              label="Contracts"
              value={contractCount}
              accent="slate"
              to="/observer/contracts"
            />
          )}
          {canViewObserverModule("car-papers") && (
            <ObserverStatCard
              icon={Car}
              label="Car Papers"
              value={renewalStats.carPapers.total}
              sub={`${renewalStats.carPapers.alert} alerts`}
              accent="rose"
              to="/observer/car-papers"
              alert={renewalStats.carPapers.alert > 0}
            />
          )}
          {canViewObserverModule("it-renewals") && (
            <ObserverStatCard
              icon={Monitor}
              label="IT Renewals"
              value={renewalStats.itRenewals.total}
              sub={`${renewalStats.itRenewals.alert} alerts`}
              accent="blue"
              to="/observer/it-renewals"
              alert={renewalStats.itRenewals.alert > 0}
            />
          )}
          {canViewObserverModule("licenses") && (
            <ObserverStatCard
              icon={BadgeCheck}
              label="Licenses"
              value={renewalStats.licenses.total}
              sub={`${renewalStats.licenses.alert} alerts`}
              accent="emerald"
              to="/observer/licenses"
              alert={renewalStats.licenses.alert > 0}
            />
          )}
          {canViewObserverModule("expenses") && (
            <ObserverStatCard
              icon={Receipt}
              label="Expenses"
              value={formatInr(expenseStats.total)}
              sub={`${expenseStats.schoolsWithExpenses} schools`}
              accent="amber"
              to="/observer/expenses"
            />
          )}
          {canViewObserverModule("partner-pay") && (
            <ObserverStatCard
              icon={HandCoins}
              label="Partner Pay"
              value={formatInr(partnerPayStats.totalPay)}
              sub={`${partnerPayStats.unpaid} unpaid`}
              accent="orange"
              to="/observer/partner-pay"
              alert={partnerPayStats.unpaid > 0}
            />
          )}
        </ObserverStatGrid>
      </ObserverSection>

      {adminNotificationUnreadCount > 0 && canViewObserverModule("notifications") && (
        <ObserverSection title="Notifications">
          <Link
            to="/observer/notifications"
            className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100 active:scale-[0.99] transition"
          >
            <Bell size={20} className="text-[#ff791a]" />
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">{adminNotificationUnreadCount} unread</p>
              <p className="text-xs text-slate-500">Tap to view all notifications</p>
            </div>
            <span className="text-lg font-black text-[#ff791a]">{adminNotificationUnreadCount}</span>
          </Link>
        </ObserverSection>
      )}
    </div>
  );
}
