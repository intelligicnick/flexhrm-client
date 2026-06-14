import React, { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle, MessageSquare, XCircle } from "lucide-react";
import { SupervisorRequest } from "../types";

interface SupervisorRequestsPanelProps {
  requests: SupervisorRequest[];
  onRespond: (id: string, adminResponse: string, status: "responded" | "closed") => Promise<boolean>;
  onClose: (id: string, note?: string) => Promise<boolean>;
  onResolveEscalation?: (
    id: string,
    resolution: string,
    status: "responded" | "closed",
  ) => Promise<boolean>;
  readOnly?: boolean;
  isSuperAdmin?: boolean;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function photoSrc(photo: { photoDataBase64: string; mimeType: string }) {
  return photo.photoDataBase64.startsWith("data:")
    ? photo.photoDataBase64
    : `data:${photo.mimeType};base64,${photo.photoDataBase64}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
        Pending
      </span>
    );
  }
  if (status === "responded") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle size={10} /> Responded
      </span>
    );
  }
  if (status === "escalated") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
        <AlertTriangle size={10} /> Escalated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
      <XCircle size={10} /> Closed
    </span>
  );
}

export default function SupervisorRequestsPanel({
  requests,
  onRespond,
  onClose,
  onResolveEscalation,
  readOnly = false,
  isSuperAdmin = false,
}: SupervisorRequestsPanelProps) {
  const [blockFilter, setBlockFilter] = useState("");
  const [supervisorFilter, setSupervisorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const blocks = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => r.schools?.forEach((s) => s.block && set.add(s.block)));
    return Array.from(set).sort();
  }, [requests]);

  const supervisorOptions = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach((r) => {
      if (r.supervisorId) map.set(r.supervisorId, r.supervisorName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);

  const filtered = useMemo(() => {
    let rows = [...requests];
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (blockFilter) {
      rows = rows.filter((r) => r.schools?.some((s) => s.block === blockFilter));
    }
    if (supervisorFilter) rows = rows.filter((r) => r.supervisorId === supervisorFilter);
    return rows.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  }, [requests, blockFilter, supervisorFilter, statusFilter]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const escalatedCount = requests.filter((r) => r.status === "escalated").length;

  const handleRespond = async (id: string, close = false) => {
    const text = (responseText[id] || "").trim();
    if (!text) {
      alert("Please enter a response message.");
      return;
    }
    setSubmittingId(id);
    const ok = await onRespond(id, text, close ? "closed" : "responded");
    setSubmittingId(null);
    if (ok) {
      setResponseText((prev) => ({ ...prev, [id]: "" }));
      setExpandedId(null);
    }
  };

  const handleClose = async (id: string) => {
    const note = (responseText[id] || "").trim();
    if (!window.confirm("Close this request?")) return;
    setSubmittingId(id);
    const ok = await onClose(id, note || undefined);
    setSubmittingId(null);
    if (ok) {
      setResponseText((prev) => ({ ...prev, [id]: "" }));
      setExpandedId(null);
    }
  };

  const handleResolveEscalation = async (id: string, close = false) => {
    if (!onResolveEscalation) return;
    const text = (responseText[id] || "").trim();
    if (!text) {
      alert("Please enter a resolution message.");
      return;
    }
    setSubmittingId(id);
    const ok = await onResolveEscalation(id, text, close ? "closed" : "responded");
    setSubmittingId(null);
    if (ok) {
      setResponseText((prev) => ({ ...prev, [id]: "" }));
      setExpandedId(null);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <MessageSquare className="text-[#ff791a]" size={18} />
            Supervisor Requests
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                <Bell size={10} /> {pendingCount} pending
              </span>
            )}
            {isSuperAdmin && escalatedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                <AlertTriangle size={10} /> {escalatedCount} escalated
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            Messages and photos from supervisors — respond to notify them
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs cursor-pointer"
          >
            <option value="">All Blocks</option>
            {blocks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            value={supervisorFilter}
            onChange={(e) => setSupervisorFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs cursor-pointer"
          >
            <option value="">All Supervisors</option>
            {supervisorOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="responded">Responded</option>
            <option value="closed">Closed</option>
            <option value="escalated">Escalated</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-10 text-sm">No supervisor requests yet.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <div key={req.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2 cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-800 text-sm">{req.supervisorName}</span>
                  <span className="text-xs text-slate-400 ml-2">{formatDate(req.createdAt)}</span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    {req.schools?.length
                      ? req.schools.map((s) => s.schoolName).join(", ")
                      : "General request"}
                  </span>
                </div>
                <StatusBadge status={req.status} />
              </button>
              {expandedId === req.id && (
                <div className="p-3 space-y-3 text-xs">
                  {req.schools?.length > 0 && (
                    <div className="space-y-1">
                      {req.schools.map((s) => (
                        <p key={s.id} className="text-slate-600">
                          <span className="font-semibold text-slate-800">{s.schoolName}</span>
                          <span className="text-slate-400"> · {s.block} · UDISE {s.udise}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="font-bold text-slate-500 block mb-1">Message</span>
                    <p className="text-slate-700 whitespace-pre-wrap">{req.message}</p>
                  </div>
                  {req.photos?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {req.photos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photoSrc(photo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={photoSrc(photo)}
                            alt={photo.caption || "Request photo"}
                            className="w-28 h-28 object-cover rounded border border-slate-200"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  {req.followUps?.map((followUp) => (
                    <div key={followUp.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <span className="font-bold text-orange-700 block mb-1">
                        Supervisor follow-up
                      </span>
                      <p className="text-orange-900 whitespace-pre-wrap">{followUp.message}</p>
                      <p className="text-orange-600 text-[10px] mt-1">{formatDate(followUp.createdAt)}</p>
                      {followUp.photos?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {followUp.photos.map((photo) => (
                            <a
                              key={photo.id}
                              href={photoSrc(photo)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img
                                src={photoSrc(photo)}
                                alt={photo.caption || "Follow-up photo"}
                                className="w-28 h-28 object-cover rounded border border-orange-200"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {req.escalationMessage && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                      <span className="font-bold text-rose-700 block mb-1">
                        Escalation reason
                      </span>
                      <p className="text-rose-900 whitespace-pre-wrap">{req.escalationMessage}</p>
                      <p className="text-rose-600 text-[10px] mt-1">{formatDate(req.escalatedAt)}</p>
                    </div>
                  )}
                  {req.escalationResolution && (
                    <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                      <span className="font-bold text-violet-700 block mb-1">
                        Super admin resolution ({req.escalationResolvedBy})
                      </span>
                      <p className="text-violet-900 whitespace-pre-wrap">{req.escalationResolution}</p>
                      <p className="text-violet-600 text-[10px] mt-1">{formatDate(req.escalationResolvedAt)}</p>
                    </div>
                  )}
                  {req.adminResponse && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <span className="font-bold text-emerald-700 block mb-1">
                        Your response ({req.respondedBy})
                      </span>
                      <p className="text-emerald-900 whitespace-pre-wrap">{req.adminResponse}</p>
                      <p className="text-emerald-600 text-[10px] mt-1">{formatDate(req.respondedAt)}</p>
                      {req.status === "responded" && !req.supervisorReadAt && (
                        <p className="text-amber-700 text-[10px] mt-2 font-semibold">
                          Auto-closes if the supervisor does not acknowledge within 2 days.
                        </p>
                      )}
                    </div>
                  )}
                  {!readOnly && req.status !== "closed" && req.status !== "escalated" && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <textarea
                        value={
                          responseText[req.id] !== undefined
                            ? responseText[req.id]
                            : req.adminResponse || ""
                        }
                        onChange={(e) =>
                          setResponseText((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        rows={3}
                        placeholder={
                          req.status === "responded"
                            ? "Update your response to the supervisor..."
                            : "Type your response to the supervisor..."
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={submittingId === req.id}
                          onClick={() => handleRespond(req.id, false)}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60"
                        >
                          {req.status === "responded" ? "Send Updated Response" : "Send Response"}
                        </button>
                        <button
                          type="button"
                          disabled={submittingId === req.id}
                          onClick={() => handleRespond(req.id, true)}
                          className="px-3 py-1.5 bg-slate-600 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60"
                        >
                          Respond & Close
                        </button>
                        <button
                          type="button"
                          disabled={submittingId === req.id}
                          onClick={() => handleClose(req.id)}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                  {!readOnly && req.status === "escalated" && isSuperAdmin && onResolveEscalation && (
                    <div className="space-y-2 pt-2 border-t border-rose-100">
                      <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">
                        Super admin resolution
                      </p>
                      <textarea
                        value={responseText[req.id] || ""}
                        onChange={(e) =>
                          setResponseText((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        rows={3}
                        placeholder="Enter your resolution for this escalated request..."
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg text-xs resize-none"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={submittingId === req.id}
                          onClick={() => handleResolveEscalation(req.id, false)}
                          className="px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60"
                        >
                          Send Resolution
                        </button>
                        <button
                          type="button"
                          disabled={submittingId === req.id}
                          onClick={() => handleResolveEscalation(req.id, true)}
                          className="px-3 py-1.5 bg-slate-600 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60"
                        >
                          Resolve & Close
                        </button>
                      </div>
                    </div>
                  )}
                  {!readOnly && req.status === "escalated" && !isSuperAdmin && (
                    <p className="text-[10px] text-rose-600 font-semibold pt-2 border-t border-rose-100">
                      This request is awaiting super admin review.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
