import React, { useState } from "react";
import { Key, Camera, Shield, Bell, Zap, Target, Clock, HardDrive, Monitor } from "lucide-react";
import { MonitorSettings, monitorApi } from "../../lib/monitor-api";

const WORK_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FEATURE_LABELS: Record<string, string> = {
  activityMonitoring: "Activity monitoring",
  screenshots: "Screenshots",
  websiteTracking: "Website tracking",
  appTracking: "Application tracking",
  productivityScore: "Productivity scoring",
  usbMonitoring: "USB monitoring",
  printMonitoring: "Print monitoring",
  fileActivity: "File activity",
  meetingDetection: "Meeting detection (Zoom / Teams / Meet)",
  keyboardMouseMetrics: "Keyboard & mouse metrics",
};

const SCREENSHOT_MODES = [
  { value: "fixed_5", label: "Every 5 minutes" },
  { value: "fixed_10", label: "Every 10 minutes" },
  { value: "fixed_15", label: "Every 15 minutes" },
  { value: "random", label: "Random interval" },
] as const;

function parseList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinList(items: string[] | undefined): string {
  return (items ?? []).join("\n");
}

interface MonitorSettingsPanelProps {
  settings: MonitorSettings;
  readOnly?: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}

function Section({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 ${className}`}>
      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Icon size={16} className="text-[#ff791a]" />
        {title}
      </h4>
      {children}
    </div>
  );
}

export default function MonitorSettingsPanel({ settings, readOnly = false, onSave }: MonitorSettingsPanelProps) {
  const [saving, setSaving] = useState(false);
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [retentionMsg, setRetentionMsg] = useState("");

  const save = async (patch: Record<string, unknown>) => {
    if (readOnly) return;
    setSaving(true);
    try {
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white disabled:opacity-60";
  const labelCls = "text-[11px] font-semibold text-slate-600 block mb-1";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
      {saving && (
        <p className="text-[11px] text-slate-400 lg:col-span-2">Saving…</p>
      )}

      <Section title="General" icon={Zap}>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={readOnly}
              onChange={(e) => save({ enabled: e.target.checked })}
            />
            Monitoring enabled
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.consentRequired}
              disabled={readOnly}
              onChange={(e) => save({ consentRequired: e.target.checked })}
            />
            Require employee consent on install
          </label>
        </div>
      </Section>

      <Section title="Idle Detection" icon={Zap}>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <label>
            Idle after (mins):
            <input
              type="number"
              min={1}
              max={60}
              defaultValue={settings.idle?.idleMinutes ?? 5}
              disabled={readOnly}
              onBlur={(e) => save({ idleMinutes: Number(e.target.value) })}
              className="border rounded px-2 py-1 w-16 ml-1"
            />
          </label>
          <label>
            Long idle after (mins):
            <input
              type="number"
              min={5}
              max={120}
              defaultValue={settings.idle?.longIdleMinutes ?? 15}
              disabled={readOnly}
              onBlur={(e) => save({ longIdleMinutes: Number(e.target.value) })}
              className="border rounded px-2 py-1 w-16 ml-1"
            />
          </label>
        </div>
      </Section>

      <Section title="Monitoring Features" icon={Target} className="lg:col-span-2">
        <p className="text-[11px] text-slate-500">Enable or disable what the desktop agent collects.</p>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-2">
          {Object.entries(FEATURE_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={!!settings.features?.[key]}
                disabled={readOnly}
                onChange={(e) => save({ features: { ...settings.features, [key]: e.target.checked } })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Screenshots" icon={Camera}>
        <div>
          <span className={labelCls}>Capture frequency</span>
          <select
            className={inputCls}
            value={settings.screenshot?.mode ?? "fixed_10"}
            disabled={readOnly}
            onChange={(e) => save({ screenshotMode: e.target.value })}
          >
            {SCREENSHOT_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        {settings.screenshot?.mode === "random" && (
          <div>
            <span className={labelCls}>Max interval (minutes) for random mode</span>
            <input
              type="number"
              min={5}
              max={60}
              className={inputCls}
              defaultValue={settings.screenshot?.intervalMinutes ?? 15}
              disabled={readOnly}
              onBlur={(e) => save({ screenshotIntervalMinutes: Number(e.target.value) })}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.screenshot?.blurSensitiveData ?? false}
              disabled={readOnly}
              onChange={(e) => save({ blurSensitiveData: e.target.checked })}
            />
            Blur sensitive data
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.screenshot?.captureActiveWindowOnly ?? false}
              disabled={readOnly}
              onChange={(e) => save({ captureActiveWindowOnly: e.target.checked })}
            />
            Active window only
          </label>
        </div>
        <div>
          <span className={labelCls}>Disable screenshots for apps (one per line)</span>
          <textarea
            className={`${inputCls} min-h-[56px] font-mono`}
            defaultValue={joinList(settings.screenshot?.disabledApps)}
            disabled={readOnly}
            placeholder="e.g. password managers, banking apps"
            onBlur={(e) => save({ screenshotDisabledApps: parseList(e.target.value) })}
          />
        </div>
      </Section>

      <Section title="Keystrokes & Mouse" icon={Key}>
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Only activity counts are stored — never actual key content or typed text.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.keyboard?.trackKeystrokes ?? true}
              disabled={readOnly}
              onChange={(e) => save({ trackKeystrokes: e.target.checked })}
            />
            Track keystroke count
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.keyboard?.trackMouseActivity ?? true}
              disabled={readOnly}
              onChange={(e) => save({ trackMouseActivity: e.target.checked })}
            />
            Track mouse clicks & movement
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.keyboard?.trackScrollActivity ?? true}
              disabled={readOnly}
              onChange={(e) => save({ trackScrollActivity: e.target.checked })}
            />
            Track scroll activity
          </label>
        </div>
        <div>
          <span className={labelCls}>Summary interval (minutes)</span>
          <input
            type="number"
            min={15}
            max={120}
            className={inputCls}
            defaultValue={settings.keyboard?.summaryIntervalMinutes ?? 60}
            disabled={readOnly}
            onBlur={(e) => save({ keyboardSummaryIntervalMinutes: Number(e.target.value) })}
          />
          <p className="text-[10px] text-slate-400 mt-1">Aggregated hourly by default.</p>
        </div>
      </Section>

      <Section title="Security & Blocking" icon={Shield}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <span className={labelCls}>Blocked applications (one per line)</span>
            <textarea
              className={`${inputCls} min-h-[56px] font-mono`}
              defaultValue={joinList(settings.blockedApps)}
              disabled={readOnly}
              placeholder="e.g. torrent, steam"
              onBlur={(e) => save({ blockedApps: parseList(e.target.value) })}
            />
          </div>
          <div>
            <span className={labelCls}>Blocked websites / domains (one per line)</span>
            <textarea
              className={`${inputCls} min-h-[56px] font-mono`}
              defaultValue={joinList(settings.blockedWebsites)}
              disabled={readOnly}
              placeholder="e.g. facebook.com, instagram.com"
              onBlur={(e) => save({ blockedWebsites: parseList(e.target.value) })}
            />
          </div>
        </div>
      </Section>

      <Section title="Productivity Classification" icon={Target} className="lg:col-span-2">
        <p className="text-[11px] text-slate-500">Match app names (partial, case-insensitive) for productivity scoring.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {(
            [
              { key: "productiveApps", label: "Productive apps", items: settings.classification?.productive },
              { key: "neutralApps", label: "Neutral apps", items: settings.classification?.neutral },
              { key: "unproductiveApps", label: "Unproductive apps", items: settings.classification?.unproductive },
            ] as const
          ).map(({ key, label, items }) => (
            <div key={key}>
              <span className={labelCls}>{label}</span>
              <textarea
                className={`${inputCls} min-h-[56px] font-mono`}
                defaultValue={joinList(items)}
                disabled={readOnly}
                placeholder="e.g. excel, vscode"
                onBlur={(e) => save({ [key]: parseList(e.target.value) })}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Working Hours" icon={Clock}>
        <p className="text-[11px] text-slate-500">Expected work schedule for idle vs active comparison.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={labelCls}>Start time</span>
            <input
              type="time"
              className={inputCls}
              defaultValue={settings.workingHours?.startTime ?? "09:00"}
              disabled={readOnly}
              onBlur={(e) => save({ workDayStartTime: e.target.value })}
            />
          </div>
          <div>
            <span className={labelCls}>End time</span>
            <input
              type="time"
              className={inputCls}
              defaultValue={settings.workingHours?.endTime ?? "18:00"}
              disabled={readOnly}
              onBlur={(e) => save({ workDayEndTime: e.target.value })}
            />
          </div>
        </div>
        <div>
          <span className={labelCls}>Work days</span>
          <div className="flex flex-wrap gap-2">
            {WORK_DAY_LABELS.map((label, day) => {
              const selected = (settings.workingHours?.workDays ?? [1, 2, 3, 4, 5]).includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  data-no-busy
                  disabled={readOnly}
                  onClick={() => {
                    const current = settings.workingHours?.workDays ?? [1, 2, 3, 4, 5];
                    const next = selected ? current.filter((d) => d !== day) : [...current, day].sort();
                    save({ workDays: next });
                  }}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                    selected ? "border-[#ff791a] bg-orange-50 text-[#ff791a]" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <span className={labelCls}>Timezone (optional)</span>
          <input
            type="text"
            className={inputCls}
            defaultValue={settings.workingHours?.timezone ?? "Asia/Kolkata"}
            disabled={readOnly}
            placeholder="e.g. Asia/Kolkata"
            onBlur={(e) => save({ workTimezone: e.target.value })}
          />
        </div>
      </Section>

      <Section title="Live View" icon={Monitor}>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.liveView?.enabled ?? true}
              disabled={readOnly}
              onChange={(e) => save({ liveViewEnabled: e.target.checked })}
            />
            Allow on-demand live screen view
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={labelCls}>Max session (minutes)</span>
            <input
              type="number"
              min={5}
              max={120}
              className={inputCls}
              defaultValue={settings.liveView?.maxSessionMinutes ?? 30}
              disabled={readOnly}
              onBlur={(e) => save({ liveViewMaxSessionMinutes: Number(e.target.value) })}
            />
          </div>
          <div>
            <span className={labelCls}>Capture interval (seconds)</span>
            <input
              type="number"
              min={3}
              max={60}
              className={inputCls}
              defaultValue={settings.liveView?.captureIntervalSeconds ?? 5}
              disabled={readOnly}
              onBlur={(e) => save({ liveViewCaptureIntervalSeconds: Number(e.target.value) })}
            />
          </div>
        </div>
      </Section>

      <Section title="Data Retention" icon={HardDrive}>
        <p className="text-[11px] text-slate-500">Older records are deleted when you apply retention.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(
            [
              { key: "retentionScreenshotDays", label: "Screenshots", val: settings.retention?.screenshotDays ?? 90 },
              { key: "retentionKeystrokeDays", label: "Keystrokes", val: settings.retention?.keystrokeDays ?? 90 },
              { key: "retentionWebsiteDays", label: "Websites", val: settings.retention?.websiteDays ?? 90 },
              { key: "retentionFileActivityDays", label: "File activity", val: settings.retention?.fileActivityDays ?? 90 },
              { key: "retentionActivityDays", label: "Activity logs", val: settings.retention?.activityDays ?? 180 },
            ] as const
          ).map(({ key, label, val }) => (
            <div key={key}>
              <span className={labelCls}>{label} (days)</span>
              <input
                type="number"
                min={7}
                max={3650}
                className={inputCls}
                defaultValue={val}
                disabled={readOnly}
                onBlur={(e) => save({ [key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
        {!readOnly && (
          <div className="pt-2">
            <button
              type="button"
              disabled={retentionBusy}
              onClick={async () => {
                if (!confirm("Delete monitor data older than the retention limits above?")) return;
                setRetentionBusy(true);
                setRetentionMsg("");
                try {
                  await monitorApi.applyRetention();
                  setRetentionMsg("Retention applied successfully.");
                } catch (e) {
                  setRetentionMsg(e instanceof Error ? e.message : "Failed to apply retention");
                } finally {
                  setRetentionBusy(false);
                }
              }}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {retentionBusy ? "Applying…" : "Apply retention now"}
            </button>
            {retentionMsg && <p className="text-[11px] text-slate-500 mt-2">{retentionMsg}</p>}
          </div>
        )}
      </Section>

      <Section title="Alerts" icon={Bell}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {(
            [
              { key: "alertExcessiveIdle", label: "Excessive idle time", val: settings.alerts?.excessiveIdle },
              { key: "alertUnauthorizedSoftware", label: "Unauthorized software", val: settings.alerts?.unauthorizedSoftware },
              { key: "alertBlacklistedWebsite", label: "Blacklisted website", val: settings.alerts?.blacklistedWebsite },
              { key: "alertAgentOffline", label: "Agent offline", val: settings.alerts?.agentOffline },
              { key: "alertUsbUsage", label: "USB device connected", val: settings.alerts?.usbUsage },
            ] as const
          ).map(({ key, label, val }) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={val ?? true}
                disabled={readOnly}
                onChange={(e) => save({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <div>
          <span className={labelCls}>Agent offline threshold (minutes)</span>
          <input
            type="number"
            min={1}
            max={30}
            className={inputCls}
            defaultValue={settings.alerts?.offlineThresholdMinutes ?? 3}
            disabled={readOnly}
            onBlur={(e) => save({ offlineThresholdMinutes: Number(e.target.value) })}
          />
        </div>
      </Section>
    </div>
  );
}
