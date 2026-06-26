import { parseApiError } from "../api";
import type { MonitorPeriod } from "./monitor-period";

export type { MonitorPeriod };

function withQuery(path: string, params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const q = sp.toString();
  return `${path}${q ? `?${q}` : ""}`;
}

function analyticsQuery(opts: {
  date: string;
  period?: MonitorPeriod;
  employeeId?: string;
}) {
  return withQuery("", {
    date: opts.date,
    period: opts.period,
    employeeId: opts.employeeId,
  }).replace(/^\?/, "");
}

async function monitorFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/monitor${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw await parseApiError(res, "Monitor request failed");
  const text = await res.text();
  if (!text.trim()) return null as T;
  return JSON.parse(text) as T;
}

export interface MonitorWorkBreak {
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
}

export interface MonitorWorkSession {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  loginTime: string | null;
  logoutTime: string | null;
  totalHoursWorked: number;
  totalHoursWorkedSeconds: number;
  totalBreaks: number;
  totalBreakSeconds: number;
  breaks: MonitorWorkBreak[];
}

export interface MonitorOverview {
  employeesOnline: number;
  employeesOffline: number;
  activeEmployees: number;
  idleEmployees: number;
  productivityScore: number;
  todayWorkHours: number;
  screenshotCount: number;
  openAlerts: number;
  totalMonitored: number;
  workSessions: MonitorWorkSession[];
}

export interface LiveEmployee {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  location: string;
  deviceName: string;
  deviceAgentId: string;
  isOnline: boolean;
  activityState: string;
  currentApp: string;
  currentWindow: string;
  currentWebsite: string;
  activeSeconds: number;
  idleSeconds: number;
  lastHeartbeatAt: string | null;
}

export interface EmployeeSearchResult {
  id: string;
  employeeCode: string;
  name: string;
  location: string;
  hasCredential: boolean;
  keyHint: string;
  hashHint: string;
}

export interface EmployeeAgentCredential {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  location: string;
  keyHint: string;
  hashHint: string;
  status: string;
  deviceCount: number;
}

export interface MonitorDevice {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  deviceName: string;
  status: string;
  osVersion: string;
  lastHeartbeatAt: string | null;
  activityState: string;
}

export interface MonitorSettings {
  id: string;
  plan: "starter" | "professional" | "enterprise";
  enabled: boolean;
  consentRequired: boolean;
  hasCompanyKey: boolean;
  companyKeyHint: string;
  features: Record<string, boolean>;
  idle: { idleMinutes: number; longIdleMinutes: number };
  screenshot: {
    mode: string;
    intervalMinutes: number;
    blurSensitiveData: boolean;
    disabledApps: string[];
    captureActiveWindowOnly?: boolean;
  };
  keyboard: {
    trackKeystrokes: boolean;
    trackMouseActivity: boolean;
    trackScrollActivity: boolean;
    summaryIntervalMinutes: number;
  };
  alerts: {
    excessiveIdle: boolean;
    unauthorizedSoftware: boolean;
    blacklistedWebsite: boolean;
    agentOffline: boolean;
    usbUsage: boolean;
    offlineThresholdMinutes: number;
  };
  blockedApps: string[];
  blockedWebsites: string[];
  classification: { productive: string[]; neutral: string[]; unproductive: string[] };
  workingHours?: { startTime: string; endTime: string; workDays: number[]; timezone?: string };
  retention?: {
    screenshotDays: number;
    keystrokeDays: number;
    websiteDays: number;
    fileActivityDays: number;
    activityDays: number;
  };
  liveView?: { enabled: boolean; maxSessionMinutes: number; captureIntervalSeconds: number };
}

export interface MonitoredEmployee {
  id: string;
  employeeCode: string;
  name: string;
  location: string;
  deviceCount: number;
  isOnline: boolean;
  currentApp: string;
  activityState: string;
}

export interface KeyboardAnalytics {
  period: MonitorPeriod;
  startDate: string;
  endDate: string;
  summary: {
    totalKeyCount: number;
    totalMouseClicks: number;
    totalScrollCount: number;
    totalMouseDistance: number;
    avgTypingSpeed: number;
    activeSeconds: number;
  };
  byEmployee: Array<{
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    keyCount: number;
    mouseClicks: number;
    scrollCount: number;
    mouseDistance: number;
    activeSeconds: number;
  }>;
  dailyBreakdown: Array<{ date: string; keyCount: number; mouseClicks: number; scrollCount: number }>;
  recentSequences: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    sequence: string;
    keyCount: number;
    capturedAt: string;
  }>;
}

export interface ApplicationAnalytics {
  period: MonitorPeriod;
  startDate: string;
  endDate: string;
  topApplications: Array<{ appName: string; displayName: string; seconds: number; sessions: number; category: string }>;
  byEmployee: Array<{ employeeId: string; employeeName: string; seconds: number; sessions: number; topApp: string }>;
  recentSessions: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    appName: string;
    processName: string;
    windowTitle: string;
    startTime: string;
    endTime: string | null;
    durationSeconds: number;
    category: string;
    date: string;
  }>;
  totalSessions: number;
}

