import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Edit2, ExternalLink, Eye, LogIn, Phone, Plus, School, ShieldCheck, Trash2, Users } from "lucide-react";
import { getSupervisorLoginUrl } from "./id-card/verify-url";
import { loginAsSupervisor } from "../lib/supervisor-login";
import { apiUrl, parseApiError } from "../api";
import SchoolSupervisorViewModal from "./SchoolSupervisorViewModal";
import {
  countSchoolsWithoutSupervisorCoverage,
  getSchoolsForSupervisor,
} from "../lib/school-work-helpers";
import { formatRelativeTimeAgo } from "../lib/date-helpers";
import { SchoolSupervisor, SchoolWork } from "../types";

interface SchoolSupervisorsTableProps {
  supervisors: SchoolSupervisor[];
  schools: SchoolWork[];
  onAdd: () => void;
  onEdit: (supervisor: SchoolSupervisor) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

export default function SchoolSupervisorsTable({
  supervisors,
  schools,
  onAdd,
  onEdit,
  onDelete,
  readOnly = false,
}: SchoolSupervisorsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewSupervisor, setViewSupervisor] = useState<SchoolSupervisor | null>(null);
  const [copiedLoginUrl, setCopiedLoginUrl] = useState(false);
  const [loggingInAsId, setLoggingInAsId] = useState<string | null>(null);
  const [loginAsError, setLoginAsError] = useState<string | null>(null);
  const [deviceOtpFor, setDeviceOtpFor] = useState<string | null>(null);
  const [deviceOtpResult, setDeviceOtpResult] = useState<{ name: string; otp: string; expiresAt: string } | null>(null);
  const [generatingOtp, setGeneratingOtp] = useState(false);
  const supervisorLoginUrl = getSupervisorLoginUrl();

  const handleGenerateDeviceOtp = async (supervisor: SchoolSupervisor) => {
    setGeneratingOtp(true);
    setDeviceOtpFor(supervisor.id);
    setDeviceOtpResult(null);
    try {
      const res = await fetch(apiUrl(`/api/school-supervisors/${supervisor.id}/generate-device-otp`), {
        method: "POST",
      });
      if (!res.ok) throw await parseApiError(res, "Could not generate OTP.");
      const data = await res.json();
      setDeviceOtpResult({
        name: supervisor.name,
        otp: data.otp,
        expiresAt: data.expiresAt,
      });
    } catch (err: unknown) {
      setLoginAsError(err instanceof Error ? err.message : "Could not generate device OTP.");
    } finally {
      setGeneratingOtp(false);
      setDeviceOtpFor(null);
    }
  };

  const handleLoginAsSupervisor = async (supervisor: SchoolSupervisor) => {
    setLoggingInAsId(supervisor.id);
    setLoginAsError(null);
    try {
      await loginAsSupervisor(supervisor.id);
    } catch (err: unknown) {
      setLoginAsError(err instanceof Error ? err.message : "Could not open supervisor portal.");
    } finally {
      setLoggingInAsId(null);
    }
  };

  const copyLoginUrl = async () => {
    try {
      await navigator.clipboard.writeText(supervisorLoginUrl);
      setCopiedLoginUrl(true);
      window.setTimeout(() => setCopiedLoginUrl(false), 2000);
    } catch {
      window.prompt("Copy this supervisor login URL:", supervisorLoginUrl);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return supervisors;
    const q = searchTerm.toLowerCase();
    return supervisors.filter(
      (supervisor) =>
        supervisor.name?.toLowerCase().includes(q) ||
        supervisor.phone?.toLowerCase().includes(q),
    );
  }, [supervisors, searchTerm]);

  const uncoveredSchoolCount = useMemo(
    () => countSchoolsWithoutSupervisorCoverage(schools, supervisors),
    [schools, supervisors],
  );

