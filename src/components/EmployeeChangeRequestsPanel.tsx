/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
} from "lucide-react";
import { EmployeeChangeRequest } from "../types";

interface EmployeeChangeRequestsPanelProps {
  requests: EmployeeChangeRequest[];
  isLoading?: boolean;
  canReview: boolean;
  onApprove: (requestId: string, reviewNotes: string) => Promise<void>;
  onReject: (requestId: string, reviewNotes: string) => Promise<void>;
  onRefresh: () => void;
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

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <Clock size={10} /> Pending
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle size={10} /> Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
      <XCircle size={10} /> Rejected
    </span>
  );
}

function ChangeDetailRow({
  entry,
}: {
  entry: EmployeeChangeRequest["updates"][number];
}) {
  const [expanded, setExpanded] = useState(false);
  const changeKeys = Object.keys(entry.changes || {});

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 text-left cursor-pointer"
      >
        <div>
          <span className="font-semibold text-slate-800 text-xs">
            {entry.employeeName || entry.employeeCode}
          </span>
          <span className="text-slate-400 text-[10px] ml-2">({entry.employeeCode})</span>
          <span className="text-amber-700 text-[10px] font-medium ml-2">
            {changeKeys.length} field(s)
          </span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div className="px-3 py-2 bg-white text-[11px] space-y-1 max-h-48 overflow-y-auto">
          {changeKeys.map((key) => {
            const before = entry.previousSnapshot?.[key];
            const after = entry.changes?.[key];
            const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
            return (
              <div key={key} className="flex flex-col sm:flex-row sm:gap-2 py-0.5 border-b border-slate-50 last:border-0">
                <span className="font-medium text-slate-600 min-w-[120px]">{label}</span>
                <span className="text-rose-600 line-through truncate" title={String(before ?? "")}>
                  {before === undefined || before === null || before === "" ? "(empty)" : String(before)}
                </span>
                <span className="text-slate-400 hidden sm:inline">→</span>
                <span className="text-emerald-700 font-medium truncate" title={String(after ?? "")}>
                  {after === undefined || after === null || after === "" ? "(empty)" : String(after)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EmployeeChangeRequestsPanel({
  requests,
  isLoading = false,
  canReview,
  onApprove,
  onReject,
  onRefresh,
}: EmployeeChangeRequestsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending");

  const handleAction = async (
    requestId: string,
    action: "approve" | "reject",
  ) => {
    setActionLoading(requestId);
    try {
      const notes = reviewNotes[requestId] || "";
      if (action === "approve") {
        await onApprove(requestId, notes);
      } else {
        await onReject(requestId, notes);
      }
      setReviewNotes((prev) => ({ ...prev, [requestId]: "" }));
      setExpandedId(null);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-slate-400 text-sm">
        Loading pending change requests...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Pending Approvals</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Review bulk employee edits before they are published to the live registry
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <CheckCircle className="mx-auto mb-2 text-emerald-400" size={28} />
          <p className="text-sm font-medium text-slate-600">No pending change requests</p>
          <p className="text-xs text-slate-400 mt-1">
            Bulk edits submitted by HR will appear here for approval
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((req) => (
            <div
              key={req.id}
              className="border border-amber-200 bg-amber-50/30 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50/60 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge status={req.status} />
                  <span className="font-bold text-slate-900 text-sm">
                    {req.employeeCount} employee(s) · {req.fieldChangeCount} changes
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <User size={12} /> {req.submittedBy}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar size={12} /> {formatDate(req.createdAt)}
                  </span>
                </div>
                {expandedId === req.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {expandedId === req.id && (
                <div className="px-4 pb-4 border-t border-amber-200/60 bg-white">
                  {req.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mt-3 mb-3">
                      <strong>Submitter notes:</strong> {req.notes}
                    </p>
                  )}
                  <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    {(req.updates || []).map((entry) => (
                      <ChangeDetailRow key={entry.employeeId} entry={entry} />
                    ))}
                  </div>
                  {canReview && (
                    <div className="border-t border-slate-100 pt-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Review notes (optional)
                      </label>
                      <textarea
                        value={reviewNotes[req.id] || ""}
                        onChange={(e) =>
                          setReviewNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        rows={2}
                        placeholder="Add a note for the submitter..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 mb-3"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(req.id, "approve")}
                          disabled={actionLoading === req.id}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          {actionLoading === req.id ? "Publishing..." : "Approve & Publish"}
                        </button>
                        <button
                          onClick={() => handleAction(req.id, "reject")}
                          disabled={actionLoading === req.id}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h4 className="font-semibold text-slate-700 text-xs mb-2 uppercase tracking-wide">
            Recent History
          </h4>
          <div className="space-y-2">
            {history.slice(0, 10).map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={req.status} />
                  <span className="text-slate-700">
                    {req.employeeCount} employee(s) by {req.submittedBy}
                  </span>
                  {req.reviewedBy && (
                    <span className="text-slate-400">
                      → {req.status} by {req.reviewedBy}
                    </span>
                  )}
                </div>
                <span className="text-slate-400">{formatDate(req.reviewedAt || req.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
