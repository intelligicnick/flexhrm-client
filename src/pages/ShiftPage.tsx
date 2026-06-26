import React, { useCallback, useEffect, useState } from "react";
import { Clock, Plus } from "lucide-react";
import { apiUrl, parseApiError } from "../api";

interface ShiftTemplate {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  isNightShift: boolean;
}

export default function ShiftPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthKey, setMonthKey] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/shifts/templates"), { credentials: "include" });
      if (!res.ok) throw await parseApiError(res, "Failed to load shifts");
      setTemplates(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 rounded-full border-2 border-[#ff791a] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock size={20} className="text-[#ff791a]" /> Shift Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">Define shift templates and plan rosters</p>
        </div>
        <input
          type="month"
          value={monthKey}
          onChange={(e) => setMonthKey(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {templates.map((t) => (
          <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">{t.code}</span>
              {t.isNightShift && (
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Night</span>
              )}
            </div>
            <div className="text-sm font-bold text-slate-800 mt-1">{t.name}</div>
            <div className="text-xs text-slate-500 mt-2">{t.startTime} – {t.endTime}</div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full text-center py-8 text-slate-400 text-sm">
            No shift templates yet. Default templates are created on first load.
          </div>
        )}
      </div>
    </div>
  );
}
