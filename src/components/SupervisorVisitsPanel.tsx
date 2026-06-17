import React, { useMemo, useState } from "react";
import { Camera, Check, Search, X, MapPin } from "lucide-react";
import {
  resolveHistoryFilterBounds,
  toIsoDate,
  visitMatchesFilter,
  type SupervisorHistoryFilter,
} from "../lib/supervisor-dates";
import { SchoolVisit } from "../types";
import { DateInput } from "./ui/DateInput";

interface SupervisorVisitsPanelProps {
  visits: SchoolVisit[];
  onUpdateStatus: (id: string, status: "approved" | "rejected") => Promise<boolean>;
  readOnly?: boolean;
}

type DatePreset = "all" | "day" | "week" | "month" | "range";

function buildDateFilter(preset: DatePreset, fromDate: string, toDate: string): SupervisorHistoryFilter | null {
  const today = toIsoDate(new Date());
  if (preset === "all") return null;
  if (preset === "range") {
    if (!fromDate && !toDate) return null;
    return {
      mode: "dateRange",
      customDate: today,
      fromDate: fromDate || toDate,
      toDate: toDate || fromDate,
      monthKey: today.slice(0, 7),
    };
  }
  return {
    mode: preset,
    customDate: today,
    fromDate: today,
    toDate: today,
    monthKey: today.slice(0, 7),
  };
}

