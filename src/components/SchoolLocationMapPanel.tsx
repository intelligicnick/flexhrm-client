import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import { localityHintFromSchoolName, isUnsafeSchoolPin } from "../lib/school-place-match";
import { locationConfidenceLabel } from "../lib/school-geofence";
import { formatNetworkFetchError } from "../api";
import { BULK_BATCH_DELAY_MS, fetchBulkBatch, sleep } from "../lib/bulk-fetch";
import { SchoolWork } from "../types";
import SchoolLeafletMap from "./SchoolLeafletMap";

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      // No AbortSignal.timeout — aborted cross-origin fetches often look like "Failed to fetch".
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }
  throw formatNetworkFetchError(lastErr);
}

const MANUAL_BATCH_SIZE = 30;
/** One school per HTTP request — Hostinger proxy ~20s; multi-school chunks get killed mid-resolve. */
const API_CHUNK_SIZE = 1;

type ResolveMode = "manual_batch" | "continuous";

interface SchoolLocationMapPanelProps {
  schools: SchoolWork[];
  readOnly?: boolean;
}

type SearchHit = {
  lat: number;
  lng: number;
  displayName: string;
  source: string;
};

type VillageGroup = {
  village: string;
  schools: SchoolWork[];
  draftCount: number;
  verifiedCount: number;
  missingCount: number;
  lat?: number;
  lng?: number;
};

function hasValidPin(school: SchoolWork): boolean {
  const lat = Number(school.lat);
  const lng = Number(school.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function pinStatus(school: SchoolWork): "verified" | "draft" | "missing" {
  if (!hasValidPin(school)) return "missing";
  if (school.locationVerified) return "verified";
  return "draft";
}

function resolutionStepLabel(step?: string): string {
  if (step === "dramitkumar_registry") return "Step 0 · schoolinfo.dramitkumar.in (UDISE)";
  if (step === "schools_org_in_registry") return "Step 0 · schools.org.in (UDISE)";
  if (step === "school") return "Step 1 · School on Google";
  if (step === "block_cache") return "Step 2 · Reused village pin in block";
  if (step === "onefivenine_village") return "Step 2 · Village on onefivenine.com";
  if (step === "onefivenine_direct") return "Step 2 · onefivenine direct URL";
  if (step === "google_combo" || step === "village") return "Step 3 · Village on Google";
  if (step === "osm_combo" || step === "osm_village") return "Step 4 · Village on OpenStreetMap";
  return "";
}

function resolveStatusClass(status: string): string {
  if (status === "verified" || status === "resolved") return "text-emerald-700";
  if (status === "skipped") return "text-slate-500";
  if (status === "unsafe_pin") return "text-amber-700";
  return "text-rose-700";
}

function statusDotClass(status: "verified" | "draft" | "missing"): string {
  if (status === "verified") return "bg-emerald-500";
  if (status === "draft") return "bg-amber-500";
  return "bg-rose-400";
}

function statusBadgeClass(status: "verified" | "draft" | "missing"): string {
  if (status === "verified") return "bg-emerald-50 text-emerald-700 ring-emerald-200/80";
  if (status === "draft") return "bg-amber-50 text-amber-800 ring-amber-200/80";
  return "bg-rose-50 text-rose-700 ring-rose-200/80";
}

function statusLabel(status: "verified" | "draft" | "missing"): string {
  if (status === "verified") return "Verified";
  if (status === "draft") return "Draft";
  return "No pin";
}

/** Soften ALL-CAPS school names from registries for readable UI. */
function displaySchoolName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/\b([a-z])/g, (ch) => ch.toUpperCase());
}

const selectClassName =
  "w-full h-9 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ff791a]/25 focus:border-[#ff791a]/60 disabled:opacity-50";
const labelClassName = "text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1";

