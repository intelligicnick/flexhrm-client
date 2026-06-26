import React from "react";
import { X } from "lucide-react";
import { formatDurationLabel } from "../../lib/monitor-time";

interface EmployeeDetailData {
  employee: { id: string; employeeCode: string; name: string; location: string };
  devices: Array<{ deviceName: string; osVersion: string; status: string; lastHeartbeatAt: string | null }>;
  dailyActivity: { activeSeconds?: number; idleSeconds?: number; productivityPercent?: number } | null;
  applicationUsage: Array<{ appName: string; windowTitle: string; durationSeconds: number; category: string }>;
  websiteUsage: Array<{ domain: string; durationSeconds: number; category: string }>;
  productivityTrends: Array<{ date: string; score: number; keyCount: number; mouseClicks: number; activeSeconds: number }>;
}

function formatApp(name: string) {
  const map: Record<string, string> = {
    chrome: "Google Chrome", msedge: "Microsoft Edge", winword: "Microsoft Word", excel: "Microsoft Excel",
  };
  const key = name.toLowerCase().replace(/\.exe$/, "");
  return map[key] ?? name.replace(/\.exe$/i, "");
}

export default function MonitorEmployeeDetail({
  data,
  onClose,
}: {
  data: EmployeeDetailData;
  onClose: () => void;
}) {
  const p = data.productivityTrends[0];
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-start">
          <div>
            <h3 className="text-base font-bold text-slate-800">{data.employee.name}</h3>
            <p className="text-xs text-slate-500">{data.employee.employeeCode} · {data.employee.location}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Active Today</p>
              <p className="text-lg font-bold text-slate-800">{formatDurationLabel(data.dailyActivity?.activeSeconds ?? 0)}</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Idle Today</p>
              <p className="text-lg font-bold text-amber-600">{formatDurationLabel(data.dailyActivity?.idleSeconds ?? 0)}</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Keystrokes</p>
              <p className="text-lg font-bold text-slate-800">{p?.keyCount ?? 0}</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Productivity</p>
              <p className="text-lg font-bold text-[#ff791a]">{p?.score ?? data.dailyActivity?.productivityPercent ?? 0}%</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2">Devices</h4>
            <div className="space-y-2">
              {data.devices.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs border border-slate-100 rounded-lg px-3 py-2">
                  <span className="font-semibold">{d.deviceName}</span>
                  <span className="text-slate-400">{d.osVersion}</span>
                  <span className="capitalize">{d.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2">Apps Used Today</h4>
            {data.applicationUsage.length === 0 ? (
              <p className="text-xs text-slate-400">No application data yet.</p>
            ) : (
              <div className="space-y-1.5">
                {data.applicationUsage.slice(0, 15).map((a, i) => (
                  <div key={i} className="flex justify-between text-xs border-b border-slate-50 pb-1">
                    <span className="font-semibold text-slate-700">{formatApp(a.appName)}</span>
                    <span className="text-slate-400">{formatDurationLabel(a.durationSeconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2">Websites Today</h4>
            {data.websiteUsage.length === 0 ? (
              <p className="text-xs text-slate-400">No website data yet.</p>
            ) : (
              <div className="space-y-1.5">
                {data.websiteUsage.slice(0, 10).map((w, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-slate-700">{w.domain}</span>
                    <span className="text-slate-400">{formatDurationLabel(w.durationSeconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
