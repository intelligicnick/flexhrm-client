export type DashboardWidgetId =
  | "kpi-total-employees"
  | "kpi-net-payroll"
  | "kpi-attendance-rate"
  | "kpi-esic-covered"
  | "kpi-worksite-locations"
  | "kpi-schools"
  | "kpi-active-tenders"
  | "kpi-renewals-alert"
  | "kpi-eligible-exit"
  | "kpi-exited-employees"
  | "charts"
  | "map"
  | "payroll"
  | "actions"
  | "birthdays"
  | "quicklinks";

/** @deprecated Use DashboardWidgetId */
export type DashboardSectionId = DashboardWidgetId;

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  "kpi-total-employees": "Total Employees",
  "kpi-net-payroll": "Net Payroll",
  "kpi-attendance-rate": "Attendance Rate",
  "kpi-esic-covered": "ESIC Covered",
  "kpi-worksite-locations": "Worksite Locations",
  "kpi-schools": "Schools",
  "kpi-active-tenders": "Active Tenders",
  "kpi-renewals-alert": "Renewals Alert",
  "kpi-eligible-exit": "Eligible for Exit",
  "kpi-exited-employees": "Exited Employees",
  charts: "Charts",
  map: "Supervisor Map",
  payroll: "Payroll & Schools",
  actions: "Action Required",
  birthdays: "Birthdays",
  quicklinks: "Quick Links",
};

export const DASHBOARD_SECTION_LABELS = DASHBOARD_WIDGET_LABELS;

export const FULL_WIDTH_DASHBOARD_WIDGETS = new Set<DashboardWidgetId>([
  "charts",
  "map",
  "payroll",
  "actions",
  "birthdays",
  "quicklinks",
]);

export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = [
  "kpi-total-employees",
  "kpi-net-payroll",
  "kpi-attendance-rate",
  "kpi-esic-covered",
  "kpi-worksite-locations",
  "kpi-schools",
  "kpi-active-tenders",
  "kpi-renewals-alert",
  "kpi-eligible-exit",
  "kpi-exited-employees",
  "charts",
  "map",
  "payroll",
  "actions",
  "birthdays",
  "quicklinks",
];

export const DEFAULT_DASHBOARD_SECTION_ORDER = DEFAULT_DASHBOARD_WIDGET_ORDER;

const STORAGE_KEY = "hrms_dashboard_widget_order";
const LEGACY_STORAGE_KEY = "hrms_dashboard_section_order";

const ALL_WIDGET_IDS = new Set<DashboardWidgetId>(DEFAULT_DASHBOARD_WIDGET_ORDER);

const LEGACY_SECTION_IDS = new Set([
  "charts",
  "map",
  "payroll",
  "actions",
  "birthdays",
  "quicklinks",
]);

function mergeWithDefaults(order: DashboardWidgetId[]): DashboardWidgetId[] {
  const valid = order.filter((id) => ALL_WIDGET_IDS.has(id));
  const missing = DEFAULT_DASHBOARD_WIDGET_ORDER.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

function migrateLegacySectionOrder(legacy: string[]): DashboardWidgetId[] {
  const kpis = DEFAULT_DASHBOARD_WIDGET_ORDER.filter((id) => id.startsWith("kpi-"));
  const sections = legacy.filter((id): id is DashboardWidgetId =>
    LEGACY_SECTION_IDS.has(id as DashboardWidgetId),
  );
  return mergeWithDefaults([...kpis, ...sections]);
}

export function loadDashboardWidgetOrder(): DashboardWidgetId[] {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULT_DASHBOARD_WIDGET_ORDER;

    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return DEFAULT_DASHBOARD_WIDGET_ORDER;

    const widgetIds = parsed.filter((id): id is DashboardWidgetId => ALL_WIDGET_IDS.has(id as DashboardWidgetId));
    if (widgetIds.length > 0) return mergeWithDefaults(widgetIds);

    return migrateLegacySectionOrder(parsed);
  } catch {
    return DEFAULT_DASHBOARD_WIDGET_ORDER;
  }
}

export function loadDashboardSectionOrder(): DashboardWidgetId[] {
  return loadDashboardWidgetOrder();
}

export function saveDashboardWidgetOrder(order: DashboardWidgetId[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

export function saveDashboardSectionOrder(order: DashboardWidgetId[]): void {
  saveDashboardWidgetOrder(order);
}

export function reorderDashboardWidgets(
  order: DashboardWidgetId[],
  draggedId: DashboardWidgetId,
  targetId: DashboardWidgetId,
): DashboardWidgetId[] {
  if (draggedId === targetId) return order;

  const next = order.filter((id) => id !== draggedId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex === -1) return order;

  next.splice(targetIndex, 0, draggedId);
  return next;
}

export function reorderDashboardSections(
  order: DashboardWidgetId[],
  draggedId: DashboardWidgetId,
  targetId: DashboardWidgetId,
): DashboardWidgetId[] {
  return reorderDashboardWidgets(order, draggedId, targetId);
}
