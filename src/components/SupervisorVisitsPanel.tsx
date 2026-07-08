import React, { useMemo, useState } from "react";
import {
  Camera,
  Check,
  CheckSquare,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Square,
  X,
  MapPin,
} from "lucide-react";
import {
  resolveHistoryFilterBounds,
  toIsoDate,
  visitMatchesFilter,
  type SupervisorHistoryFilter,
} from "../lib/supervisor-dates";
import { resolveSupervisorLabel } from "../lib/resolve-supervisor-label";
import { SchoolSupervisor, SchoolVisit } from "../types";
import { DateInput } from "./ui/DateInput";
import VisitPhotoLightbox, { VisitPhotoThumbnail } from "./VisitPhotoLightbox";
import { formatLatLngDecimal, isValidGpsCoord } from "../lib/gps-coords";

interface SupervisorVisitsPanelProps {
  visits: SchoolVisit[];
  supervisors: SchoolSupervisor[];
  onUpdateStatus: (id: string, status: "approved" | "rejected") => Promise<boolean>;
  onBulkUpdateStatus?: (ids: string[], status: "approved" | "rejected") => Promise<boolean>;
  readOnly?: boolean;
}

type DatePreset = "all" | "day" | "week" | "month" | "range";
type ViewMode = "list" | "tiles";

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

function statusBadgeClass(status: SchoolVisit["status"]) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function visitText(value: unknown): string {
  return value == null ? "" : String(value);
}

function VisitTypeBadge({ visitType }: { visitType?: SchoolVisit["visitType"] }) {
  return (
    <span
      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
        visitType === "commitment" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {visitType === "commitment" ? "Commitment" : "Ad-hoc"}
    </span>
  );
}

interface VisitDetailsProps {
  visit: SchoolVisit;
  readOnly: boolean;
  onUpdateStatus: (id: string, status: "approved" | "rejected") => Promise<boolean>;
  onViewPhoto: (visit: SchoolVisit, photoIndex: number) => void;
}