export default function SchoolLocationMapPanel({
  schools,
  readOnly = false,
}: SchoolLocationMapPanelProps) {
  const [district, setDistrict] = useState("");
  const [block, setBlock] = useState("");
  const [skipExisting, setSkipExisting] = useState(false);
  const [resolveMode, setResolveMode] = useState<ResolveMode>("manual_batch");
  const [manualBatchOffset, setManualBatchOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    totalVillages: number;
    resolved: number;
    skipped: number;
    failed: number;
    villagesResolved: number;
  } | null>(null);
  const [resolveRows, setResolveRows] = useState<Array<Record<string, unknown>>>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<SchoolWork>>>({});
  const [selectedVillage, setSelectedVillage] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const mergedSchools = useMemo(
    () =>
      schools.map((school) => ({
        ...school,
        ...(overrides[school.id] || {}),
      })),
    [schools, overrides],
  );

  const districts = useMemo(
    () => Array.from(new Set(mergedSchools.map((s) => s.district).filter(Boolean))).sort(),
    [mergedSchools],
  );

  const blocks = useMemo(() => {
    let list = mergedSchools;
    if (district) list = list.filter((s) => s.district === district);
    return Array.from(new Set(list.map((s) => s.block).filter(Boolean))).sort();
  }, [mergedSchools, district]);

  const filteredSchools = useMemo(() => {
    let list = mergedSchools;
    if (district) list = list.filter((s) => s.district === district);
    if (block) list = list.filter((s) => s.block === block);
    return list;
  }, [mergedSchools, district, block]);

  const orderedBlockSchools = useMemo(
    () => [...filteredSchools].sort((a, b) => (a.srNo ?? 0) - (b.srNo ?? 0)),
    [filteredSchools],
  );

  const totalBlockSchools = orderedBlockSchools.length;
  const totalManualBatches = Math.max(1, Math.ceil(totalBlockSchools / MANUAL_BATCH_SIZE));
  const currentManualBatchIndex = Math.floor(manualBatchOffset / MANUAL_BATCH_SIZE);
  const currentBatchSchools = useMemo(
    () => orderedBlockSchools.slice(manualBatchOffset, manualBatchOffset + MANUAL_BATCH_SIZE),
    [orderedBlockSchools, manualBatchOffset],
  );
  const allManualBatchesComplete =
    totalBlockSchools > 0 && manualBatchOffset >= totalBlockSchools;

  useEffect(() => {
    setManualBatchOffset(0);
    setResolveRows([]);
    setSummary(null);
    setError(null);
  }, [district, block, skipExisting, resolveMode]);

  const villageGroups = useMemo((): VillageGroup[] => {
    const map = new Map<string, SchoolWork[]>();
    for (const school of filteredSchools) {
      const village = localityHintFromSchoolName(school.schoolName || "") || "(no village parsed)";
      const list = map.get(village) ?? [];
      list.push(school);
      map.set(village, list);
    }
    return [...map.entries()]
      .map(([village, groupSchools]) => {
        const pinned = groupSchools.filter(hasValidPin);
        const lat =
          pinned.length > 0
            ? pinned.reduce((sum, s) => sum + Number(s.lat), 0) / pinned.length
            : undefined;
        const lng =
          pinned.length > 0
            ? pinned.reduce((sum, s) => sum + Number(s.lng), 0) / pinned.length
            : undefined;
        return {
          village,
          schools: groupSchools,
          draftCount: groupSchools.filter((s) => pinStatus(s) === "draft").length,
          verifiedCount: groupSchools.filter((s) => pinStatus(s) === "verified").length,
          missingCount: groupSchools.filter((s) => pinStatus(s) === "missing").length,
          lat,
          lng,
        };
      })
      .sort((a, b) => a.village.localeCompare(b.village));
  }, [filteredSchools]);

  const selectedSchool = useMemo(
    () => filteredSchools.find((s) => s.id === selectedSchoolId) ?? null,
    [filteredSchools, selectedSchoolId],
  );

  const patchOverride = useCallback((schoolId: string, patch: Partial<SchoolWork>) => {
    setOverrides((prev) => ({
      ...prev,
      [schoolId]: { ...prev[schoolId], ...patch },
    }));
  }, []);

  const applyResolveResultRows = useCallback(
    (rows: Array<Record<string, unknown>>) => {
      for (const row of rows) {
        const schoolId = String(row.schoolWorkId || "");
        if (!schoolId) continue;
        if (
          row.status === "verified" ||
          row.status === "draft" ||
          row.status === "resolved" ||
          row.status === "unsafe_pin"
        ) {
          patchOverride(schoolId, {
            lat: Number(row.lat),
            lng: Number(row.lng),
            matchedPlaceName: String(row.matchedPlaceName || ""),
            locationConfidence: String(row.locationConfidence || "village"),
            locationVerified: row.status === "verified" || !!row.locationVerified,
            geofenceRadiusM: Number(row.geofenceRadiusM) || 400,
            googleMapsUrl: String(row.googleMapsUrl || ""),
            locationSource: String(row.locationSource || ""),
          });
        }
      }
    },
    [patchOverride],
  );

  const resolveSchoolRange = async (startOffset: number, endOffset: number | null) => {
    if (!block.trim()) {
      setError("Select a block first.");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(null);

    let schoolOffset = startOffset;
    let total = totalBlockSchools;
    let totalVillages = 0;
    let resolved = 0;
    let skipped = 0;
    let failed = 0;
    let villagesResolved = 0;
    const batchRows: Array<Record<string, unknown>> = [];
    const rangeEnd = endOffset ?? Number.MAX_SAFE_INTEGER;

    try {
      while (schoolOffset < rangeEnd) {
        const chunkLimit = Math.min(API_CHUNK_SIZE, rangeEnd - schoolOffset);
        if (chunkLimit <= 0) break;

        const schoolAtOffset = orderedBlockSchools[schoolOffset];
        setProgress(
          total > 0
            ? resolveMode === "manual_batch"
              ? `Resolving school ${Math.min(schoolOffset + 1, total)} of ${total} (batch ${currentManualBatchIndex + 1}/${totalManualBatches})…`
              : `Resolving school ${Math.min(schoolOffset + 1, total)} of ${total}…`
            : "Starting school location resolve…",
        );

        try {
          const res = await fetchBulkBatch(
            "/api/school-works/bulk-assign-village-locations",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                block: block.trim(),
                district: district.trim() || undefined,
                saveDraft: true,
                skipExisting,
                schoolLimit: chunkLimit,
                schoolOffset,
                fastMode: true,
              }),
            },
            {
              onWait: (reason, waitMs) => {
                const secs = Math.ceil(waitMs / 1000);
                const label =
                  reason === "rate_limit"
                    ? "Rate limit — pausing"
                    : reason === "gateway"
                      ? "Server busy — retrying"
                      : "Brief network glitch — retrying";
                setProgress(
                  total > 0
                    ? `${label} ${secs}s (${Math.min(schoolOffset + 1, total)}/${total})…`
                    : `${label} ${secs}s…`,
                );
              },
            },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || "School resolve failed.");

          total = Number(data.total) || total;
          totalVillages = Number(data.totalVillages) || totalVillages;
          resolved += Number(data.resolved) || 0;
          skipped += Number(data.skipped) || 0;
          failed += Number(data.failed) || 0;
          villagesResolved += Number(data.villagesResolved) || 0;

          if (Array.isArray(data.results)) {
            batchRows.push(...data.results);
            applyResolveResultRows(data.results);
          }

          setSummary({ total, totalVillages, resolved, skipped, failed, villagesResolved });
          setResolveRows([...batchRows]);

          const nextOffset =
            Number(data.nextSchoolOffset ?? data.nextVillageOffset ?? data.nextOffset) ||
            schoolOffset + chunkLimit;
          schoolOffset = nextOffset;

          if (!data.hasMore) break;
          if (schoolOffset >= rangeEnd) break;
          await sleep(BULK_BATCH_DELAY_MS);
        } catch (schoolErr: unknown) {
          // Never stall the whole batch on one flaky school — mark failed and advance.
          const message =
            schoolErr instanceof Error ? schoolErr.message : "School resolve failed.";
          failed += 1;
          const failRow: Record<string, unknown> = {
            schoolWorkId: schoolAtOffset?.id || "",
            schoolName: schoolAtOffset?.schoolName || `School #${schoolOffset + 1}`,
            udise: schoolAtOffset?.udise || "",
            villageHint: localityHintFromSchoolName(schoolAtOffset?.schoolName || ""),
            status: "not_found",
            failureReason: "connection_or_timeout",
            message,
            stepsTried: ["client_skip_forward"],
          };
          batchRows.push(failRow);
          setResolveRows([...batchRows]);
          setSummary({
            total,
            totalVillages,
            resolved,
            skipped,
            failed,
            villagesResolved,
          });
          setProgress(
            `Skipped school ${schoolOffset + 1} (${message.slice(0, 80)}${message.length > 80 ? "…" : ""}) — continuing…`,
          );
          schoolOffset += chunkLimit;
          if (schoolOffset >= rangeEnd) break;
          await sleep(BULK_BATCH_DELAY_MS);
        }
      }

      setResolveRows(batchRows);
      setProgress(null);

      if (skipExisting && resolved === 0 && skipped > 0 && failed === 0) {
        setError(
          "All schools in this batch were skipped because they already have verified pins.",
        );
      } else if (failed > 0 && resolved === 0 && skipped === 0) {
        setError(
          `${failed} school(s) in this batch could not be auto-verified — see the resolve log below. You can re-run the batch for misses.`,
        );
      }

      return { resolved, skipped, failed, processed: batchRows.length };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "School resolve failed.");
      if (batchRows.length > 0) setResolveRows(batchRows);
      return null;
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const runAutoPin = async () => {
    setSummary(null);
    setResolveRows([]);
    await resolveSchoolRange(0, null);
  };

  const runManualBatch = async () => {
    if (currentBatchSchools.length === 0) {
      setError("No schools in this batch.");
      return;
    }

    const result = await resolveSchoolRange(
      manualBatchOffset,
      manualBatchOffset + currentBatchSchools.length,
    );
    if (result) {
      setManualBatchOffset((prev) => prev + currentBatchSchools.length);
    }
  };

  const restartManualBatches = () => {
    setManualBatchOffset(0);
    setSummary(null);
    setResolveRows([]);
    setError(null);
  };

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetchWithRetry("/api/school-works/location-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Search failed.");
      setSearchHits(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setSearchHits([]);
    } finally {
      setSearching(false);
    }
  };

  const applySearchHit = (hit: SearchHit) => {
    if (!selectedSchool || readOnly) return;
    void saveDraftPin(selectedSchool.id, hit.lat, hit.lng, hit.displayName);
    setSearchHits([]);
  };

  const saveDraftPin = async (
    schoolId: string,
    lat: number,
    lng: number,
    matchedPlaceName?: string,
  ) => {
    if (readOnly) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry(`/api/school-works/${schoolId}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
          matchedPlaceName,
          locationConfidence: "village",
          geofenceRadiusM: 400,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save pin.");
      patchOverride(schoolId, {
        lat: data.lat,
        lng: data.lng,
        matchedPlaceName: data.matchedPlaceName,
        locationVerified: false,
        locationConfidence: data.locationConfidence,
        geofenceRadiusM: data.geofenceRadiusM,
        googleMapsUrl: data.googleMapsUrl,
        locationSource: data.locationSource,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save pin.");
    } finally {
      setActionLoading(false);
    }
  };

  const verifySchool = async (schoolId: string) => {
    if (readOnly) return;
    const school = mergedSchools.find((s) => s.id === schoolId);
    if (!school || !hasValidPin(school)) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry(`/api/school-works/${schoolId}/verify-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: Number(school.lat),
          lng: Number(school.lng),
          matchedPlaceName: school.matchedPlaceName,
          locationConfidence: school.locationConfidence || "village",
          geofenceRadiusM: school.geofenceRadiusM || 400,
          googleMapsUrl: school.googleMapsUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Verify failed.");
      patchOverride(schoolId, {
        locationVerified: true,
        locationVerifiedAt: data.locationVerifiedAt,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verify failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const verifyVillage = async (village: string) => {
    if (readOnly || !block.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry("/api/school-works/verify-village", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block: block.trim(),
          district: district.trim() || undefined,
          village,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Village verify failed.");
      const group = villageGroups.find((g) => g.village === village);
      if (group) {
        for (const school of group.schools) {
          if (hasValidPin(school)) {
            patchOverride(school.id, { locationVerified: true });
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Village verify failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const batchProgressPct =
    totalBlockSchools > 0
      ? Math.min(100, Math.round((manualBatchOffset / totalBlockSchools) * 100))
      : 0;

  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <header className="px-5 pt-5 pb-4 border-b border-slate-100 bg-linear-to-br from-orange-50/50 via-white to-slate-50/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-orange-100 shadow-xs shrink-0">
                <MapPin className="text-[#ff791a]" size={18} />
              </span>
              Village-First School Locations
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xl leading-relaxed">
              Pin schools by village, drag to correct on the map, then verify before supervisors can submit visits.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Verified
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Draft
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Missing
            </span>
          </div>
        </div>
      </header>

      <div className="p-5 space-y-5">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_auto] gap-3 items-end">
            <div>
              <label className={labelClassName}>District</label>
              <select
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setBlock("");
                }}
                className={selectClassName}
                disabled={readOnly || loading}
              >
                <option value="">All districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Block</label>
              <select
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                className={selectClassName}
                disabled={readOnly || loading}
              >
                <option value="">Select block</option>
                {blocks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClassName}>Resolve mode</label>
              <select
                value={resolveMode}
                onChange={(e) => setResolveMode(e.target.value as ResolveMode)}
                className={selectClassName}
                disabled={readOnly || loading}
              >
                <option value="manual_batch">30 schools per batch (recommended)</option>
                <option value="continuous">All schools at once</option>
              </select>
            </div>
            {!readOnly && resolveMode === "continuous" ? (
              <button
                type="button"
                onClick={() => void runAutoPin()}
                disabled={loading || !block}
                className="inline-flex h-9 items-center justify-center gap-1.5 px-4 rounded-lg bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Resolve all
              </button>
            ) : (
              <div className="hidden xl:block" aria-hidden />
            )}
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              disabled={readOnly || loading}
              className="mt-0.5 rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a]/40"
            />
            <span>
              Skip schools that already have verified pins
              <span className="text-slate-400"> — off by default, every school is resolved</span>
            </span>
          </label>
        </div>

        {!readOnly && resolveMode === "manual_batch" && block && (
          <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
            {allManualBatchesComplete ? (
              <div className="p-5 space-y-3 bg-emerald-50/40">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                    <CheckCircle2 size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">
                      All {totalBlockSchools} schools processed
                    </p>
                    <p className="text-xs text-emerald-800/80 mt-0.5">
                      Finished in {totalManualBatches} batch{totalManualBatches === 1 ? "" : "es"}. Run again from
                      batch 1 after fixes or to re-check pins.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={restartManualBatches}
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-1.5 px-4 rounded-lg border border-[#ff791a] text-[#ff791a] hover:bg-orange-50 text-xs font-bold disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={14} />
                  Start over from batch 1
                </button>
              </div>
            ) : (
              <>
                <div className="px-4 pt-4 pb-3 space-y-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        Batch {currentManualBatchIndex + 1} of {totalManualBatches}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Schools {manualBatchOffset + 1}–
                        {manualBatchOffset + currentBatchSchools.length} of {totalBlockSchools}
                        <span className="text-slate-300 mx-1.5">·</span>
                        {currentBatchSchools.length} in this batch
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void runManualBatch()}
                      disabled={loading || currentBatchSchools.length === 0}
                      className="inline-flex h-9 items-center gap-1.5 px-4 rounded-lg bg-[#ff791a] hover:bg-[#e4640c] text-white text-xs font-bold disabled:opacity-50 shrink-0 shadow-xs transition-colors"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Resolve this batch ({currentBatchSchools.length})
                    </button>
                  </div>
                  <div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#ff791a] transition-all duration-300"
                        style={{ width: `${batchProgressPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      Resolves school-by-school (fast path). Flaky schools are skipped so the batch keeps moving.
                    </p>
                  </div>
                </div>

                <ul className="max-h-56 overflow-auto divide-y divide-slate-100">
                  {currentBatchSchools.map((school, index) => {
                    const status = pinStatus(school);
                    return (
                      <li
                        key={school.id}
                        className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50/80 transition-colors"
                      >
                        <span className="text-[11px] tabular-nums text-slate-400 w-6 shrink-0 text-right">
                          {manualBatchOffset + index + 1}
                        </span>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(status)}`} />
                        <span className="min-w-0 flex-1">
                          <span className="text-xs font-semibold text-slate-800 block truncate">
                            {displaySchoolName(school.schoolName || "")}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {school.udise ? `UDISE ${school.udise}` : "No UDISE"}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${statusBadgeClass(status)}`}
                        >
                          {statusLabel(status)}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {currentManualBatchIndex > 0 && (
                  <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() =>
                        setManualBatchOffset((prev) => Math.max(0, prev - MANUAL_BATCH_SIZE))
                      }
                      disabled={loading}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
                    >
                      <ArrowLeft size={12} />
                      Previous batch (view only)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!readOnly && resolveMode === "manual_batch" && !block && (
          <p className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-3">
            Select a block to load schools in batches of 30.
          </p>
        )}

        {progress && (
          <p className="text-xs text-slate-600 bg-orange-50/60 border border-orange-100 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-[#ff791a] shrink-0" />
            {progress}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</p>
        )}

        {summary && (
          <div className="flex flex-wrap gap-2">
            {[
              ["Schools", summary.total],
              ["Villages", summary.totalVillages],
              ["Verified", summary.resolved],
              ["Skipped", summary.skipped],
              ["Failed", summary.failed],
            ].map(([label, value]) => (
              <span
                key={String(label)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px]"
              >
                <span className="text-slate-500 font-medium">{label}</span>
                <span className="font-bold text-slate-800 tabular-nums">{value}</span>
              </span>
            ))}
          </div>
        )}

        {resolveRows.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="text-left font-bold px-3 py-2.5">School</th>
                  <th className="text-left font-bold px-3 py-2.5">Result</th>
                  <th className="text-left font-bold px-3 py-2.5">Reason</th>
                  <th className="text-left font-bold px-3 py-2.5">Match</th>
                </tr>
              </thead>
              <tbody>
                {resolveRows.map((row) => {
                  const schoolId = String(row.schoolWorkId || "");
                  const status = String(row.status || "");
                  return (
                    <tr
                      key={schoolId || String(row.schoolName)}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-3 py-2.5 align-top">
                        <p className="font-semibold text-slate-800">
                          {displaySchoolName(String(row.schoolName || ""))}
                        </p>
                        {row.villageHint ? (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Village:{" "}
                            <span className="font-medium text-slate-600">{String(row.villageHint)}</span>
                          </p>
                        ) : null}
                      </td>
                      <td className={`px-3 py-2.5 align-top capitalize font-semibold ${resolveStatusClass(status)}`}>
                        {status.replace(/_/g, " ")}
                        {row.resolutionStep ? (
                          <span className="block text-[10px] font-normal text-slate-500 normal-case mt-0.5">
                            {resolutionStepLabel(String(row.resolutionStep))}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 align-top text-slate-600">
                        {String(row.message || row.failureReason || row.successReason || "—")}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {row.matchedPlaceName ? String(row.matchedPlaceName) : "—"}
                        {row.googleMapsUrl ? (
                          <a
                            href={String(row.googleMapsUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[#ff791a] font-semibold hover:underline mt-0.5"
                          >
                            Open map
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[220px] flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                placeholder="Search village, school, or paste lat, lng"
                className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#ff791a]/25 focus:border-[#ff791a]/60 disabled:opacity-50"
                disabled={readOnly}
              />
            </div>
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={searching || readOnly}
              className="inline-flex h-9 items-center gap-1.5 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 transition-colors"
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </div>
          {selectedSchool?.googleMapsUrl && (
            <a
              href={selectedSchool.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#ff791a] hover:underline"
            >
              Open in Google Maps
            </a>
          )}
        </div>

        {searchHits.length > 0 && (
          <ul className="max-h-36 overflow-auto rounded-xl border border-slate-200/80 text-xs divide-y divide-slate-100 bg-white">
            {searchHits.map((hit) => (
              <li key={`${hit.lat}-${hit.lng}-${hit.displayName}`}>
                <button
                  type="button"
                  onClick={() => applySearchHit(hit)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-orange-50/50 transition-colors"
                  disabled={!selectedSchool || readOnly}
                >
                  {hit.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 min-h-[440px]">
          <div className="rounded-xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[440px] bg-white">
            <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Villages</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {villageGroups.length > 0
                  ? `${villageGroups.length} in ${block || "selection"}`
                  : "Select a block to list villages"}
              </p>
            </div>
            <div className="overflow-auto flex-1">
              {villageGroups.length === 0 ? (
                <p className="text-xs text-slate-400 p-4">No villages for this filter.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-xs">
                  {villageGroups.map((group) => (
                    <li key={group.village}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVillage(group.village);
                          setSelectedSchoolId(group.schools[0]?.id ?? null);
                        }}
                        className={`w-full text-left px-3 py-2.5 transition-colors ${
                          selectedVillage === group.village
                            ? "bg-orange-50 border-l-2 border-l-[#ff791a]"
                            : "hover:bg-slate-50 border-l-2 border-l-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              group.verifiedCount === group.schools.length
                                ? "bg-emerald-500"
                                : group.missingCount > 0
                                  ? "bg-rose-400"
                                  : "bg-amber-500"
                            }`}
                          />
                          <span className="font-semibold text-slate-800 truncate">{group.village}</span>
                          <span className="text-[10px] font-bold text-slate-400 ml-auto tabular-nums bg-slate-100 rounded-md px-1.5 py-0.5">
                            {group.schools.length}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 pl-4">
                          {group.verifiedCount} verified · {group.draftCount} draft · {group.missingCount} missing
                        </p>
                      </button>
                      {selectedVillage === group.village && (
                        <div className="px-2.5 pb-2.5 space-y-1 bg-orange-50/30">
                          {!readOnly && group.draftCount > 0 && (
                            <button
                              type="button"
                              onClick={() => void verifyVillage(group.village)}
                              disabled={actionLoading}
                              className="w-full text-left px-2.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <CheckCircle2 size={13} /> Verify whole village
                            </button>
                          )}
                          {group.schools.map((school) => {
                            const status = pinStatus(school);
                            return (
                              <button
                                key={school.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSchoolId(school.id);
                                  setSelectedVillage(group.village);
                                }}
                                className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors ${
                                  selectedSchoolId === school.id
                                    ? "border-[#ff791a] bg-white shadow-xs"
                                    : "border-transparent hover:bg-white/80"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${statusDotClass(status)}`} />
                                  <span className="min-w-0">
                                    <span className="font-medium text-slate-700 block leading-snug">
                                      {displaySchoolName(school.schoolName || "")}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                      {hasValidPin(school)
                                        ? `${school.matchedPlaceName || localityHintFromSchoolName(school.schoolName || "")} · ${locationConfidenceLabel(school.locationConfidence)}`
                                        : "No pin — run Resolve"}
                                    </span>
                                    {school.udise && (
                                      <span className="text-[10px] text-slate-400">UDISE {school.udise}</span>
                                    )}
                                  </span>
                                </div>
                                {selectedSchoolId === school.id &&
                                  hasValidPin(school) &&
                                  !readOnly &&
                                  !school.locationVerified && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void verifySchool(school.id);
                                      }}
                                      disabled={actionLoading}
                                      className="mt-1.5 ml-3.5 text-[10px] font-bold text-emerald-700 hover:text-emerald-900"
                                    >
                                      Verify this school
                                    </button>
                                  )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 overflow-hidden min-h-[320px] lg:min-h-[440px]">
            <SchoolLeafletMap
              schools={filteredSchools}
              selectedSchoolId={selectedSchoolId}
              readOnly={readOnly}
              onSelectSchool={(schoolId) => {
                const school = filteredSchools.find((s) => s.id === schoolId);
                setSelectedSchoolId(schoolId);
                if (school) {
                  setSelectedVillage(localityHintFromSchoolName(school.schoolName || "") || null);
                }
              }}
              onDragPin={(schoolId, lat, lng) => {
                const school = filteredSchools.find((s) => s.id === schoolId);
                void saveDraftPin(schoolId, lat, lng, school?.matchedPlaceName);
              }}
            />
          </div>
        </div>

        {selectedSchool && isUnsafeSchoolPin(selectedSchool) && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
            This pin is outside Bihar or does not match district/block — likely a wrong match.
            Search for the correct village in {selectedSchool.district || "district"} /{" "}
            {selectedSchool.block || "block"}, drag the pin, then verify.
          </p>
        )}

        {selectedSchool && (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Selected{" "}
              <span className="font-semibold text-slate-800">
                {displaySchoolName(selectedSchool.schoolName || "")}
              </span>
            </span>
            {selectedSchool.matchedPlaceName && (
              <span>
                Place <span className="font-semibold text-slate-700">{selectedSchool.matchedPlaceName}</span>
              </span>
            )}
            {hasValidPin(selectedSchool) && (
              <span className="tabular-nums">
                {Number(selectedSchool.lat).toFixed(5)}, {Number(selectedSchool.lng).toFixed(5)}
                <span className="text-slate-300 mx-1.5">·</span>
                {selectedSchool.locationVerified ? "Verified" : "Draft"}
              </span>
            )}
          </div>
        )}

        <details className="group rounded-xl border border-slate-200/80 bg-white text-[11px] text-slate-500 overflow-hidden">
          <summary className="flex items-center gap-2 px-3.5 py-2.5 font-semibold text-slate-600 cursor-pointer list-none hover:bg-slate-50 transition-colors">
            <CircleHelp size={14} className="text-slate-400 shrink-0" />
            How resolving works & checklist
            <span className="ml-auto text-slate-400 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 space-y-3">
            <p className="leading-relaxed">
              Step 0 checks <strong>schoolinfo.dramitkumar.in</strong> and <strong>schools.org.in</strong> by UDISE.
              Then Google Places (school + block + district). If that misses,{" "}
              <strong>onefivenine.com</strong> is tried. Map layers: OSM + Esri satellite.
            </p>
            <ol className="space-y-1.5 list-decimal list-inside text-slate-600">
              <li>Select district + block. Prefer <strong>30 schools per batch</strong>.</li>
              <li>Review the list, click <strong>Resolve this batch</strong>, then continue until done.</li>
              <li>Or use <strong>All schools at once</strong> for a full automatic run.</li>
              <li>Wrong-district GPS (e.g. Muzaffarpur for Purnia) — re-resolve or drag manually.</li>
              <li>Green = verified · Amber = draft · Rose = no pin</li>
              <li>Supervisors see village name + distance from the required pin when submitting visits.</li>
            </ol>
          </div>
        </details>
      </div>
    </section>
  );
}