export const monitorApi = {
  getEmployees: (employeeId?: string) =>
    monitorFetch<MonitoredEmployee[]>(withQuery("/employees", { employeeId })),
  searchEmployees: (q: string) =>
    monitorFetch<EmployeeSearchResult[]>(withQuery("/employees/search", { q })),
  getOverview: (employeeId?: string) =>
    monitorFetch<MonitorOverview>(withQuery("/overview", { employeeId })),
  getLive: (employeeId?: string) =>
    monitorFetch<LiveEmployee[]>(withQuery("/live", { employeeId })),
  getTimeline: (employeeId: string, date: string, period?: MonitorPeriod) =>
    monitorFetch<{
      date: string;
      period: MonitorPeriod;
      startDate: string;
      endDate: string;
      events: Array<{ time: string; endTime?: string; type: string; label: string; sublabel?: string; durationSeconds?: number; category?: string }>;
    }>(withQuery(`/timeline/${employeeId}`, { date, period })),
  getScreenshots: (opts?: { employeeId?: string; date?: string; period?: MonitorPeriod }) => {
    const q = analyticsQuery({ date: opts?.date ?? todayKey(), period: opts?.period, employeeId: opts?.employeeId });
    return monitorFetch<Array<{ id: string; employeeId: string; timestamp: string; imageUrl: string; appName: string; windowTitle: string; employeeName?: string }>>(
      `/screenshots${q ? `?${q}` : ""}`,
    );
  },
  deleteScreenshots: (ids: string[]) =>
    monitorFetch<{ success: boolean }>("/screenshots", { method: "DELETE", body: JSON.stringify({ ids }) }),
  getWebsiteAnalytics: (date: string, opts?: { employeeId?: string; period?: MonitorPeriod }) => {
    const q = analyticsQuery({ date, period: opts?.period, employeeId: opts?.employeeId });
    return monitorFetch<{
      period: MonitorPeriod;
      startDate: string;
      endDate: string;
      topWebsites: Array<{ domain: string; seconds: number; visits: number; category: string }>;
      productivityBreakdown: Array<{ category: string; seconds: number }>;
      byEmployee: Array<{ employeeId: string; employeeName: string; seconds: number; visits: number }>;
      recentVisits: Array<{
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
    }>(`/analytics/websites?${q}`);
  },
  getApplicationAnalytics: (date: string, opts?: { employeeId?: string; period?: MonitorPeriod }) => {
    const q = analyticsQuery({ date, period: opts?.period, employeeId: opts?.employeeId });
    return monitorFetch<ApplicationAnalytics>(`/analytics/applications?${q}`);
  },
  getKeyboardAnalytics: (date: string, opts?: { employeeId?: string; period?: MonitorPeriod }) => {
    const q = analyticsQuery({ date, period: opts?.period, employeeId: opts?.employeeId });
    return monitorFetch<KeyboardAnalytics>(`/analytics/keyboard?${q}`);
  },
  getProductivity: (date: string, opts?: { period?: MonitorPeriod; employeeId?: string }) => {
    const q = analyticsQuery({ date, period: opts?.period, employeeId: opts?.employeeId });
    return monitorFetch<{
      period: MonitorPeriod;
      startDate: string;
      endDate: string;
      avgProductivity: number;
      leaderboard: Array<{
        employeeId: string;
        employeeName: string;
        employeeCode: string;
        score: number;
        activePercent: number;
        idlePercent: number;
        activeSeconds: number;
        idleSeconds: number;
        keyCount: number;
        rank: number;
      }>;
    }>(`/productivity?${q}`);
  },
  getAlerts: (opts?: { status?: string; employeeId?: string }) => {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.employeeId) params.set("employeeId", opts.employeeId);
    const q = params.toString();
    return monitorFetch<Array<{ id: string; employeeName: string; employeeCode: string; severity: string; event: string; details: string; timestamp: string; status: string }>>(
      `/alerts${q ? `?${q}` : ""}`,
    );
  },
  resolveAlert: (alertId: string, status: "resolved" | "ignored") =>
    monitorFetch(`/alerts/${alertId}`, { method: "PUT", body: JSON.stringify({ status }) }),
  getEmployeeProfile: (employeeId: string) => monitorFetch(`/employees/${employeeId}/profile`),
  getAgentCredentials: () => monitorFetch<EmployeeAgentCredential[]>("/agent-credentials"),
  createAgentCredential: (employeeId: string) =>
    monitorFetch<{ employeeId: string; employeeCode: string; employeeName: string; key: string; hash: string }>(
      "/agent-credentials",
      { method: "POST", body: JSON.stringify({ employeeId }) },
    ),
  revokeAgentCredential: (employeeId: string) =>
    monitorFetch<{ success: boolean }>(`/agent-credentials/${employeeId}`, { method: "DELETE" }),
  getDevices: (employeeId?: string) =>
    monitorFetch<MonitorDevice[]>(withQuery("/devices", { employeeId })),
  getSettings: () => monitorFetch<MonitorSettings>("/settings"),
  updateSettings: (body: Partial<MonitorSettings> & Record<string, unknown>) =>
    monitorFetch<MonitorSettings>("/settings", { method: "PUT", body: JSON.stringify(body) }),
  revokeDevice: (deviceAgentId: string) =>
    monitorFetch("/devices/revoke", { method: "POST", body: JSON.stringify({ deviceAgentId }) }),
  captureScreenshot: (deviceAgentId: string) =>
    monitorFetch<{ commandId: string; deviceAgentId: string }>("/devices/capture-screenshot", {
      method: "POST",
      body: JSON.stringify({ deviceAgentId }),
    }),
  startLiveView: (deviceAgentId: string) =>
    monitorFetch<{ commandId: string; sessionId: string; deviceAgentId: string; maxSessionMinutes: number }>(
      "/devices/live-view/start",
      { method: "POST", body: JSON.stringify({ deviceAgentId }) },
    ),
  stopLiveView: (deviceAgentId: string) =>
    monitorFetch("/devices/live-view/stop", { method: "POST", body: JSON.stringify({ deviceAgentId }) }),
  getLiveViewFrame: (deviceAgentId: string, sessionId?: string) =>
    monitorFetch<{ imageUrl: string | null; timestamp: string | null }>(
      `/devices/${deviceAgentId}/live-view/frame${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`,
    ),
  getBreakAnalytics: (date: string, opts?: { employeeId?: string; period?: MonitorPeriod }) => {
    const q = analyticsQuery({ date, period: opts?.period, employeeId: opts?.employeeId });
    return monitorFetch<{
      period: MonitorPeriod;
      startDate: string;
      endDate: string;
      totalBreaks: number;
      totalBreakSeconds: number;
      byEmployee: Array<{ employeeId: string; employeeName: string; breakCount: number; totalSeconds: number }>;
      sessions: Array<{ id: string; employeeId: string; employeeName: string; startTime: string; endTime: string | null; durationSeconds: number; date: string }>;
    }>(`/analytics/breaks?${q}`);
  },
  getMeetingAnalytics: (date: string, opts?: { employeeId?: string; period?: MonitorPeriod }) => {
    const q = analyticsQuery({ date, period: opts?.period, employeeId: opts?.employeeId });
    return monitorFetch<{
      period: MonitorPeriod;
      startDate: string;
      endDate: string;
      totalMeetingSeconds: number;
      totalMeetings: number;
      byEmployee: Array<{ employeeId: string; employeeName: string; employeeCode: string; date: string; meetingSeconds: number; meetingCount: number; activeSeconds: number; meetingPercent: number }>;
    }>(`/analytics/meetings?${q}`);
  },
  getFileAnalytics: (date: string, opts?: { employeeId?: string; period?: MonitorPeriod }) => {
    const q = analyticsQuery({ date, period: opts?.period, employeeId: opts?.employeeId });
    return monitorFetch<{
      period: MonitorPeriod;
      startDate: string;
      endDate: string;
      totalEvents: number;
      events: Array<{ id: string; employeeId: string; employeeName: string; action: string; filePath: string; fileName: string; timestamp: string }>;
    }>(`/analytics/files?${q}`);
  },
  getPeripheralAnalytics: (date: string, opts?: { employeeId?: string; period?: MonitorPeriod }) => {
    const q = analyticsQuery({ date, period: opts?.period, employeeId: opts?.employeeId });
    return monitorFetch<{
      period: MonitorPeriod;
      startDate: string;
      endDate: string;
      usbEvents: Array<{ id: string; employeeId: string; employeeName: string; event: string; deviceName: string; serialNumber: string; timestamp: string }>;
      printEvents: Array<{ id: string; employeeId: string; employeeName: string; printerName: string; printCount: number; timestamp: string }>;
    }>(`/analytics/peripherals?${q}`);
  },
  getWorkingHoursAnalytics: (date: string, opts?: { employeeId?: string; period?: MonitorPeriod }) => {
    const q = analyticsQuery({ date, period: opts?.period, employeeId: opts?.employeeId });
    return monitorFetch<{
      period: MonitorPeriod;
      startDate: string;
      endDate: string;
      workingHours: { startTime: string; endTime: string; workDays: number[]; timezone?: string };
      byEmployee: Array<{
        employeeId: string;
        employeeName: string;
        employeeCode: string;
        expectedWorkSeconds: number;
        activeSeconds: number;
        idleSeconds: number;
        activePercentOfExpected: number;
        idlePercentOfExpected: number;
      }>;
    }>(`/analytics/working-hours?${q}`);
  },
  applyRetention: () => monitorFetch<{ success: boolean }>("/settings/apply-retention", { method: "POST" }),
};

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