function VisitDetails({ visit, readOnly, onUpdateStatus, onViewPhoto }: VisitDetailsProps) {
  return (
    <div className="p-3 space-y-3 text-xs">
      {visit.notes && <p className="text-slate-600">{visit.notes}</p>}
      {visit.materialsGiven?.length > 0 && (
        <div>
          <span className="font-bold text-slate-500 block mb-1">Materials Given</span>
          <ul className="list-disc pl-4 text-slate-600">
            {visit.materialsGiven.map((m, i) => (
              <li key={i}>
                {m.item}: {m.qty}
              </li>
            ))}
          </ul>
        </div>
      )}
      {visit.photos?.length > 0 && (
        <div>
          <span className="font-bold text-slate-500 block mb-2">
            Photos ({visit.photos.length}) — click to view full size
          </span>
          <div className="flex flex-wrap gap-2">
            {visit.photos.map((photo, photoIndex) => (
              <div key={photo.id} className="space-y-1">
                <VisitPhotoThumbnail
                  photo={photo}
                  size="md"
                  onView={() => onViewPhoto(visit, photoIndex)}
                />
                {(photo.takenAt || photo.locationLabel || isValidGpsCoord(photo.lat, photo.lng)) && (
                  <p className="text-[10px] text-slate-400 max-w-36 leading-tight">
                    {photo.takenAt && (
                      <span className="block">
                        {new Date(photo.takenAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </span>
                    )}
                    {photo.locationLabel && <span className="block">{photo.locationLabel}</span>}
                    {isValidGpsCoord(photo.lat, photo.lng) && (
                      <span className="block font-mono text-slate-500">
                        {formatLatLngDecimal(photo.lat, photo.lng)}
                      </span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {visit.gpsLocation && isValidGpsCoord(visit.gpsLocation.lat, visit.gpsLocation.lng) && (
        <p className="text-[10px] text-slate-500">
          Visit GPS: {formatLatLngDecimal(visit.gpsLocation.lat, visit.gpsLocation.lng)}
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
  );
}

export default function SupervisorVisitsPanel({
  visits,
  supervisors,
  onUpdateStatus,
  onBulkUpdateStatus,
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
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [lightbox, setLightbox] = useState<{
    visit: SchoolVisit;
    photoIndex: number;
  } | null>(null);

  const enriched = useMemo(
    () =>
      visits.map((visit) => ({
        ...visit,
        supervisorName: resolveSupervisorLabel(
          visit.supervisorId,
          visit.supervisorName,
          supervisors,
        ),
      })),
    [visits, supervisors],
  );

  const blocks = useMemo(
    () => Array.from(new Set(enriched.map((v) => v.block).filter(Boolean))).sort(),
    [enriched],
  );

  const supervisorOptions = useMemo(() => {
    const map = new Map<string, string>();
    enriched.forEach((visit) => {
      if (visit.supervisorId) map.set(visit.supervisorId, visit.supervisorName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [enriched]);

  const submittedCount = useMemo(
    () => visits.filter((v) => v.status === "submitted").length,
    [visits],
  );

  const dateFilter = useMemo(
    () => buildDateFilter(datePreset, fromDate, toDate),
    [datePreset, fromDate, toDate],
  );

  const filtered = useMemo(() => {
    let rows = [...enriched];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (v) =>
          visitText(v.schoolName).toLowerCase().includes(q) ||
          visitText(v.supervisorName).toLowerCase().includes(q) ||
          visitText(v.udise).toLowerCase().includes(q) ||
          visitText(v.block).toLowerCase().includes(q),
      );
    }
    if (blockFilter) rows = rows.filter((v) => v.block === blockFilter);
    if (supervisorFilter) rows = rows.filter((v) => v.supervisorId === supervisorFilter);
    if (statusFilter) rows = rows.filter((v) => v.status === statusFilter);
    if (visitTypeFilter) rows = rows.filter((v) => (v.visitType || "adhoc") === visitTypeFilter);
    if (dateFilter) rows = rows.filter((v) => visitMatchesFilter(v.visitDate, dateFilter));
    return rows.sort((a, b) => visitText(b.visitDate).localeCompare(visitText(a.visitDate)));
  }, [enriched, searchTerm, blockFilter, supervisorFilter, statusFilter, visitTypeFilter, dateFilter]);

  const selectableVisits = useMemo(
    () => filtered.filter((v) => !readOnly && v.status === "submitted"),
    [filtered, readOnly],
  );

  const allSelectableSelected =
    selectableVisits.length > 0 && selectableVisits.every((v) => selectedIds.has(v.id));

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableVisits.map((v) => v.id)));
    }
  };

  const bulkUpdateStatus = async (status: "approved" | "rejected") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkProcessing(true);
    try {
      const ok = onBulkUpdateStatus
        ? await onBulkUpdateStatus(ids, status)
        : await Promise.all(ids.map((id) => onUpdateStatus(id, status))).then(
            (results) => results.every(Boolean),
          );
      if (ok) setSelectedIds(new Set());
    } finally {
      setBulkProcessing(false);
    }
  };

  const openPhoto = (visit: SchoolVisit, photoIndex: number) => {
    setLightbox({ visit, photoIndex });
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

  const renderSelectCheckbox = (visit: SchoolVisit) => {
    if (readOnly || visit.status !== "submitted") return null;
    const checked = selectedIds.has(visit.id);
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleSelect(visit.id);
        }}
        className={`shrink-0 p-1 rounded transition cursor-pointer ${
          checked ? "text-[#ff791a]" : "text-slate-400 hover:text-slate-600"
        }`}
        aria-label={checked ? "Deselect visit" : "Select visit"}
      >
        {checked ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>
    );
  };

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
          <p className="text-xs text-slate-400">
            Review school visits, photos, and materials logged by supervisors. Commitment visits fulfill
            diary entries; ad-hoc visits are optional extra check-ins.
          </p>
        </div>
        <div className="inline-flex bg-slate-200/60 p-1 rounded-lg gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              viewMode === "list"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:bg-white/40"
            }`}
            aria-pressed={viewMode === "list"}
          >
            <List size={14} /> Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tiles")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
              viewMode === "tiles"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-600 hover:bg-white/40"
            }`}
            aria-pressed={viewMode === "tiles"}
          >
            <LayoutGrid size={14} /> Tiles
          </button>
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

        <div className="flex flex-wrap gap-2 items-center">
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
          {selectableVisits.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              {allSelectableSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {allSelectableSelected ? "Deselect all" : `Select all (${selectableVisits.length})`}
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
      ) : viewMode === "list" ? (
        <div className="space-y-3">
          {filtered.map((visit) => (
            <div key={visit.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === visit.id ? null : visit.id)}
                className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 flex items-start gap-2 cursor-pointer"
              >
                {renderSelectCheckbox(visit)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 text-sm">{visit.schoolName}</span>
                      <span className="text-xs text-slate-400 ml-2">{visit.visitDate}</span>
                      <VisitTypeBadge visitType={visit.visitType} />
                      <span className="text-xs text-slate-500 block mt-0.5">
                        <MapPin size={10} className="inline" /> {visit.block} — {visit.supervisorName}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${statusBadgeClass(visit.status)}`}
                    >
                      {visit.status}
                    </span>
                  </div>
                  {visit.photos?.length > 0 && expandedId !== visit.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <VisitPhotoThumbnail
                        photo={visit.photos[0]}
                        size="sm"
                        onView={() => openPhoto(visit, 0)}
                      />
                      {visit.photos.length > 1 && (
                        <span className="text-[10px] text-slate-400">+{visit.photos.length - 1} more</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
              {expandedId === visit.id && (
                <VisitDetails
                  visit={visit}
                  readOnly={readOnly}
                  onUpdateStatus={onUpdateStatus}
                  onViewPhoto={openPhoto}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((visit) => (
            <div
              key={visit.id}
              className="border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-white hover:shadow-md transition"
            >
              <div className="relative">
                {visit.photos?.length > 0 ? (
                  <VisitPhotoThumbnail
                    photo={visit.photos[0]}
                    size="lg"
                    onView={() => openPhoto(visit, 0)}
                  />
                ) : (
                  <div className="w-full aspect-[4/3] bg-slate-100 flex items-center justify-center text-slate-400">
                    <Camera size={32} />
                  </div>
                )}
                <div className="absolute top-2 left-2">{renderSelectCheckbox(visit)}</div>
                {visit.photos?.length > 1 && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
                    {visit.photos.length} photos
                  </span>
                )}
                <span
                  className={`absolute bottom-2 right-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusBadgeClass(visit.status)}`}
                >
                  {visit.status}
                </span>
              </div>
              <div className="p-3 flex-1 flex flex-col gap-2">
                <div>
                  <p className="font-bold text-slate-800 text-sm leading-tight">{visit.schoolName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{visit.visitDate}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <VisitTypeBadge visitType={visit.visitType} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    <MapPin size={10} className="inline" /> {visit.block} — {visit.supervisorName}
                  </p>
                </div>
                {visit.materialsGiven?.length > 0 && (
                  <p className="text-[10px] text-slate-500 line-clamp-2">
                    Materials: {visit.materialsGiven.map((m) => `${m.item} (${m.qty})`).join(", ")}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === visit.id ? null : visit.id)}
                  className="mt-auto text-xs font-semibold text-[#ff791a] hover:underline text-left cursor-pointer"
                >
                  {expandedId === visit.id ? "Hide details" : "View details"}
                </button>
              </div>
              {expandedId === visit.id && (
                <VisitDetails
                  visit={visit}
                  readOnly={readOnly}
                  onUpdateStatus={onUpdateStatus}
                  onViewPhoto={openPhoto}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg">
          <span className="text-sm font-semibold">
            {selectedIds.size} visit{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkProcessing}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => bulkUpdateStatus("rejected")}
              disabled={bulkProcessing}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
            >
              {bulkProcessing ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              Reject selected
            </button>
            <button
              type="button"
              onClick={() => bulkUpdateStatus("approved")}
              disabled={bulkProcessing}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
            >
              {bulkProcessing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Approve selected
            </button>
          </div>
        </div>
      )}

      {lightbox && lightbox.visit.photos?.length > 0 && (
        <VisitPhotoLightbox
          photos={lightbox.visit.photos}
          index={lightbox.photoIndex}
          visit={lightbox.visit}
          onClose={() => setLightbox(null)}
          onIndexChange={(photoIndex) => setLightbox({ visit: lightbox.visit, photoIndex })}
        />
      )}
    </section>
  );
}
