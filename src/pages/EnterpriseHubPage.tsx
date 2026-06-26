import { useEffect, useState } from "react";
import { apiUrl } from "../api";

type Tab = "assets" | "crm" | "recruitment" | "helpdesk" | "payroll" | "automation" | "ai";

export default function EnterpriseHubPage() {
  const [tab, setTab] = useState<Tab>("assets");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [aiReply, setAiReply] = useState("");
  const [aiMessage, setAiMessage] = useState("");

  const endpoints: Record<Tab, string> = {
    assets: "/api/assets",
    crm: "/api/crm/leads",
    recruitment: "/api/recruitment/jobs",
    helpdesk: "/api/helpdesk/tickets",
    payroll: "/api/payroll-runs",
    automation: "/api/automation/workflows",
    ai: "/api/ai-assistant/chat",
  };

  useEffect(() => {
    if (tab === "ai") return;
    fetch(apiUrl(endpoints[tab]), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]));
  }, [tab]);

  const askAi = async () => {
    const res = await fetch(apiUrl("/api/ai-assistant/chat"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: aiMessage }),
    });
    const data = await res.json();
    setAiReply(String(data.reply ?? ""));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Enterprise Modules</h1>
      <p className="text-sm text-slate-500 mb-6">
        Assets, CRM, Recruitment, Helpdesk, Payroll Runs, Automation, and AI Assistant.
      </p>
      <div className="flex flex-wrap gap-2 mb-6">
        {(["assets", "crm", "recruitment", "helpdesk", "payroll", "automation", "ai"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              tab === t ? "bg-[var(--color-primary,#ff791a)] text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "ai" ? (
        <div className="space-y-4">
          <textarea
            className="w-full border rounded-lg p-3 text-sm"
            rows={3}
            placeholder="Ask HR questions, policy help, payroll insights..."
            value={aiMessage}
            onChange={(e) => setAiMessage(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void askAi()}
            className="px-4 py-2 rounded-lg bg-[var(--color-primary,#ff791a)] text-white text-sm"
          >
            Ask AI Assistant
          </button>
          {aiReply && (
            <div className="bg-slate-50 border rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {aiReply}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No records yet. Create via API or admin tools.</p>
          ) : (
            <ul className="divide-y">
              {items.map((item, i) => (
                <li key={i} className="p-4 text-sm text-slate-700">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
