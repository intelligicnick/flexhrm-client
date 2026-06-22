/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  X,
  Eye,
  Loader2,
  FileText,
  ImageIcon,
} from "lucide-react";
import { EmployeeChangeRequest, PendingEmployeeDocument } from "../types";
import { compressionPercent, formatFileSize } from "../lib/image-compress";

interface EmployeeChangeRequestsPanelProps {
  requests: EmployeeChangeRequest[];
  isLoading?: boolean;
  canReview: boolean;
  onApprove: (requestId: string, reviewNotes: string) => Promise<void>;
  onReject: (requestId: string, reviewNotes: string) => Promise<void>;
  onRefresh: () => void;
  onClose?: () => void;
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

function base64ToBlobUrl(fileBase64: string, mimeType: string): string {
  const trimmed = fileBase64.trim();
  const normalized = trimmed.includes(",") ? trimmed.split(",").pop()!.trim() : trimmed;
  const binary = atob(normalized.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

async function fetchPendingDocumentPreview(
  requestId: string,
  index: number,
): Promise<PendingEmployeeDocument> {
  const res = await fetch(
    `/api/employees/change-requests/${encodeURIComponent(requestId)}/pending-documents/${index}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message =
      typeof err?.message === "string"
        ? err.message
        : Array.isArray(err?.message)
          ? err.message.join(", ")
          : "Failed to load document preview.";
    throw new Error(message);
  }
  return res.json();
}

async function fetchPendingPhotoPreview(
  requestId: string,
): Promise<{ photoBase64: string }> {
  const res = await fetch(
    `/api/employees/change-requests/${encodeURIComponent(requestId)}/pending-photo`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message =
      typeof err?.message === "string"
        ? err.message
        : Array.isArray(err?.message)
          ? err.message.join(", ")
          : "Failed to load photo preview.";
    throw new Error(message);
  }
  return res.json();
}

function PendingPhotoPreview({
  requestId,
}: {
  requestId: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = await fetchPendingPhotoPreview(requestId);
        if (cancelled || !data.photoBase64?.trim()) return;
        objectUrl = base64ToBlobUrl(data.photoBase64, "image/jpeg");
        setPreviewUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load photo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestId]);

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2 text-[11px] text-blue-900">
      <p className="font-semibold">Passport photo awaiting upload on approval</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-20 w-16 overflow-hidden rounded-md border border-blue-100 bg-white">
          {loading ? (
            <div className="flex h-full items-center justify-center text-blue-400">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="Pending passport photo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              <ImageIcon size={18} />
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-600">Passport Photo (ID Card)</p>
      </div>
      {error && <p className="mt-2 text-[10px] font-medium text-rose-600">{error}</p>}
    </div>
  );
}

function PendingDocumentPreviewModal({
  document,
  onClose,
}: {
  document: PendingEmployeeDocument;
  onClose: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isPdf = document.mimeType === "application/pdf";

  useEffect(() => {
    if (!document.fileBase64?.trim()) {
      setLoadError("Document file data is unavailable.");
      return;
    }

    let objectUrl: string | null = null;
    try {
      objectUrl = base64ToBlobUrl(document.fileBase64, document.mimeType);
      setPreviewUrl(objectUrl);
      setLoadError(null);
    } catch {
      setLoadError("Unable to render this document preview.");
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.fileBase64, document.mimeType]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{document.label}</h3>
            <p className="text-[11px] text-slate-500">
              {formatFileSize(document.storedSizeBytes || document.originalSizeBytes)}
              {document.quality != null && ` · ${compressionPercent(document.quality)}% quality`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {loadError ? (
            <div className="flex h-64 items-center justify-center text-sm text-rose-600">
              {loadError}
            </div>
          ) : !previewUrl ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              <Loader2 size={20} className="mr-2 animate-spin" />
              Loading preview...
            </div>
          ) : isPdf ? (
            <iframe
              src={previewUrl}
              title={document.label}
              className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <img
              src={previewUrl}
              alt={document.label}
              className="mx-auto max-h-[70vh] max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PendingDocumentsList({
  requestId,
  documents,
}: {
  requestId: string;
  documents: PendingEmployeeDocument[];
}) {
  const [previewDoc, setPreviewDoc] = useState<PendingEmployeeDocument | null>(null);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleView = async (index: number) => {
    setLoadingIndex(index);
    setPreviewError(null);
    try {
      const doc = await fetchPendingDocumentPreview(requestId, index);
      setPreviewDoc(doc);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to load document.");
    } finally {
      setLoadingIndex(null);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2 text-[11px] text-blue-900">
        <p className="font-semibold">
          {documents.length} document(s) awaiting upload on approval
        </p>
        <div className="mt-2 space-y-1.5">
          {documents.map((doc, index) => (
            <div
              key={`${doc.label}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md border border-blue-100 bg-white px-2.5 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText size={14} className="shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{doc.label}</p>
                  <p className="text-[10px] text-slate-500">
                    {formatFileSize(doc.storedSizeBytes || doc.originalSizeBytes)}
                    {doc.mimeType === "application/pdf" ? " · PDF" : " · Image"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleView(index)}
                disabled={loadingIndex === index}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
              >
                {loadingIndex === index ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Eye size={12} />
                )}
                View
              </button>
            </div>
          ))}
        </div>
        {previewError && (
          <p className="mt-2 text-[10px] font-medium text-rose-600">{previewError}</p>
        )}
      </div>

      {previewDoc && (
        <PendingDocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </>
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
  onClose,
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
            Review bulk employee edits and employee self-service submissions before they are published
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            Refresh
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
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
                  {req.source === "employee_self_service" && (
                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                      Employee self-service
                    </span>
                  )}
                  <span className="font-bold text-slate-900 text-sm">
                    {req.employeeCount} employee(s) · {req.fieldChangeCount} changes
                    {(req.pendingDocuments?.length ?? 0) > 0 &&
                      ` · ${req.pendingDocuments!.length} document(s)`}
                    {req.pendingPhoto?.hasPhoto && " · 1 photo"}
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
                    {(req.pendingDocuments?.length ?? 0) > 0 && (
                      <PendingDocumentsList
                        requestId={req.id}
                        documents={req.pendingDocuments!}
                      />
                    )}
                    {req.pendingPhoto?.hasPhoto && (
                      <PendingPhotoPreview requestId={req.id} />
                    )}
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