export default function SupervisorVisitsPanel({
  visits,
  onUpdateStatus,
  readOnly = false,
}: SupervisorVisitsPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [supervisorFilter, setSupervisorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [visitTypeFilter, setVisitTypeFilter] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const blocks = useMemo(
    () => Array.from(new Set(visits.map((v) => v.block).filter(Boolean))).sort(),
    [visits],
  );

  const supervisors = useMemo(
    () => Array.from(new Set(visits.map((v) => v.supervisorName).filter(Boolean))).sort(),
    [visits],
  );

  const submittedCount = useMemo(
    () => visits.filter((v) => v.status === "submitted").length,
    [visits],
  );

  const dateFilter = useMemo(
    () => buildDateFilter(datePreset, fromDate, toDate),
    [datePreset, fromDate, toDate],
  );

  const filtered = useMemo(() => {
    let rows = [...visits];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (v) =>
          v.schoolName.toLowerCase().includes(q) ||
          v.supervisorName.toLowerCase().includes(q) ||
          v.udise.toLowerCase().includes(q) ||
          v.block.toLowerCase().includes(q),
      );
    }
    if (blockFilter) rows = rows.filter((v) => v.block === blockFilter);
    if (supervisorFilter) rows = rows.filter((v) => v.supervisorName === supervisorFilter);
    if (statusFilter) rows = rows.filter((v) => v.status === statusFilter);
    if (visitTypeFilter) rows = rows.filter((v) => (v.visitType || "adhoc") === visitTypeFilter);
    if (dateFilter) rows = rows.filter((v) => visitMatchesFilter(v.visitDate, dateFilter));
    return rows.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }, [visits, searchTerm, blockFilter, supervisorFilter, statusFilter, visitTypeFilter, dateFilter]);

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    blockFilter !== "" ||
    supervisorFilter !== "" ||
    statusFilter !== "submitted" ||
    visitTypeFilter !== "" ||
    datePreset !== "all" ||
    fromDate !== "" ||
    toDate !== "";

  const clearFilters = () => {
    setSearchTerm("");
    setBlockFilter("");
    setSupervisorFilter("");
    setStatusFilter("submitted");
    setVisitTypeFilter("");
    setDatePreset("all");
    setFromDate("");
    setToDate("");
  };

  const datePresets: { key: DatePreset; label: string }[] = [
    { key: "all", label: "All Dates" },
    { key: "day", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "range", label: "Custom Range" },
  ];

  const activeDateSummary = dateFilter
    ? (() => {
        const { fromDate: start, toDate: end } = resolveHistoryFilterBounds(dateFilter);
        return start === end ? start : `${start} – ${end}`;
      })()
    : null;

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <Camera className="text-[#ff791a]" size={18} />
            Visits
            {submittedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {submittedCount} pending review
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">Review school visits, photos, and materials logged by supervisors. Commitment visits fulfill diary entries; ad-hoc visits are optional extra check-ins.</p>
        </div>
      </div>

      <div className="mb-4 space-y-3 border-b border-slate-100 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search school, supervisor, UDISE, block..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-[#ff791a]"
          />
        </div>

        <div className="flex overflow-x-auto bg-slate-200/60 p-1 rounded-lg gap-1 scrollbar-none whitespace-nowrap">
          {datePresets.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDatePreset(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition shrink-0 cursor-pointer ${
                datePreset === key
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {datePreset === "range" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <DateInput
              value={fromDate}
              max={toDate || toIsoDate(new Date())}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
            />
            <DateInput
              value={toDate}
              min={fromDate}
              max={toIsoDate(new Date())}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
            />
          </div>
        )}

        {activeDateSummary && datePreset !== "all" && (
          <p className="text-[10px] font-semibold text-slate-400">
            Showing visits for {activeDateSummary}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
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
            {supervisors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={visitTypeFilter}
            onChange={(e) => setVisitTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs cursor-pointer"
          >
            <option value="">All Visit Types</option>
            <option value="commitment">Commitment Visit</option>
            <option value="adhoc">Ad-hoc Visit</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition font-semibold cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-10 text-sm">
          {visits.length === 0
            ? "No supervisor visits recorded yet."
            : "No visits match the current filters."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((visit) => (
            <div key={visit.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === visit.id ? null : visit.id)}
                className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2 cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-800 text-sm">{visit.schoolName}</span>
                  <span className="text-xs text-slate-400 ml-2">{visit.visitDate}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ml-2 ${
                    visit.visitType === "commitment"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {visit.visitType === "commitment" ? "Commitment" : "Ad-hoc"}
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    <MapPin size={10} className="inline" /> {visit.block} — {visit.supervisorName}
                  </span>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  visit.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                  visit.status === "rejected" ? "bg-red-100 text-red-700" :
                  "bg-amber-100 text-amber-700"
                }`}>{visit.status}</span>
              </button>
              {expandedId === visit.id && (
                <div className="p-3 space-y-3 text-xs">
                  {visit.notes && <p className="text-slate-600">{visit.notes}</p>}
                  {visit.materialsGiven?.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-500 block mb-1">Materials Given</span>
                      <ul className="list-disc pl-4 text-slate-600">
                        {visit.materialsGiven.map((m, i) => (
                          <li key={i}>{m.item}: {m.qty}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {visit.photos?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {visit.photos.map((photo) => (
                        <div key={photo.id} className="w-28">
                          <img
                            src={photo.photoDataBase64.startsWith("data:") ? photo.photoDataBase64 : `data:${photo.mimeType};base64,${photo.photoDataBase64}`}
                            alt={photo.caption || "Visit photo"}
                            className="w-28 h-28 object-cover rounded border border-slate-200"
                          />
                          {(photo.takenAt || photo.locationLabel) && (
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                              {photo.takenAt && (
                                <span className="block">
                                  {new Date(photo.takenAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                                </span>
                              )}
                              {photo.locationLabel && <span className="block truncate">{photo.locationLabel}</span>}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {visit.gpsLocation && (
                    <p className="text-[10px] text-slate-500">
                      Visit GPS: {visit.gpsLocation.lat.toFixed(5)}, {visit.gpsLocation.lng.toFixed(5)}
                      {visit.gpsLocation.locationLabel && (
                        <span className="block mt-0.5">{visit.gpsLocation.locationLabel}</span>
                      )}
                    </p>
                  )}
                  {!readOnly && visit.status === "submitted" && (
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(visit.id, "approved")}
                        className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold cursor-pointer"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(visit.id, "rejected")}
                        className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold cursor-pointer"
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
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