  const [, setActivityTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setActivityTick((tick) => tick + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const renderSupervisorActivity = (supervisor: SchoolSupervisor) => {
    if (supervisor.isOnline && supervisor.lastActiveAt) {
      return (
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-1"
          title={new Date(supervisor.lastActiveAt).toLocaleString("en-IN")}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          Online · {formatRelativeTimeAgo(supervisor.lastActiveAt)}
        </span>
      );
    }
    if (supervisor.lastActiveAt) {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-1"
          title={new Date(supervisor.lastActiveAt).toLocaleString("en-IN")}
        >
          Last active {formatRelativeTimeAgo(supervisor.lastActiveAt)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-2 py-1">
        <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
        Offline
      </span>
    );
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="mb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <Users className="text-[#ff791a]" size={18} />
            Supervisors
          </h2>
          <p className="text-xs text-slate-400">
            Assign supervisors to blocks — they automatically cover all schools in those blocks
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {uncoveredSchoolCount > 0 && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
              {uncoveredSchoolCount} school{uncoveredSchoolCount === 1 ? "" : "s"} in blocks without a supervisor
            </span>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              <Plus size={14} />
              Add Supervisor
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-orange-100 bg-orange-50/70 px-3 py-2.5">
        <p className="text-[11px] font-bold text-slate-700">Supervisor mobile login URL</p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Share this link with supervisors to open on their phone browser.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a
            href={supervisorLoginUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#ff791a] hover:underline break-all"
          >
            {supervisorLoginUrl}
            <ExternalLink size={12} />
          </a>
          <button
            type="button"
            onClick={copyLoginUrl}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-orange-200 bg-white text-[11px] font-bold text-slate-600 cursor-pointer"
          >
            {copiedLoginUrl ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            {copiedLoginUrl ? "Copied" : "Copy URL"}
          </button>
        </div>
      </div>

      {loginAsError && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs font-semibold">
          {loginAsError}
        </div>
      )}

      {deviceOtpResult && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-xs font-bold text-emerald-800">
            Device change OTP for {deviceOtpResult.name}
          </p>
          <p className="text-2xl font-black tracking-widest text-emerald-900 my-2 font-mono">
            {deviceOtpResult.otp}
          </p>
          <p className="text-[10px] text-emerald-700">
            Share this with the supervisor. Expires {new Date(deviceOtpResult.expiresAt).toLocaleString("en-IN")}.
          </p>
          <button
            type="button"
            onClick={() => setDeviceOtpResult(null)}
            className="mt-2 text-[10px] font-bold text-emerald-700 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <input
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search supervisor..."
        className="w-full mb-4 px-3 py-2 border border-slate-200 rounded-lg text-xs"
      />

      {filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-10 text-sm">
          No school supervisors yet. Add supervisors here and assign them to blocks.
        </p>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs min-w-[860px]">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-bold">Name</th>
                <th className="text-left px-3 py-2 font-bold">Activity</th>
                <th className="text-left px-3 py-2 font-bold">Phone</th>
                <th className="text-left px-3 py-2 font-bold">Assigned Blocks</th>
                <th className="text-left px-3 py-2 font-bold">Schools Covered</th>
                <th className="text-left px-3 py-2 font-bold">Login</th>
                <th className="text-right px-3 py-2 font-bold">{readOnly ? "View" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((supervisor) => {
                const coveredSchools = getSchoolsForSupervisor(supervisor, schools);
                return (
                  <tr key={supervisor.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-800">{supervisor.name || "—"}</td>
                    <td className="px-3 py-2">{renderSupervisorActivity(supervisor)}</td>
                    <td className="px-3 py-2 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Phone size={12} />
                        {supervisor.phone || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {(supervisor.assignedBlocks || []).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 font-bold text-[#ff791a]">
                        <School size={12} />
                        {coveredSchools.length}
                      </span>
                      {coveredSchools.length > 0 && (
                        <span className="block text-[10px] text-slate-400 mt-0.5 truncate max-w-[220px]">
                          {coveredSchools.slice(0, 2).map((school) => school.schoolName).join(", ")}
                          {coveredSchools.length > 2 ? "…" : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        supervisor.loginEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {supervisor.loginEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => setViewSupervisor(supervisor)}
                          className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600 cursor-pointer"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleLoginAsSupervisor(supervisor)}
                            disabled={loggingInAsId === supervisor.id}
                            className="p-1.5 rounded hover:bg-orange-50 text-slate-500 hover:text-[#ff791a] cursor-pointer disabled:opacity-50"
                            title="Login as Supervisor"
                          >
                            <LogIn size={14} />
                          </button>
                        )}
                        {!readOnly && supervisor.loginEnabled && (
                          <button
                            type="button"
                            onClick={() => handleGenerateDeviceOtp(supervisor)}
                            disabled={generatingOtp && deviceOtpFor === supervisor.id}
                            className="p-1.5 rounded hover:bg-violet-50 text-slate-500 hover:text-violet-600 cursor-pointer disabled:opacity-50"
                            title="Generate Device Change OTP"
                          >
                            <ShieldCheck size={14} />
                          </button>
                        )}
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEdit(supervisor)}
                              className="p-1.5 rounded hover:bg-orange-50 text-slate-500 cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(supervisor.id)}
                              className="p-1.5 rounded hover:bg-rose-50 text-rose-500 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewSupervisor && (
        <SchoolSupervisorViewModal
          supervisor={viewSupervisor}
          schools={schools}
          onClose={() => setViewSupervisor(null)}
          onEditClick={(supervisor) => {
            setViewSupervisor(null);
            onEdit(supervisor);
          }}
          readOnly={readOnly}
        />
      )}
    </section>
  );
}
