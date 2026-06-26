import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  AppWindow,
  Camera,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  HardDrive,
  Key,
  LayoutDashboard,
  Monitor,
  RefreshCw,
  Settings,
  Timer,
  TrendingUp,
  Trash2,
  Usb,
  Video,
  Wifi,
  WifiOff,
} from "lucide-react";
import MonitorSettingsPanel from "./monitor/MonitorSettingsPanel";
import MonitorFilterBar from "./monitor/MonitorFilterBar";
import MonitorSubNav from "./monitor/MonitorSubNav";
import MonitorEmployeeDetail from "./monitor/MonitorEmployeeDetail";
import MonitorEmployeeAgentsPanel from "./monitor/MonitorEmployeeAgentsPanel";
import MonitorLiveViewModal from "./monitor/MonitorLiveViewModal";
import MonitorScreenshotLightbox from "./monitor/MonitorScreenshotLightbox";
import {
  monitorApi,
  MonitorDevice,
  MonitorOverview,
  LiveEmployee,
  MonitorSettings,
  MonitoredEmployee,
  KeyboardAnalytics,
  ApplicationAnalytics,
  todayKey,
} from "../lib/monitor-api";
import { formatActivityRange, formatClock, formatDurationLabel, formatTimeRange } from "../lib/monitor-time";
import type { MonitorPeriod } from "../lib/monitor-period";
import { periodRangeLabel, PERIOD_LABELS } from "../lib/monitor-period";

interface MonitorPanelProps {
  readOnly?: boolean;
}

type MonitorTab =
  | "overview"
  | "live"
  | "timeline"
  | "screenshots"
  | "websites"
  | "applications"
  | "keyboard"
  | "meetings"
  | "files"
  | "peripherals"
  | "working-hours"
  | "productivity"
  | "alerts"
  | "agents"
  | "devices"
  | "settings";

