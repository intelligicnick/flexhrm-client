export type MonitorPeriod = "daily" | "weekly" | "monthly";

export const PERIOD_LABELS: Record<MonitorPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export function periodRangeLabel(period: MonitorPeriod, date: string, startDate?: string, endDate?: string): string {
  if (period === "daily") return date;
  if (startDate && endDate) return `${startDate} → ${endDate}`;
  return date;
}
