import React from "react";
import { CheckCircle, Circle } from "lucide-react";
import { ErrorBanner, LoadingSpinner, PageHeader } from "./PlatformShared";
import { platformPatch, usePlatformApi } from "../../hooks/usePlatformApi";

const STEPS = [
  { key: "company_setup", label: "Company Setup Wizard" },
  { key: "employee_import", label: "Employee Import" },
  { key: "attendance_import", label: "Attendance Import" },
  { key: "payroll_import", label: "Payroll Import" },
  { key: "training_videos", label: "Training Videos" },
  { key: "knowledge_base", label: "Knowledge Base" },
  { key: "guided_setup", label: "Guided Setup" },
];

interface OnboardingRecord {
  tenantId: string;
  companyName?: string;
  currentStep: number;
  completed: boolean;
  steps: Record<string, boolean>;
}

export default function PlatformOnboardingPage() {
  const { data: records, loading, error, reload } = usePlatformApi<OnboardingRecord[]>("/api/platform/onboarding");

  async function toggle(tenantId: string, step: string, done: boolean) {
    await platformPatch(`/api/platform/onboarding/${tenantId}/steps/${step}`, { done: !done });
    void reload();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Onboarding Center" description="Track company setup progress and guided onboarding." />
      {error && <ErrorBanner message={error} />}

      <div className="space-y-4">
        {(records ?? []).length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-slate-400">
            Onboarding records are created when tenants start setup. Create a company trial to begin.
          </div>
        )}
        {(records ?? []).map((r) => (
          <div key={r.tenantId} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800">{r.companyName ?? r.tenantId}</h3>
                <p className="text-xs text-slate-400">Step {r.currentStep}/{STEPS.length} {r.completed && "· Complete"}</p>
              </div>
              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#ff791a] rounded-full" style={{ width: `${(r.currentStep / STEPS.length) * 100}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {STEPS.map((s) => (
                <button key={s.key} type="button" onClick={() => void toggle(r.tenantId, s.key, !!r.steps?.[s.key])} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-left text-sm">
                  {r.steps?.[s.key] ? <CheckCircle size={16} className="text-green-500" /> : <Circle size={16} className="text-slate-300" />}
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
