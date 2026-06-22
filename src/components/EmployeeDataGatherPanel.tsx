import React, { useEffect, useState } from "react";
import {
  Clipboard,
  CheckCircle,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  createDataGatherLink,
  fetchActiveDataGatherLink,
  fetchDataGatherSummary,
  revokeDataGatherLink,
  type CreateDataGatherLinkResult,
  type DataGatherLink,
  type DataGatherSummary,
} from "../lib/employee-data-gather";
import { EMPLOYEE_FIELD_LABELS, PASSPORT_PHOTO_LABEL } from "../lib/employee-data-gather-fields";

interface EmployeeDataGatherPanelProps {
  employeeId: string;
  readOnly?: boolean;
}

function formatDateTime(iso?: string): string {
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

export default function EmployeeDataGatherPanel({
  employeeId,
  readOnly = false,
}: EmployeeDataGatherPanelProps) {
  const [summary, setSummary] = useState<DataGatherSummary | null>(null);
  const [activeLink, setActiveLink] = useState<DataGatherLink | null>(null);
  const [generated, setGenerated] = useState<CreateDataGatherLinkResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, linkData] = await Promise.all([
        fetchDataGatherSummary(employeeId),
        fetchActiveDataGatherLink(employeeId),
      ]);
      setSummary(summaryData);
      setActiveLink(linkData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data collection info.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [employeeId]);

  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerate = async () => {
    setWorking(true);
    setError(null);
    try {
      const result = await createDataGatherLink(employeeId);
      setGenerated(result);
      setActiveLink(result.link);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate link.");
    } finally {
      setWorking(false);
    }
  };

  const handleRevoke = async () => {
    const linkId = activeLink?.id ?? generated?.link.id;
    if (!linkId) return;
    if (!window.confirm("Revoke this data collection link? The employee will no longer be able to use it.")) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await revokeDataGatherLink(linkId);
      setGenerated(null);
      setActiveLink(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke link.");
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const displayLink = generated ?? (activeLink ? { link: activeLink, url: `${window.location.origin}/employee/update/${activeLink.token}`, otp: "" } : null);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Pending Collection Items
        </h3>
        {!summary ? (
          <p className="mt-2 text-sm text-slate-500">
            Could not load collection summary. Try refreshing, or restart the backend if you just deployed this feature.
          </p>
        ) : !summary.hasWork ? (
          <p className="mt-2 text-sm text-emerald-700">
            All tracked profile fields, standard documents, and ID photo are complete.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white bg-white p-3 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Blank Fields
              </p>
              <p className="mt-1 text-2xl font-extrabold text-slate-800">
                {summary.blankFields.length}
              </p>
              <ul className="mt-2 max-h-28 space-y-0.5 overflow-y-auto text-[11px] text-slate-600">
                {summary.blankFields.slice(0, 8).map((field) => (
                  <li key={field}>
                    {EMPLOYEE_FIELD_LABELS[field as keyof typeof EMPLOYEE_FIELD_LABELS] ?? field}
                  </li>
                ))}
                {summary.blankFields.length > 8 && (
                  <li className="text-slate-400">+{summary.blankFields.length - 8} more</li>
                )}
              </ul>
            </div>
            <div className="rounded-lg border border-white bg-white p-3 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Missing Documents
              </p>
              <p className="mt-1 text-2xl font-extrabold text-slate-800">
                {summary.missingDocuments.length}
              </p>
              <ul className="mt-2 space-y-0.5 text-[11px] text-slate-600">
                {summary.missingDocuments.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-white bg-white p-3 shadow-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                ID Card Photo
              </p>
              <p className="mt-1 text-2xl font-extrabold text-slate-800">
                {summary.missingPhoto ? 1 : 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-600">
                {summary.missingPhoto ? PASSPORT_PHOTO_LABEL : "Photo on file"}
              </p>
            </div>
          </div>
        )}
      </div>

      {!readOnly && summary?.hasWork && (
        <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Temporary Collection Link</h3>
              <p className="mt-1 max-w-xl text-xs text-slate-600">
                Generate a secure one-time link and password for the employee to fill only blank
                fields, upload missing documents, and add a passport photo for their ID card. The link
                expires after 2 days if unused, and becomes permanently inactive once the employee
                submits. Submitted data is posted after administrator approval.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={working}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw size={13} />
                Refresh
              </button>
              {!activeLink && (
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff791a] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#e56a12] disabled:opacity-60"
                >
                  {working ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                  Generate Link & OTP
                </button>
              )}
            </div>
          </div>

          {displayLink && (
            <div className="mt-4 space-y-3 rounded-xl border border-orange-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <CheckCircle size={14} />
                Active link — share with employee
              </div>

              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Collection URL
                </span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
                    {displayLink.url}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(displayLink.url, "url")}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    title="Copy link"
                  >
                    {copiedField === "url" ? <CheckCircle size={14} className="text-emerald-600" /> : <Clipboard size={14} />}
                  </button>
                  <a
                    href={displayLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    title="Open link"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              {generated?.otp && (
                <div>
                  <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <KeyRound size={10} />
                    One-Time Password (shown once)
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-lg font-mono font-bold tracking-[0.35em] text-amber-900">
                      {generated.otp}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(generated.otp, "otp")}
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    >
                      {copiedField === "otp" ? <CheckCircle size={14} className="text-emerald-600" /> : <Clipboard size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>Expires {formatDateTime(displayLink.link.expiresAt)}</span>
                <button
                  type="button"
                  onClick={() => void handleRevoke()}
                  disabled={working}
                  className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-60"
                >
                  <ShieldAlert size={12} />
                  Revoke Link
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {readOnly && summary?.hasWork && (
        <p className="text-xs text-slate-500">
          You can view pending blank fields and documents, but generating links requires edit access.
        </p>
      )}
    </div>
  );
}
