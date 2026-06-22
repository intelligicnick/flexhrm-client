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
} from "lucide-react";
import { useObserverStats } from "./useObserverStats";
import { ObserverMenuTile, formatInr } from "./ObserverUI";

export default function ObserverMenuPage() {
  const stats = useObserverStats();
  const {
    canView,
    payrollNet,
    visitStats,
    commitmentStats,
    tenderStats,
    contractCount,
    renewalStats,
    expenseStats,
    partnerPayStats,
    supervisorStats,
  } = stats;

  const modules = [
    canView("Salary") && {
      icon: IndianRupee,
      label: "Salary",
      count: formatInr(payrollNet),
      to: "/observer/salary",
      color: "orange" as const,
    },
    canView("Field Team") && {
      icon: MapPin,
      label: "Supervisors Map",
      count: `${supervisorStats.online} online`,
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
  }[];

  return (
    <div className="space-y-4 pb-2">
      <p className="text-xs text-slate-500 px-1">Tap any module to view details</p>
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
          />
        ))}
      </div>
    </div>
  );
}
