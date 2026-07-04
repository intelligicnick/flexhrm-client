import React from "react";
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
  Bell,
} from "lucide-react";
import { useObserverStats } from "./useObserverStats";
import { ObserverMenuTile, formatInr } from "./ObserverUI";

export default function ObserverMenuPage() {
  const stats = useObserverStats();
  const {
    canView,
    canEdit,
    payrollNet,
    visitStats,
    commitmentStats,
    tenderStats,
    contractCount,
    renewalStats,
    expenseStats,
    partnerPayStats,
    supervisorStats,
    adminNotificationUnreadCount,
  } = stats;

  const editableModules = new Set(
    [
      canEdit("Employees") && "employees",
      canEdit("Salary") && "salary",
      canEdit("Field Team") && "field-team",
      canEdit("Tenders") && "tenders",
      canEdit("Contracts") && "contracts",
      canEdit("Car Papers") && "renewals",
      canEdit("Monthly Billing") && "partner-pay",
    ].filter(Boolean) as string[],
  );

  const modules = [
    {
      icon: Bell,
      label: "Notifications",
      count: adminNotificationUnreadCount > 0 ? adminNotificationUnreadCount : "—",
      to: "/observer/notifications",
      color: "orange" as const,
      alert: adminNotificationUnreadCount > 0,
    },
    canView("Employees") && {
      icon: Users,
      label: "Employees",
      count: "Staff list",
      to: "/observer/employees",
      color: "blue" as const,
    },
    canView("Salary") && {
      icon: IndianRupee,
      label: "Salary",
      count: formatInr(payrollNet),
      to: "/observer/salary",
      color: "orange" as const,
    },
    canView("Field Team") && {
      icon: MapPin,
      label: "Supervisors",
      count: `${supervisorStats.online} online`,
      to: "/observer/supervisors",
      color: "indigo" as const,
    },
    canView("Field Team") && {
      icon: MapPin,
      label: "Supervisors Map",
      count: "Live GPS",
      to: "/observer/map",
      color: "blue" as const,
    },
    canView("Field Team") && {
      icon: ClipboardList,
      label: "Visits",
      count: visitStats.pending > 0 ? `${visitStats.pending} pending` : visitStats.total,
      to: "/observer/visits",
      color: "slate" as const,
      alert: visitStats.pending > 0,
    },
    canView("Field Team") && {
      icon: BookOpen,
      label: "Commitment Diary",
      count: commitmentStats.overdue > 0 ? `${commitmentStats.overdue} overdue` : commitmentStats.active,
      to: "/observer/commitments",
      color: "amber" as const,
      alert: commitmentStats.overdue > 0,
    },
    canView("Tenders") && {
      icon: Gavel,
      label: "Tenders",
      count: tenderStats.total,
      to: "/observer/tenders",
      color: "indigo" as const,
    },
    canView("Contracts") && {
      icon: FileText,
      label: "Contracts",
      count: contractCount,
      to: "/observer/contracts",
      color: "slate" as const,
    },
    canView("Car Papers") && {
      icon: Car,
      label: "Car Papers",
      count: renewalStats.carPapers.alert > 0 ? `${renewalStats.carPapers.alert} alerts` : renewalStats.carPapers.total,
      to: "/observer/car-papers",
      color: "rose" as const,
      alert: renewalStats.carPapers.alert > 0,
    },
    canView("IT Renewals") && {
      icon: Monitor,
      label: "IT Renewals",
      count: renewalStats.itRenewals.alert > 0 ? `${renewalStats.itRenewals.alert} alerts` : renewalStats.itRenewals.total,
      to: "/observer/it-renewals",
      color: "blue" as const,
      alert: renewalStats.itRenewals.alert > 0,
    },
    canView("Licenses") && {
      icon: BadgeCheck,
      label: "Licenses",
      count: renewalStats.licenses.alert > 0 ? `${renewalStats.licenses.alert} alerts` : renewalStats.licenses.total,
      to: "/observer/licenses",
      color: "emerald" as const,
      alert: renewalStats.licenses.alert > 0,
    },
    canView("Expenses") && {
      icon: Receipt,
      label: "Expenses",
      count: formatInr(expenseStats.total),
      to: "/observer/expenses",
      color: "amber" as const,
    },
    canView("Monthly Billing") && {
      icon: HandCoins,
      label: "Partner Pay",
      count: partnerPayStats.unpaid > 0 ? `${partnerPayStats.unpaid} unpaid` : formatInr(partnerPayStats.totalPay),
      to: "/observer/partner-pay",
      color: "orange" as const,
      alert: partnerPayStats.unpaid > 0,
    },
  ].filter(Boolean) as {
    icon: typeof IndianRupee;
    label: string;
    count: string | number;
    to: string;
    color: "orange" | "blue" | "emerald" | "indigo" | "rose" | "amber" | "slate";
    alert?: boolean;
    editable?: boolean;
  }[];

  const moduleEditable = (to: string): boolean => {
    if (to.includes("/employees")) return editableModules.has("employees") || editableModules.has("salary");
    if (to.includes("/salary")) return editableModules.has("salary");
    if (to.includes("/visits") || to.includes("/commitments") || to.includes("/supervisors") || to.includes("/map")) {
      return editableModules.has("field-team");
    }
    if (to.includes("/tenders")) return editableModules.has("tenders");
    if (to.includes("/contracts")) return editableModules.has("contracts");
    if (to.includes("/car-papers") || to.includes("/it-renewals") || to.includes("/licenses")) {
      return editableModules.has("renewals");
    }
    if (to.includes("/partner-pay")) return editableModules.has("partner-pay");
    return false;
  };

  return (
    <div className="space-y-4 pb-2">
      <p className="text-xs text-slate-500 px-1">
        Tap any module to view details
        {editableModules.size > 0 ? " · modules with edit access show actions in detail sheets" : ""}
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {modules.map((m) => (
          <ObserverMenuTile
            key={m.to}
            icon={m.icon}
            label={m.label}
            count={m.count}
            to={m.to}
            color={m.color}
            alert={m.alert}
            editable={moduleEditable(m.to)}
          />
        ))}
      </div>
    </div>
  );
}
