import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Users,
  Phone,
  School,
  MapPin,
  ShieldCheck,
  ExternalLink,
  Edit,
  LayoutGrid,
  LogIn,
  Smartphone,
  Globe,
  Briefcase,
  Clock,
  Loader2,
} from "lucide-react";
import { apiUrl } from "../api";
import { formatDurationMinutes, formatRelativeTimeAgo } from "../lib/date-helpers";
import { getSchoolsForSupervisor } from "../lib/school-work-helpers";
import { loginAsSupervisor } from "../lib/supervisor-login";
import { getSupervisorLoginUrl } from "./id-card/verify-url";
import { SchoolSupervisor, SchoolWork, SupervisorActivityHistory } from "../types";

interface SchoolSupervisorViewModalProps {
  supervisor: SchoolSupervisor;
  schools?: SchoolWork[];
  onClose: () => void;
  onEditClick?: (supervisor: SchoolSupervisor) => void;
  readOnly?: boolean;
}

export default function SchoolSupervisorViewModal({
  supervisor,
  schools = [],
  onClose,
  onEditClick,
  readOnly = false,
}: SchoolSupervisorViewModalProps) {
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activityHistory, setActivityHistory] = useState<SupervisorActivityHistory | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const coveredSchools = useMemo(
    () => getSchoolsForSupervisor(supervisor, schools),
    [supervisor, schools],
  );
  const supervisorLoginUrl = getSupervisorLoginUrl();

  const handleLoginAsSupervisor = async () => {
    setLoggingIn(true);
    setLoginError(null);
    try {
      await loginAsSupervisor(supervisor.id);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Could not open supervisor portal.");
    } finally {
      setLoggingIn(false);
    }
  };

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadActivityHistory = async () => {
      setActivityLoading(true);
      setActivityError(null);
      try {
        const res = await fetch(apiUrl(`/api/school-supervisors/${supervisor.id}/activity-history`));
        if (!res.ok) throw new Error("Could not load activity history.");
        const data = (await res.json()) as SupervisorActivityHistory;
        if (!cancelled) setActivityHistory(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setActivityHistory(null);
          setActivityError(err instanceof Error ? err.message : "Could not load activity history.");
        }
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    };
    void loadActivityHistory();
    return () => {
      cancelled = true;
    };
  }, [supervisor.id]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const renderField = (label: string, value: string | number | undefined, highlight = false) => {
    const displayValue = value !== undefined && value !== null && value !== "" ? String(value) : "—";
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className={`text-xs ${highlight ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
          {displayValue}
        </span>
      </div>
    );
  };

  const formatDeviceDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const formatActivityTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const formatActivityDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const overviewFacts = [
    {
      label: "Assigned Blocks",
      value: (supervisor.assignedBlocks || []).length
        ? supervisor.assignedBlocks.join(", ")
        : "No blocks assigned",
      icon: <MapPin size={14} className="text-blue-600" />,
    },
    {
      label: "Schools Covered",
      value: `${coveredSchools.length} school${coveredSchools.length === 1 ? "" : "s"}`,
      icon: <School size={14} className="text-[#ff791a]" />,
    },
    {
      label: "Mobile Login",
      value: supervisor.loginEnabled ? "Enabled" : "Disabled",
      icon: <ShieldCheck size={14} className="text-emerald-600" />,
    },
    {
      label: "Status",
      value: supervisor.status || "active",
      icon: <Users size={14} className="text-violet-600" />,
    },
    {
      label: "Preferred Language",
      value: supervisor.defaultLanguage === "hi" ? "Hindi" : supervisor.defaultLanguage === "en" ? "English" : "—",
      icon: <Globe size={14} className="text-indigo-600" />,
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in" id="school-supervisor-view-modal">
      <div
        onClick={handleBackdropClick}
        className="absolute inset-0 cursor-pointer bg-slate-950/50 backdrop-blur-sm"
        aria-hidden
      />
      <div className="relative flex h-full items-center justify-center p-3 sm:p-4 pointer-events-none">
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex h-full max-h-[92vh] w-full max-w-3xl min-h-0 cursor-default flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#0C1E4A] via-slate-900 to-slate-800 px-5 pb-4 pt-5 text-white sm:px-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,121,26,0.18),transparent_55%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#ff791a] text-lg font-black tracking-wide text-white shadow-lg sm:h-20 sm:w-20 overflow-hidden">
                  {supervisor.profilePhotoBase64 ? (
                    <img
                      src={supervisor.profilePhotoBase64}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Users size={28} />
                  )}
                </div>
                <div className="min-w-0 text-left">
                  <h2 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
                    {supervisor.name || "Supervisor"}
                  </h2>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-slate-300">
                    <Phone size={14} />
                    {supervisor.phone || "No phone"}
                  </p>
                  {supervisor.designation && (
                    <p className="mt-0.5 text-xs text-orange-200 font-semibold">{supervisor.designation}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${
                        supervisor.loginEnabled
                          ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-200"
                          : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      Login {supervisor.loginEnabled ? "Enabled" : "Disabled"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold capitalize text-slate-200">
                      {supervisor.status || "active"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white shrink-0"
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Blocks</p>
                <p className="text-sm font-extrabold text-sky-300">{supervisor.assignedBlocks?.length || 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Schools</p>
                <p className="text-sm font-extrabold text-emerald-300">{coveredSchools.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Login Phone</p>
                <p className="truncate text-sm font-bold text-white">{supervisor.loginPhone || supervisor.phone || "—"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Portal</p>
                <a
                  href={supervisorLoginUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-200 hover:underline"
                >
                  Open login
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/60 p-4 sm:p-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
                <LayoutGrid size={14} className="text-[#ff791a]" />
                Overview
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {overviewFacts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-xs"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50">{fact.icon}</div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{fact.label}</p>
                      <p className="text-sm font-bold text-slate-800">{fact.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {renderField("Name", supervisor.name, true)}
                {renderField("Phone", supervisor.phone, true)}
                {renderField("Login Phone", supervisor.loginPhone || supervisor.phone)}
                {renderField("Email", supervisor.email)}
                {renderField("Alternate Phone", supervisor.alternatePhone)}
                {renderField("Designation", supervisor.designation)}
                {renderField("Status", supervisor.status || "active")}
                {renderField(
                  "Preferred Language",
                  supervisor.defaultLanguage === "hi"
                    ? "Hindi"
                    : supervisor.defaultLanguage === "en"
                      ? "English"
                      : undefined,
                )}
              </div>

              {supervisor.bio && (
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <Briefcase size={11} />
                    About
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">{supervisor.bio}</p>
                </div>
              )}

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <Smartphone size={11} />
                  Registered Device
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {renderField("Device Name", supervisor.registeredDeviceName)}
                  {renderField("Device ID", supervisor.registeredDeviceId)}
                  {renderField("Registered On", formatDeviceDate(supervisor.deviceRegisteredAt))}
                  {renderField(
                    "Device Status",
                    supervisor.hasRegisteredDevice ? "Registered" : "Not registered",
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <Clock size={11} />
                  Active Time History
                </p>

                {activityLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                    <Loader2 size={14} className="animate-spin" />
                    Loading activity history...
                  </div>
                ) : activityError ? (
                  <p className="text-xs text-rose-600 font-semibold">{activityError}</p>
                ) : activityHistory && activityHistory.sessions.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                          Today
                        </p>
                        <p className="text-sm font-extrabold text-emerald-800">
                          {formatDurationMinutes(activityHistory.summary.todayMinutes)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                          Last 7 days
                        </p>
                        <p className="text-sm font-extrabold text-blue-800">
                          {formatDurationMinutes(activityHistory.summary.last7DaysMinutes)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 col-span-2 sm:col-span-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Sessions logged
                        </p>
                        <p className="text-sm font-extrabold text-slate-800">
                          {activityHistory.summary.sessionCount}
                        </p>
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 border-t border-slate-100 pt-3">
                      {activityHistory.sessions.map((session) => (
                        <div
                          key={session.id}
                          className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800">
                                {formatActivityDate(session.startedAt)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-600">
                                {formatActivityTime(session.startedAt)}
                                {" – "}
                                {session.isOngoing
                                  ? "Ongoing"
                                  : session.endedAt
                                    ? formatActivityTime(session.endedAt)
                                    : formatActivityTime(session.lastActiveAt)}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              {session.isOngoing ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Online · {formatRelativeTimeAgo(session.lastActiveAt)}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500">
                                  {formatDurationMinutes(session.durationMinutes)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    No app activity recorded yet. History appears when the supervisor logs in and uses the mobile portal.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned Blocks</p>
                {(supervisor.assignedBlocks || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {supervisor.assignedBlocks.map((block) => (
                      <span
                        key={block}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700"
                      >
                        <MapPin size={11} />
                        {block}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No blocks assigned yet.</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Schools Covered ({coveredSchools.length})
                </p>
                {coveredSchools.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto space-y-1.5">
                    {coveredSchools.map((school) => (
                      <div
                        key={school.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-800">{school.schoolName || "—"}</p>
                          <p className="text-[10px] text-slate-500">
                            {school.block || "No block"} · {school.district || "No district"}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-slate-400">{school.udise || "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No schools covered by this supervisor&apos;s blocks.</p>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0">
              {loginError && (
                <p className="text-[11px] font-semibold text-rose-600 truncate">{loginError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
            >
              Close
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={handleLoginAsSupervisor}
                disabled={loggingIn}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold text-[#ff791a] transition hover:bg-orange-100 disabled:opacity-50"
              >
                <LogIn size={14} />
                {loggingIn ? "Opening..." : "Login as Supervisor"}
              </button>
            )}
            {!readOnly && onEditClick && (
              <button
                type="button"
                onClick={() => onEditClick(supervisor)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#ff791a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#e4640c]"
              >
                <Edit size={14} />
                Edit Supervisor
              </button>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