type NavItem = { id: MonitorTab; label: string; icon: React.ComponentType<{ size?: number }> };
type NavSection = { id: string; label: string; icon: React.ComponentType<{ size?: number }>; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }],
  },
  {
    id: "realtime",
    label: "Real-time",
    icon: Activity,
    items: [
      { id: "live", label: "Live Monitor", icon: Activity },
      { id: "timeline", label: "Timeline", icon: Clock },
    ],
  },
  {
    id: "activity",
    label: "Activity",
    icon: AppWindow,
    items: [
      { id: "screenshots", label: "Screenshots", icon: Camera },
      { id: "websites", label: "Websites", icon: Globe },
      { id: "applications", label: "Applications", icon: AppWindow },
      { id: "keyboard", label: "Keystrokes", icon: Key },
      { id: "files", label: "File Activity", icon: FileText },
      { id: "peripherals", label: "USB & Print", icon: Usb },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: TrendingUp,
    items: [
      { id: "productivity", label: "Productivity", icon: TrendingUp },
      { id: "working-hours", label: "Working Hours", icon: Timer },
      { id: "meetings", label: "Meetings", icon: Video },
    ],
  },
  {
    id: "alerts",
    label: "Alerts",
    icon: AlertTriangle,
    items: [{ id: "alerts", label: "Alerts", icon: AlertTriangle }],
  },
  {
    id: "setup",
    label: "Setup",
    icon: Settings,
    items: [
      { id: "agents", label: "Employee Agents", icon: Key },
      { id: "devices", label: "Devices", icon: HardDrive },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

function sectionForTab(tab: MonitorTab): string {
  return NAV_SECTIONS.find((s) => s.items.some((i) => i.id === tab))?.id ?? "dashboard";
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${accent ?? "text-slate-800"}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function MonitorPanel({ readOnly = false }: MonitorPanelProps) {
  const [activeTab, setActiveTab] = useState<MonitorTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState(todayKey());
  const [period, setPeriod] = useState<MonitorPeriod>("daily");
  const [monitoredEmployees, setMonitoredEmployees] = useState<MonitoredEmployee[]>([]);
  const [overview, setOverview] = useState<MonitorOverview | null>(null);
  const [live, setLive] = useState<LiveEmployee[]>([]);
  const [settings, setSettings] = useState<MonitorSettings | null>(null);
  const [devices, setDevices] = useState<MonitorDevice[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [timeline, setTimeline] = useState<Array<{ time: string; endTime?: string; type: string; label: string; sublabel?: string; durationSeconds?: number; category?: string }>>([]);
  const [screenshots, setScreenshots] = useState<Array<{ id: string; imageUrl: string; timestamp: string; appName: string; employeeId: string }>>([]);
  const [websiteData, setWebsiteData] = useState<{
    topWebsites: Array<{ domain: string; seconds: number; visits: number; category: string }>;
    productivityBreakdown: Array<{ category: string; seconds: number }>;
    byEmployee?: Array<{ employeeId: string; employeeName: string; seconds: number; visits: number }>;
    recentVisits?: Array<{
      id: string;
      employeeId: string;
      employeeName: string;
      domain: string;
      url: string;
      pageTitle: string;
      browserName: string;
      visitTime: string;
      durationSeconds: number;
      category: string;
    }>;
  } | null>(null);
  const [appData, setAppData] = useState<ApplicationAnalytics | null>(null);
  const [keyboardData, setKeyboardData] = useState<KeyboardAnalytics | null>(null);
  const [productivity, setProductivity] = useState<{
    avgProductivity: number;
    startDate: string;
    endDate: string;
    period: MonitorPeriod;
    leaderboard: Array<{ employeeId: string; employeeName: string; score: number; activePercent: number; idlePercent: number; keyCount: number; rank: number }>;
  } | null>(null);
  const [alerts, setAlerts] = useState<Array<{ id: string; employeeName: string; severity: string; event: string; details: string; timestamp: string; status: string }>>([]);
  const [screenshotViewerIndex, setScreenshotViewerIndex] = useState<number | null>(null);
  const [employeeDetail, setEmployeeDetail] = useState<Record<string, unknown> | null>(null);
  const [meetingData, setMeetingData] = useState<Awaited<ReturnType<typeof monitorApi.getMeetingAnalytics>> | null>(null);
  const [fileData, setFileData] = useState<Awaited<ReturnType<typeof monitorApi.getFileAnalytics>> | null>(null);
  const [peripheralData, setPeripheralData] = useState<Awaited<ReturnType<typeof monitorApi.getPeripheralAnalytics>> | null>(null);
  const [workingHoursData, setWorkingHoursData] = useState<Awaited<ReturnType<typeof monitorApi.getWorkingHoursAnalytics>> | null>(null);
  const [liveView, setLiveView] = useState<{ deviceAgentId: string; employeeName: string; sessionId: string } | null>(null);
  const [actionBusy, setActionBusy] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(["dashboard", "realtime", "activity"]));
  const [selectedScreenshotIds, setSelectedScreenshotIds] = useState<Set<string>>(new Set());
  const [deletingScreenshots, setDeletingScreenshots] = useState(false);

  const employeeFilter = selectedEmployee || undefined;

  const employees = useMemo(
    () => monitoredEmployees.map((e) => ({ id: e.id, name: e.name, code: e.employeeCode })),
    [monitoredEmployees],
  );

  const analyticsOpts = useMemo(
    () => ({ employeeId: employeeFilter, period }),
    [employeeFilter, period],
  );

  const loadEmployees = useCallback(async () => {
    try {
      setMonitoredEmployees(await monitorApi.getEmployees(employeeFilter));
    } catch { /* ignore */ }
  }, [employeeFilter]);

  const loadTabData = useCallback(async (tab: MonitorTab) => {
    setError("");
    try {
      if (tab === "overview") setOverview(await monitorApi.getOverview(employeeFilter));
      if (tab === "live") setLive(await monitorApi.getLive(employeeFilter));
      if (tab === "timeline" && selectedEmployee) {
        const res = await monitorApi.getTimeline(selectedEmployee, date, period);
        setTimeline(res.events);
      }
      if (tab === "screenshots") {
        setScreenshots(await monitorApi.getScreenshots({ ...analyticsOpts, date }));
      }
      if (tab === "websites") {
        setWebsiteData(await monitorApi.getWebsiteAnalytics(date, analyticsOpts));
      }
      if (tab === "applications") {
        setAppData(await monitorApi.getApplicationAnalytics(date, analyticsOpts));
      }
      if (tab === "keyboard") {
        setKeyboardData(await monitorApi.getKeyboardAnalytics(date, analyticsOpts));
      }
      if (tab === "productivity") {
        setProductivity(await monitorApi.getProductivity(date, analyticsOpts));
      }
      if (tab === "meetings") setMeetingData(await monitorApi.getMeetingAnalytics(date, analyticsOpts));
      if (tab === "files") setFileData(await monitorApi.getFileAnalytics(date, analyticsOpts));
      if (tab === "peripherals") setPeripheralData(await monitorApi.getPeripheralAnalytics(date, analyticsOpts));
      if (tab === "working-hours") setWorkingHoursData(await monitorApi.getWorkingHoursAnalytics(date, analyticsOpts));
      if (tab === "alerts") setAlerts(await monitorApi.getAlerts({ employeeId: employeeFilter }));
      if (tab === "devices") setDevices(await monitorApi.getDevices(employeeFilter));
      if (tab === "settings") setSettings(await monitorApi.getSettings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load monitor data");
    }
  }, [date, period, employeeFilter, selectedEmployee, analyticsOpts]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadEmployees();
    await loadTabData(activeTab);
    if (activeTab !== "live") {
      try { setLive(await monitorApi.getLive(employeeFilter)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, [activeTab, loadTabData, employeeFilter, loadEmployees]);

  useEffect(() => {
    refresh();
  }, [activeTab, date, period, selectedEmployee]);

  useEffect(() => {
    if (activeTab !== "screenshots") setSelectedScreenshotIds(new Set());
  }, [activeTab, date, period, selectedEmployee]);

  useEffect(() => {
    if (activeTab !== "screenshots") setScreenshotViewerIndex(null);
  }, [activeTab]);

  useEffect(() => {
    if (screenshotViewerIndex === null) return;
    if (screenshots.length === 0) {
      setScreenshotViewerIndex(null);
    } else if (screenshotViewerIndex >= screenshots.length) {
      setScreenshotViewerIndex(screenshots.length - 1);
    }
  }, [screenshots, screenshotViewerIndex]);

  useEffect(() => {
    if (activeTab !== "live") return;
    const interval = setInterval(() => { loadTabData("live"); }, 15000);
    return () => clearInterval(interval);
  }, [activeTab, loadTabData]);

  const handleResolveAlert = async (id: string, status: "resolved" | "ignored") => {
    if (readOnly) return;
    await monitorApi.resolveAlert(id, status);
    setAlerts(await monitorApi.getAlerts({ employeeId: employeeFilter }));
  };

  const handleRevokeDevice = async (deviceAgentId: string) => {
    if (readOnly) return;
    if (!confirm("Revoke this device?")) return;
    await monitorApi.revokeDevice(deviceAgentId);
    setDevices(await monitorApi.getDevices(employeeFilter));
    setLive(await monitorApi.getLive(employeeFilter));
  };

  const handleSaveSettings = async (patch: Record<string, unknown>) => {
    if (readOnly) return;
    setSettings(await monitorApi.updateSettings(patch));
  };

  const openEmployeeDetail = async (employeeId: string) => {
    setEmployeeDetail(await monitorApi.getEmployeeProfile(employeeId));
  };

  const handleCaptureScreenshot = async (deviceAgentId: string) => {
    if (readOnly) return;
    setActionBusy(`capture-${deviceAgentId}`);
    try {
      await monitorApi.captureScreenshot(deviceAgentId);
      alert("Screenshot requested. It will appear under Screenshots once the agent uploads it.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to request screenshot");
    } finally {
      setActionBusy("");
    }
  };

  const toggleScreenshotSelection = (id: string) => {
    setSelectedScreenshotIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteScreenshots = async (ids: string[]) => {
    if (readOnly || ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} screenshot${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeletingScreenshots(true);
    try {
      await monitorApi.deleteScreenshots(ids);
      setSelectedScreenshotIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setScreenshots(await monitorApi.getScreenshots({ ...analyticsOpts, date }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete screenshots");
    } finally {
      setDeletingScreenshots(false);
    }
  };

  const handleStartLiveView = async (deviceAgentId: string, employeeName: string) => {
    if (readOnly) return;
    setActionBusy(`live-${deviceAgentId}`);
    try {
      const res = await monitorApi.startLiveView(deviceAgentId);
      setLiveView({ deviceAgentId, employeeName, sessionId: res.sessionId });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to start live view");
    } finally {
      setActionBusy("");
    }
  };

  const showFilters = !["agents", "settings", "devices"].includes(activeTab);
  const showDateFilters = !["agents", "settings", "devices", "live", "overview", "alerts"].includes(activeTab);
  const activeLabel = ALL_NAV_ITEMS.find((i) => i.id === activeTab)?.label ?? "Monitor";
  const activeSection = NAV_SECTIONS.find((s) => s.id === sectionForTab(activeTab));
  const rangeStart = appData?.startDate ?? keyboardData?.startDate ?? productivity?.startDate ?? meetingData?.startDate ?? fileData?.startDate ?? peripheralData?.startDate ?? workingHoursData?.startDate;
  const rangeEnd = appData?.endDate ?? keyboardData?.endDate ?? productivity?.endDate ?? meetingData?.endDate ?? fileData?.endDate ?? peripheralData?.endDate ?? workingHoursData?.endDate;
  const rangeLabel = periodRangeLabel(period, date, rangeStart, rangeEnd);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const navigateToTab = (tab: MonitorTab) => {
    setActiveTab(tab);
    setExpandedSections((prev) => new Set(prev).add(sectionForTab(tab)));
  };

  return (
    <div className="space-y-4" id="monitor-panel">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Monitor size={20} className="text-[#ff791a]" />
            Employee Monitor
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign desktop agents per employee and view workforce activity.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row border border-slate-200 rounded-xl overflow-hidden bg-white min-h-[640px]">
        <aside className="lg:w-52 shrink-0 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 p-2 space-y-1">
          {NAV_SECTIONS.map((section) => {
            const SectionIcon = section.icon;
            const isSingle = section.items.length === 1;
            const isExpanded = expandedSections.has(section.id) || sectionForTab(activeTab) === section.id;
            const sectionActive = section.items.some((i) => i.id === activeTab);

            return (
              <div key={section.id}>
                <button
                  type="button"
                  data-no-busy
                  onClick={() => {
                    if (isSingle) navigateToTab(section.items[0].id);
                    else {
                      toggleSection(section.id);
                      if (!sectionActive) navigateToTab(section.items[0].id);
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                    sectionActive && isSingle ? "bg-[#ff791a] text-white" : sectionActive ? "text-[#ff791a]" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <SectionIcon size={14} className="shrink-0" />
                  <span className="flex-1 text-left">{section.label}</span>
                  {!isSingle && (
                    isExpanded ? <ChevronDown size={12} className="shrink-0 opacity-60" /> : <ChevronRight size={12} className="shrink-0 opacity-60" />
                  )}
                </button>

                {!isSingle && isExpanded && (
                  <div className="ml-2 mt-0.5 mb-1 space-y-0.5 border-l-2 border-slate-200 pl-2">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-no-busy
                          onClick={() => navigateToTab(item.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                            active ? "bg-[#ff791a] text-white" : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <Icon size={12} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-slate-100 bg-white space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800">{activeLabel}</h3>
              <button
                type="button"
                data-no-busy
                onClick={refresh}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shrink-0"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
            {showFilters && (
              <MonitorFilterBar
                employees={monitoredEmployees}
                selectedEmployee={selectedEmployee}
                onEmployeeChange={setSelectedEmployee}
                period={period}
                onPeriodChange={setPeriod}
                date={date}
                onDateChange={setDate}
                showEmployee
                showPeriod={showDateFilters}
                showDate={showDateFilters}
                employeeRequired={activeTab === "timeline"}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
              />
            )}
          </div>

          {activeSection && activeSection.items.length > 1 && (
            <MonitorSubNav
              items={activeSection.items}
              activeId={activeTab}
              onChange={(id) => navigateToTab(id as MonitorTab)}
            />
          )}

          <div className="flex-1 p-4 overflow-auto">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}

            {activeTab === "overview" && overview && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Online" value={overview.employeesOnline} sub={`${overview.totalMonitored} devices`} accent="text-emerald-600" />
                  <StatCard label="Offline" value={overview.employeesOffline} accent="text-slate-500" />
                  <StatCard label="Active" value={overview.activeEmployees} accent="text-blue-600" />
                  <StatCard label="Idle" value={overview.idleEmployees} accent="text-amber-600" />
                  <StatCard label="Productivity" value={`${overview.productivityScore}%`} accent="text-[#ff791a]" />
                  <StatCard label="Work Hours" value={overview.todayWorkHours} sub="today" />
                  <StatCard label="Screenshots" value={overview.screenshotCount} sub="today" />
                  <StatCard label="Open Alerts" value={overview.openAlerts} accent="text-red-600" />
                </div>
                {monitoredEmployees.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
                    No employee agents connected yet. Go to <button type="button" data-no-busy onClick={() => navigateToTab("agents")} className="font-bold underline">Employee Agents</button> to search an employee and generate credentials for the desktop agent.
                  </div>
                )}

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                    <h4 className="text-xs font-bold text-slate-700">Today&apos;s Work Sessions</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Login to logout time per employee</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-white text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold">Employee</th>
                          <th className="text-left px-4 py-2 font-semibold">Session</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(overview.workSessions ?? [])
                          .filter((row) => !selectedEmployee || row.employeeId === selectedEmployee)
                          .map((row) => (
                          <tr key={row.employeeId} className="border-t border-slate-100 hover:bg-slate-50/50">
                            <td className="px-4 py-2.5">
                              <div className="font-semibold text-slate-800">{row.employeeName || row.employeeCode || "—"}</div>
                              {row.employeeCode && row.employeeName && (
                                <div className="text-slate-400">{row.employeeCode}</div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700">
                              {row.loginTime ? (
                                formatTimeRange(row.loginTime, row.logoutTime, row.totalHoursWorkedSeconds)
                              ) : (
                                <span className="text-slate-400">No session yet</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {(overview.workSessions ?? []).filter((row) => !selectedEmployee || row.employeeId === selectedEmployee).length === 0 && (
                          <tr>
                            <td colSpan={2} className="px-4 py-8 text-center text-slate-400">
                              No work session data for today yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "live" && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 text-[10px] text-slate-400">Auto-refresh every 15s · {live.length} devices</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold">Employee</th>
                        <th className="text-left px-4 py-2 font-semibold">Status</th>
                        <th className="text-left px-4 py-2 font-semibold">Application</th>
                        <th className="text-left px-4 py-2 font-semibold">Website</th>
                        <th className="text-left px-4 py-2 font-semibold">Active today</th>
                        <th className="text-left px-4 py-2 font-semibold">Idle today</th>
                        <th className="text-left px-4 py-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {live
                        .filter((row) => !selectedEmployee || row.employeeId === selectedEmployee)
                        .map((row) => (
                        <tr key={row.deviceAgentId} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-800">{row.employeeName || row.employeeCode || 'Unassigned'}</div>
                            <div className="text-slate-400">{row.deviceName}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.isOnline
                                ? row.activityState === "idle" || row.activityState === "long_idle"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}>
                              {row.isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                              {row.isOnline ? row.activityState : "offline"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">{row.currentApp || "—"}</td>
                          <td className="px-4 py-2.5 text-slate-500 truncate max-w-[160px]">{row.currentWebsite || "—"}</td>
                          <td className="px-4 py-2.5">{formatDurationLabel(row.activeSeconds)}</td>
                          <td className="px-4 py-2.5">{formatDurationLabel(row.idleSeconds)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <button type="button" onClick={() => openEmployeeDetail(row.employeeId)} className="text-[#ff791a] font-semibold hover:underline">Details</button>
                              {!readOnly && row.isOnline && (
                                <>
                                  <button
                                    type="button"
                                    disabled={!!actionBusy}
                                    onClick={() => handleCaptureScreenshot(row.deviceAgentId)}
                                    className="text-slate-600 font-semibold hover:text-[#ff791a] disabled:opacity-50"
                                  >
                                    {actionBusy === `capture-${row.deviceAgentId}` ? "…" : "Capture"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!!actionBusy}
                                    onClick={() => handleStartLiveView(row.deviceAgentId, row.employeeName || row.employeeCode || "Employee")}
                                    className="text-slate-600 font-semibold hover:text-[#ff791a] disabled:opacity-50"
                                  >
                                    {actionBusy === `live-${row.deviceAgentId}` ? "…" : "Live view"}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {live.filter((row) => !selectedEmployee || row.employeeId === selectedEmployee).length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No agents connected. Generate employee credentials and register the desktop agent.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-4">
                {selectedEmployee ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <h4 className="text-sm font-bold text-slate-800">Activity timeline</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{rangeLabel}</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {timeline.map((ev, i) => (
                        <div key={`${ev.time}-${i}`} className="flex items-start gap-3 px-4 py-3 text-xs">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            ev.type === "login" ? "bg-emerald-500" : ev.type === "idle" ? "bg-amber-400" : "bg-blue-500"
                          }`} />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800">
                              {ev.type === "login"
                                ? `Login · ${formatClock(ev.time)}`
                                : formatActivityRange(ev.label, ev.time, ev.endTime, ev.durationSeconds)}
                            </p>
                            {ev.sublabel ? <p className="text-slate-400 truncate mt-0.5">{ev.sublabel}</p> : null}
                          </div>
                        </div>
                      ))}
                      {timeline.length === 0 && (
                        <p className="px-4 py-8 text-center text-slate-400 text-xs">No activity recorded for this period.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Select an employee to view their activity timeline.</p>
                )}
              </div>
            )}

            {activeTab === "screenshots" && (
              <div className="space-y-3">
                {!readOnly && screenshots.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedScreenshotIds.size === screenshots.length) setSelectedScreenshotIds(new Set());
                        else setSelectedScreenshotIds(new Set(screenshots.map((s) => s.id)));
                      }}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                      {selectedScreenshotIds.size === screenshots.length ? "Deselect all" : "Select all"}
                    </button>
                    {selectedScreenshotIds.size > 0 && (
                      <button
                        type="button"
                        disabled={deletingScreenshots}
                        onClick={() => handleDeleteScreenshots([...selectedScreenshotIds])}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        {deletingScreenshots ? "Deleting…" : `Delete ${selectedScreenshotIds.size} selected`}
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {screenshots.map((shot, shotIndex) => {
                    const selected = selectedScreenshotIds.has(shot.id);
                    return (
                      <div
                        key={shot.id}
                        className={`relative border rounded-xl overflow-hidden text-left transition-shadow group ${
                          selected ? "border-[#ff791a] ring-2 ring-[#ff791a]/30" : "border-slate-200 hover:shadow-md"
                        }`}
                      >
                        {!readOnly && (
                          <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleScreenshotSelection(shot.id)}
                              className="rounded border-slate-300"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleDeleteScreenshots([shot.id])}
                            disabled={deletingScreenshots}
                            className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                            title="Delete screenshot"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setScreenshotViewerIndex(shotIndex)}
                          className="w-full text-left"
                        >
                          {shot.imageUrl ? (
                            <img src={shot.imageUrl} alt="" className="w-full h-28 object-contain bg-slate-900" />
                          ) : (
                            <div className="w-full h-28 bg-slate-100 flex items-center justify-center text-slate-400"><Camera size={24} /></div>
                          )}
                          <div className="p-2">
                            <p className="text-[10px] font-semibold text-slate-700 truncate">{shot.appName || "Screenshot"}</p>
                            <p className="text-[10px] text-slate-400">{formatClock(shot.timestamp)}</p>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                  {screenshots.length === 0 && (
                    <div className="col-span-full border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-400">No screenshots for {rangeLabel}.</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "websites" && websiteData && (
              <div className="space-y-4">
                {websiteData.topWebsites.length > 0 && (
                  <div className="border border-slate-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-700 mb-2">Top websites — {rangeLabel}</h4>
                    <div className="space-y-1.5">
                      {websiteData.topWebsites.slice(0, 10).map((w) => (
                        <div key={w.domain} className="flex justify-between text-xs gap-2">
                          <span className="font-semibold text-slate-700 truncate">{w.domain}</span>
                          <span className="text-slate-500 shrink-0">{formatDurationLabel(w.seconds)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <h4 className="text-sm font-bold text-slate-800">Visit history</h4>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-white text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-2">Time</th>
                        <th className="text-left px-4 py-2">Employee</th>
                        <th className="text-left px-4 py-2">Page</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(websiteData.recentVisits ?? []).map((visit) => (
                        <tr key={visit.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                            {formatTimeRange(visit.visitTime, undefined, visit.durationSeconds)}
                          </td>
                          <td className="px-4 py-2 font-semibold text-slate-700">{visit.employeeName || "—"}</td>
                          <td className="px-4 py-2 text-slate-700 max-w-[280px] truncate" title={visit.pageTitle || visit.url}>
                            <span className="font-medium">{visit.domain || "—"}</span>
                            {(visit.pageTitle || visit.url) && (
                              <span className="text-slate-400 block truncate">{visit.pageTitle || visit.url}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(websiteData.recentVisits ?? []).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                            No website visits for {rangeLabel}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "applications" && appData && (
              <div className="space-y-4">
                {appData.topApplications.length > 0 && (
                  <div className="border border-slate-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-700 mb-2">Top apps — {rangeLabel}</h4>
                    <div className="space-y-1.5">
                      {appData.topApplications.slice(0, 10).map((a) => (
                        <div key={a.displayName ?? a.appName} className="flex justify-between items-center text-xs gap-2">
                          <span className="font-semibold text-slate-700 truncate">{a.displayName ?? a.appName}</span>
                          <span className="text-slate-500 shrink-0">{formatDurationLabel(a.seconds)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <h4 className="text-sm font-bold text-slate-800">App sessions</h4>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-white text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-2">Time</th>
                        <th className="text-left px-4 py-2">Employee</th>
                        <th className="text-left px-4 py-2">Application</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appData.recentSessions.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">No app usage for {rangeLabel}.</td></tr>
                      ) : appData.recentSessions.map((s) => (
                        <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                            {formatTimeRange(s.startTime, s.endTime, s.durationSeconds)}
                          </td>
                          <td className="px-4 py-2 font-semibold text-slate-700">{s.employeeName}</td>
                          <td className="px-4 py-2 text-slate-700 max-w-[280px]">
                            <span className="font-semibold">{s.appName}</span>
                            {s.windowTitle && s.windowTitle !== s.appName && (
                              <span className="text-slate-400 block truncate">{s.windowTitle}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "keyboard" && keyboardData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Keystrokes" value={keyboardData.summary.totalKeyCount.toLocaleString()} accent="text-slate-800" />
                  <StatCard label="Mouse clicks" value={keyboardData.summary.totalMouseClicks.toLocaleString()} />
                  <StatCard label="Scrolls" value={keyboardData.summary.totalScrollCount.toLocaleString()} />
                  <StatCard label="Active time" value={formatDurationLabel(keyboardData.summary.activeSeconds)} accent="text-[#ff791a]" />
                </div>
                {(keyboardData.recentSequences ?? []).length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <h4 className="text-sm font-bold text-slate-800">Recent keystrokes</h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {keyboardData.recentSequences.map((seq) => (
                        <div key={seq.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-slate-700">{seq.employeeName || "Employee"}</span>
                            <span className="text-[10px] text-slate-500">
                              {formatClock(seq.capturedAt)} · {seq.keyCount} keys
                            </span>
                          </div>
                          <p className="text-xs font-mono text-slate-600 break-all leading-relaxed bg-slate-50 rounded-lg px-3 py-2">
                            {seq.sequence}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50"><h4 className="text-sm font-bold text-slate-800">By employee — {rangeLabel}</h4></div>
                  <table className="w-full text-xs">
                    <thead className="bg-white text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-2">Employee</th>
                        <th className="text-left px-4 py-2">Keystrokes</th>
                        <th className="text-left px-4 py-2">Active time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keyboardData.byEmployee.map((e) => (
                        <tr key={e.employeeId} className="border-t border-slate-100">
                          <td className="px-4 py-2 font-semibold">{e.employeeName}</td>
                          <td className="px-4 py-2">{e.keyCount.toLocaleString()}</td>
                          <td className="px-4 py-2">{formatDurationLabel(e.activeSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "productivity" && productivity && (
              <div className="space-y-4">
                <StatCard label={`Avg Productivity (${PERIOD_LABELS[productivity.period]})`} value={`${productivity.avgProductivity}%`} accent="text-[#ff791a]" />
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100"><h4 className="text-sm font-bold text-slate-800">Leaderboard — {rangeLabel}</h4></div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2">Rank</th>
                        <th className="text-left px-4 py-2">Employee</th>
                        <th className="text-left px-4 py-2">Score</th>
                        <th className="text-left px-4 py-2">Active %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productivity.leaderboard.map((row) => (
                        <tr key={row.employeeId} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-2 font-bold text-slate-400">#{row.rank}</td>
                          <td className="px-4 py-2">
                            <button type="button" onClick={() => openEmployeeDetail(row.employeeId)} className="font-semibold text-slate-800 hover:text-[#ff791a]">{row.employeeName}</button>
                          </td>
                          <td className="px-4 py-2 text-[#ff791a] font-bold">{row.score}%</td>
                          <td className="px-4 py-2">{row.activePercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "meetings" && meetingData && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <StatCard label={`Meetings (${PERIOD_LABELS[meetingData.period]})`} value={meetingData.totalMeetings} />
                  <StatCard label="Meeting time" value={formatDurationLabel(meetingData.totalMeetingSeconds)} accent="text-blue-600" />
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100"><h4 className="text-sm font-bold text-slate-800">Meeting activity — {rangeLabel}</h4></div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2">Employee</th>
                        <th className="text-left px-4 py-2">Meetings</th>
                        <th className="text-left px-4 py-2">Meeting time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meetingData.byEmployee.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No meetings for {rangeLabel}</td></tr>
                      ) : meetingData.byEmployee.map((row) => (
                        <tr key={`${row.employeeId}-${row.date}`} className="border-t border-slate-100">
                          <td className="px-4 py-2 font-semibold">{row.employeeName}</td>
                          <td className="px-4 py-2">{row.meetingCount}</td>
                          <td className="px-4 py-2">{formatDurationLabel(row.meetingSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "files" && fileData && (
              <div className="space-y-4">
                <StatCard label={`File events (${PERIOD_LABELS[fileData.period]})`} value={fileData.totalEvents} />
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100"><h4 className="text-sm font-bold text-slate-800">File activity — {rangeLabel}</h4></div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2">Time</th>
                        <th className="text-left px-4 py-2">Employee</th>
                        <th className="text-left px-4 py-2">Action</th>
                        <th className="text-left px-4 py-2">File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fileData.events.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No file activity recorded</td></tr>
                      ) : fileData.events.map((ev) => (
                        <tr key={ev.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 whitespace-nowrap">{formatClock(ev.timestamp)}</td>
                          <td className="px-4 py-2 font-semibold">{ev.employeeName}</td>
                          <td className="px-4 py-2 capitalize">{ev.action}</td>
                          <td className="px-4 py-2 font-mono text-[10px] text-slate-600 truncate max-w-[280px]" title={ev.filePath}>{ev.fileName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "peripherals" && peripheralData && (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100"><h4 className="text-sm font-bold text-slate-800">USB devices — {rangeLabel}</h4></div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2">Time</th>
                        <th className="text-left px-4 py-2">Employee</th>
                        <th className="text-left px-4 py-2">Event</th>
                        <th className="text-left px-4 py-2">Device</th>
                        <th className="text-left px-4 py-2">Serial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peripheralData.usbEvents.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No USB events</td></tr>
                      ) : peripheralData.usbEvents.map((ev) => (
                        <tr key={ev.id} className="border-t border-slate-100">
                          <td className="px-4 py-2">{formatClock(ev.timestamp)}</td>
                          <td className="px-4 py-2 font-semibold">{ev.employeeName}</td>
                          <td className="px-4 py-2 capitalize">{ev.event}</td>
                          <td className="px-4 py-2">{ev.deviceName}</td>
                          <td className="px-4 py-2 font-mono text-[10px]">{ev.serialNumber || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100"><h4 className="text-sm font-bold text-slate-800">Print jobs — {rangeLabel}</h4></div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2">Time</th>
                        <th className="text-left px-4 py-2">Employee</th>
                        <th className="text-left px-4 py-2">Printer</th>
                        <th className="text-left px-4 py-2">Jobs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peripheralData.printEvents.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No print activity</td></tr>
                      ) : peripheralData.printEvents.map((ev) => (
                        <tr key={ev.id} className="border-t border-slate-100">
                          <td className="px-4 py-2">{formatClock(ev.timestamp)}</td>
                          <td className="px-4 py-2 font-semibold">{ev.employeeName}</td>
                          <td className="px-4 py-2">{ev.printerName}</td>
                          <td className="px-4 py-2">{ev.printCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "working-hours" && workingHoursData && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600">
                  Expected hours: <strong>{workingHoursData.workingHours.startTime}</strong> – <strong>{workingHoursData.workingHours.endTime}</strong>
                  {" · "}Work days: {workingHoursData.workingHours.workDays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}
                  {workingHoursData.workingHours.timezone ? ` · ${workingHoursData.workingHours.timezone}` : ""}
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100"><h4 className="text-sm font-bold text-slate-800">Active vs idle within working hours — {rangeLabel}</h4></div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2">Employee</th>
                        <th className="text-left px-4 py-2">Expected</th>
                        <th className="text-left px-4 py-2">Active</th>
                        <th className="text-left px-4 py-2">Idle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workingHoursData.byEmployee.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No data for {rangeLabel}</td></tr>
                      ) : workingHoursData.byEmployee.map((row) => (
                        <tr key={row.employeeId} className="border-t border-slate-100">
                          <td className="px-4 py-2">
                            <button type="button" onClick={() => openEmployeeDetail(row.employeeId)} className="font-semibold text-slate-800 hover:text-[#ff791a]">{row.employeeName}</button>
                          </td>
                          <td className="px-4 py-2">{formatDurationLabel(row.expectedWorkSeconds)}</td>
                          <td className="px-4 py-2 text-emerald-700">{formatDurationLabel(row.activeSeconds)}</td>
                          <td className="px-4 py-2 text-amber-700">{formatDurationLabel(row.idleSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "alerts" && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-2">Severity</th>
                      <th className="text-left px-4 py-2">Employee</th>
                      <th className="text-left px-4 py-2">Event</th>
                      <th className="text-left px-4 py-2">Time</th>
                      <th className="text-left px-4 py-2">Status</th>
                      {!readOnly && <th className="text-left px-4 py-2">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            a.severity === "critical" ? "bg-red-100 text-red-700" :
                            a.severity === "high" ? "bg-orange-100 text-orange-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>{a.severity}</span>
                        </td>
                        <td className="px-4 py-2 font-semibold">{a.employeeName}</td>
                        <td className="px-4 py-2">
                          <div className="font-semibold text-slate-700">{a.event}</div>
                          <div className="text-slate-400">{a.details}</div>
                        </td>
                        <td className="px-4 py-2 text-slate-500">{formatClock(a.timestamp)}</td>
                        <td className="px-4 py-2 capitalize">{a.status}</td>
                        {!readOnly && a.status === "open" && (
                          <td className="px-4 py-2 space-x-2">
                            <button type="button" onClick={() => handleResolveAlert(a.id, "resolved")} className="text-emerald-600 font-semibold hover:underline">Resolve</button>
                            <button type="button" onClick={() => handleResolveAlert(a.id, "ignored")} className="text-slate-500 font-semibold hover:underline">Ignore</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "agents" && (
              <MonitorEmployeeAgentsPanel readOnly={readOnly} onCredentialsChanged={refresh} />
            )}

            {activeTab === "devices" && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-2">Employee</th>
                      <th className="text-left px-4 py-2">Device</th>
                      <th className="text-left px-4 py-2">OS</th>
                      <th className="text-left px-4 py-2">Status</th>
                      <th className="text-left px-4 py-2">Last Seen</th>
                      {!readOnly && <th className="text-left px-4 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d) => (
                      <tr key={d.id} className="border-t border-slate-100">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold">{d.employeeName || d.employeeCode || 'Unassigned'}</div>
                          <div className="text-slate-400">{d.employeeCode}</div>
                        </td>
                        <td className="px-4 py-2.5">{d.deviceName}</td>
                        <td className="px-4 py-2.5 text-slate-500">{d.osVersion || "—"}</td>
                        <td className="px-4 py-2.5 capitalize">{d.status}</td>
                        <td className="px-4 py-2.5 text-slate-500">{d.lastHeartbeatAt ? formatClock(d.lastHeartbeatAt) : "—"}</td>
                        {!readOnly && d.status !== "revoked" && (
                          <td className="px-4 py-2.5">
                            <button type="button" onClick={() => handleRevokeDevice(d.id)} className="inline-flex items-center gap-1 text-red-500 font-semibold hover:underline text-[11px]">
                              <Trash2 size={12} />
                              Revoke
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {devices.length === 0 && (
                      <tr><td colSpan={readOnly ? 5 : 6} className="px-4 py-8 text-center text-slate-400">No devices registered yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "settings" && settings && (
              <MonitorSettingsPanel
                settings={settings}
                readOnly={readOnly}
                onSave={handleSaveSettings}
              />
            )}
          </div>
        </main>
      </div>

      {screenshotViewerIndex !== null && screenshots.length > 0 && (
        <MonitorScreenshotLightbox
          screenshots={screenshots}
          index={Math.min(screenshotViewerIndex, screenshots.length - 1)}
          onClose={() => setScreenshotViewerIndex(null)}
          onIndexChange={setScreenshotViewerIndex}
        />
      )}

      {employeeDetail && (
        <MonitorEmployeeDetail data={employeeDetail as never} onClose={() => setEmployeeDetail(null)} />
      )}

      {liveView && (
        <MonitorLiveViewModal
          deviceAgentId={liveView.deviceAgentId}
          employeeName={liveView.employeeName}
          sessionId={liveView.sessionId}
          onClose={() => setLiveView(null)}
        />
      )}
    </div>
  );
}
