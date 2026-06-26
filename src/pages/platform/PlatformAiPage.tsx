import React, { useState } from "react";
import { Save } from "lucide-react";
import { ErrorBanner, LoadingSpinner, PageHeader, StatusBadge } from "./PlatformShared";
import { platformPatch, platformPost, usePlatformApi } from "../../hooks/usePlatformApi";

interface AiSettings {
  chatAssistantEnabled: boolean;
  reportGeneratorEnabled: boolean;
  payrollVerificationEnabled: boolean;
  resumeScreeningEnabled: boolean;
  attendanceAnomalyEnabled: boolean;
  hrCopilotEnabled: boolean;
  defaultModel: string;
  monthlyTokenQuota: number;
  tokensUsedThisMonth: number;
}

const AI_FEATURES = [
  { key: "chatAssistantEnabled", label: "AI Chat Assistant" },
  { key: "reportGeneratorEnabled", label: "AI Report Generator" },
  { key: "payrollVerificationEnabled", label: "AI Payroll Verification" },
  { key: "resumeScreeningEnabled", label: "AI Resume Screening" },
  { key: "attendanceAnomalyEnabled", label: "AI Attendance Anomaly Detection" },
  { key: "hrCopilotEnabled", label: "AI HR Copilot" },
] as const;

export default function PlatformAiPage() {
  const { data, loading, error, reload } = usePlatformApi<AiSettings>("/api/platform/ai/settings");
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await platformPatch("/api/platform/ai/settings", settings);
      void reload();
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) return <LoadingSpinner />;

  const usagePct = settings.monthlyTokenQuota > 0
    ? Math.round((settings.tokensUsedThisMonth / settings.monthlyTokenQuota) * 100)
    : 0;

  return (
    <div>
      <PageHeader title="AI Control Center" description="Configure AI features, models, and token quotas." action={
        <button type="button" disabled={saving} onClick={() => void save()} className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-[#ff791a] text-white rounded-lg disabled:opacity-50"><Save size={14} /> {saving ? "Saving…" : "Save"}</button>
      } />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold text-slate-800 mb-3">AI Features</h3>
          <div className="space-y-2">
            {AI_FEATURES.map((f) => (
              <label key={f.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                <span className="text-sm">{f.label}</span>
                <input type="checkbox" checked={!!settings[f.key]} onChange={(e) => setSettings({ ...settings, [f.key]: e.target.checked })} />
              </label>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Default Model</label>
            <select className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" value={settings.defaultModel} onChange={(e) => setSettings({ ...settings, defaultModel: e.target.value })}>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase">Monthly Token Quota</label>
            <input type="number" className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" value={settings.monthlyTokenQuota} onChange={(e) => setSettings({ ...settings, monthlyTokenQuota: Number(e.target.value) })} />
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Token Usage</span><span>{settings.tokensUsedThisMonth.toLocaleString()} / {settings.monthlyTokenQuota.toLocaleString()}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#ff791a] rounded-full" style={{ width: `${Math.min(usagePct, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
