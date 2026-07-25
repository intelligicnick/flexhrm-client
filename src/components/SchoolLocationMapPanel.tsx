import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin, RefreshCw, Search } from "lucide-react";
import { localityHintFromSchoolName, isUnsafeSchoolPin } from "../lib/school-place-match";
import { locationConfidenceLabel } from "../lib/school-geofence";
import { formatNetworkFetchError } from "../api";
import { BULK_BATCH_DELAY_MS, fetchBulkBatch, sleep } from "../lib/bulk-fetch";
import { SchoolWork } from "../types";
import SchoolLeafletMap from "./SchoolLeafletMap";

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await fetch(url, init);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw formatNetworkFetchError(lastErr);
}

const MANUAL_BATCH_SIZE = 30;
const API_CHUNK_SIZE = 5;

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

        setProgress(
          total > 0
            ? resolveMode === "manual_batch"
              ? `Resolving schools ${schoolOffset + 1}–${Math.min(schoolOffset + chunkLimit, total)} of ${total} (batch ${currentManualBatchIndex + 1}/${totalManualBatches})…`
              : `Resolving schools ${schoolOffset + 1}–${Math.min(schoolOffset + chunkLimit, total)} of ${total}…`
            : "Starting school location resolve…",
        );

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
                    : "Connection issue — retrying";
              setProgress(
                total > 0
                  ? `${label} ${secs}s, then continuing (${Math.min(schoolOffset + 1, total)}/${total})…`
                  : `${label} ${secs}s, then continuing…`,
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

        const nextOffset =
          Number(data.nextSchoolOffset ?? data.nextVillageOffset ?? data.nextOffset) ||
          schoolOffset + chunkLimit;
        schoolOffset = nextOffset;

        if (!data.hasMore) break;
        if (schoolOffset >= rangeEnd) break;
        await sleep(BULK_BATCH_DELAY_MS);
      }

      setResolveRows(batchRows);
      setProgress(null);

      if (skipExisting && resolved === 0 && skipped > 0 && failed === 0) {
        setError(
          "All schools in this batch were skipped because they already have verified pins.",
        );
      } else if (failed > 0 && resolved === 0 && skipped === 0) {
        setError(
          `${failed} school(s) in this batch could not be auto-verified — see the resolve log below.`,
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

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div>
        <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
          <MapPin className="text-[#ff791a]" size={18} />
          Village-First School Locations
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Step 0 checks <strong>schoolinfo.dramitkumar.in</strong> and <strong>schools.org.in</strong> by UDISE for GPS pins. Then{" "}
          <strong>Google Places</strong> (school name + block + district). If Google misses a village,{" "}
          <strong>onefivenine.com</strong> is tried with progressive name combinations. Map uses <strong>OSM + Esri satellite</strong>{" "}
          with street/satellite/hybrid layers and village names on every pin.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">District</label>
          <select
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setBlock("");
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs"
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
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Block</label>
          <select
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs min-w-[160px]"
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
        <label className="flex items-center gap-2 text-xs text-slate-600 pb-2">
          <input
            type="checkbox"
            checked={skipExisting}
            onChange={(e) => setSkipExisting(e.target.checked)}
            disabled={readOnly || loading}
          />
          Skip schools with existing verified pins (off by default — every school is resolved)
        </label>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Resolve mode</label>
          <select
            value={resolveMode}
            onChange={(e) => setResolveMode(e.target.value as ResolveMode)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs min-w-[200px]"
            disabled={readOnly || loading}
          >
            <option value="manual_batch">30 schools per batch (recommended)</option>
            <option value="continuous">All schools at once</option>
          </select>
        </div>
        {!readOnly && resolveMode === "continuous" && (
          <button
            type="button"
            onClick={() => void runAutoPin()}
            disabled={loading || !block}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff791a] text-white text-xs font-bold disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Resolve all schools
          </button>
        )}
      </div>

      {!readOnly && resolveMode === "manual_batch" && block && (
        <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 space-y-3">
          {allManualBatchesComplete ? (
            <>
              <p className="text-sm font-semibold text-emerald-800">
                All {totalBlockSchools} schools processed in {totalManualBatches} batch
                {totalManualBatches === 1 ? "" : "es"}.
              </p>
              <p className="text-xs text-slate-600">
                You can run the resolve process again from batch 1 — useful after fixes or to re-check pins.
              </p>
              <button
                type="button"
                onClick={restartManualBatches}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#ff791a] text-[#ff791a] text-xs font-bold disabled:opacity-50"
              >
                <RefreshCw size={14} />
                Start over from batch 1
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Batch {currentManualBatchIndex + 1} of {totalManualBatches}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Schools {manualBatchOffset + 1}–
                    {manualBatchOffset + currentBatchSchools.length} of {totalBlockSchools} ·{" "}
                    {currentBatchSchools.length} in this batch
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runManualBatch()}
                  disabled={loading || currentBatchSchools.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff791a] text-white text-xs font-bold disabled:opacity-50 shrink-0"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Resolve this batch ({currentBatchSchools.length})
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Resolve this group first. When done, the next 30 schools appear automatically — click again for each batch.
                This avoids rate limits and Hostinger timeouts.
              </p>
              <ul className="max-h-48 overflow-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 text-xs">
                {currentBatchSchools.map((school, index) => {
                  const status = pinStatus(school);
                  return (
                    <li key={school.id} className="px-3 py-2 flex items-start gap-2">
                      <span className="text-slate-400 w-5 shrink-0">{manualBatchOffset + index + 1}.</span>
                      <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${statusDotClass(status)}`} />
                      <span className="min-w-0">
                        <span className="font-semibold text-slate-800 block truncate">{school.schoolName}</span>
                        <span className="text-[10px] text-slate-400">
                          {school.udise ? `UDISE ${school.udise}` : "No UDISE"}
                          {" · "}
                          {status === "verified"
                            ? "Verified"
                            : status === "draft"
                              ? "Draft pin"
                              : "No pin"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {currentManualBatchIndex > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setManualBatchOffset((prev) =>
                      Math.max(0, prev - MANUAL_BATCH_SIZE),
                    )
                  }
                  disabled={loading}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
                >
                  ← Previous batch (view only)
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!readOnly && resolveMode === "manual_batch" && !block && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Select a block to see schools in batches of 30.
        </p>
      )}

      {progress && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-[#ff791a]" />
          {progress}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {summary && (
        <p className="text-xs text-slate-600">
          Schools {summary.total} · Villages {summary.totalVillages} · Verified {summary.resolved} · Skipped{" "}
          {summary.skipped} · Failed {summary.failed}
        </p>
      )}

      {resolveRows.length > 0 && (
        <div className="max-h-72 overflow-auto border border-slate-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left p-2">School</th>
                <th className="text-left p-2">Result</th>
                <th className="text-left p-2">Reason</th>
                <th className="text-left p-2">Match</th>
              </tr>
            </thead>
            <tbody>
              {resolveRows.map((row) => {
                const schoolId = String(row.schoolWorkId || "");
                const status = String(row.status || "");
                return (
                  <tr key={schoolId || String(row.schoolName)} className="border-t border-slate-100">
                    <td className="p-2">
                      <p className="font-semibold text-slate-800">{String(row.schoolName || "")}</p>
                      {row.villageHint ? (
                        <p className="text-[10px] text-slate-400">
                          Village: <span className="font-medium text-slate-600">{String(row.villageHint)}</span>
                        </p>
                      ) : null}
                    </td>
                    <td className={`p-2 capitalize font-semibold ${resolveStatusClass(status)}`}>
                      {status.replace(/_/g, " ")}
                      {row.resolutionStep ? (
                        <span className="block text-[10px] font-normal text-slate-500 normal-case">
                          {resolutionStepLabel(String(row.resolutionStep))}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2 text-slate-600">
                      {String(row.message || row.failureReason || row.successReason || "—")}
                    </td>
                    <td className="p-2">
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
        <div className="flex-1 min-w-[200px] flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
            placeholder="Search village, school, or paste lat, lng"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs"
            disabled={readOnly}
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching || readOnly}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
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
        <ul className="max-h-32 overflow-auto border border-slate-100 rounded-lg text-xs divide-y divide-slate-100">
          {searchHits.map((hit) => (
            <li key={`${hit.lat}-${hit.lng}-${hit.displayName}`}>
              <button
                type="button"
                onClick={() => applySearchHit(hit)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50"
                disabled={!selectedSchool || readOnly}
              >
                {hit.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 min-h-[420px]">
        <div className="border border-slate-100 rounded-lg overflow-auto max-h-[420px]">
          {villageGroups.length === 0 ? (
            <p className="text-xs text-slate-400 p-3">Select a block to list villages.</p>
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
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${
                      selectedVillage === group.village ? "bg-orange-50" : ""
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
                      <span className="font-semibold text-slate-800">{group.village}</span>
                      <span className="text-slate-400 ml-auto">{group.schools.length}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 pl-4">
                      {group.verifiedCount} verified · {group.draftCount} draft · {group.missingCount} missing
                      {group.schools.find((s) => s.matchedPlaceName)?.matchedPlaceName && (
                        <> · Google: {group.schools.find((s) => s.matchedPlaceName)?.matchedPlaceName}</>
                      )}
                    </p>
                  </button>
                  {selectedVillage === group.village && (
                    <div className="px-2 pb-2 space-y-1">
                      {!readOnly && group.draftCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void verifyVillage(group.village)}
                          disabled={actionLoading}
                          className="w-full text-left px-2 py-1.5 rounded bg-emerald-50 text-emerald-800 font-semibold flex items-center gap-1"
                        >
                          <CheckCircle2 size={12} /> Verify whole village
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
                            className={`w-full text-left px-2 py-1.5 rounded border ${
                              selectedSchoolId === school.id
                                ? "border-[#ff791a] bg-orange-50/50"
                                : "border-transparent hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${statusDotClass(status)}`} />
                              <span>
                                <span className="font-medium text-slate-700 block">{school.schoolName}</span>
                                <span className="text-[10px] text-slate-400 block">
                                  {hasValidPin(school)
                                    ? `${school.matchedPlaceName || localityHintFromSchoolName(school.schoolName || "")} · ${locationConfidenceLabel(school.locationConfidence)}`
                                    : "No pin — run Resolve"}
                                </span>
                                {school.udise && (
                                  <span className="text-[10px] text-slate-400">UDISE {school.udise}</span>
                                )}
                              </span>
                            </div>
                            {selectedSchoolId === school.id && hasValidPin(school) && !readOnly && !school.locationVerified && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void verifySchool(school.id);
                                }}
                                disabled={actionLoading}
                                className="mt-1 ml-3 text-[10px] font-bold text-emerald-700"
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

      {selectedSchool && isUnsafeSchoolPin(selectedSchool) && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          This pin is outside Bihar or does not match district/block — likely a wrong match (e.g. Rajasthan).
          Search for the correct village in {selectedSchool.district || "district"} / {selectedSchool.block || "block"}, drag the pin, then verify.
        </p>
      )}

      {selectedSchool && (
        <p className="text-[11px] text-slate-500">
          Selected: <span className="font-semibold text-slate-700">{selectedSchool.schoolName}</span>
          {selectedSchool.matchedPlaceName && (
            <>
              {" "}
              · Google place: <span className="font-semibold">{selectedSchool.matchedPlaceName}</span>
            </>
          )}
          {hasValidPin(selectedSchool) && (
            <>
              {" "}
              · {Number(selectedSchool.lat).toFixed(5)}, {Number(selectedSchool.lng).toFixed(5)}
              {selectedSchool.locationVerified ? " · Verified" : " · Draft"}
            </>
          )}
        </p>
      )}

      <details className="text-[11px] text-slate-500 border border-slate-100 rounded-lg px-3 py-2">
        <summary className="font-semibold text-slate-600 cursor-pointer">Admin verify checklist (Amour / any block)</summary>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li>Select district + block. Use <strong>30 schools per batch</strong> mode (recommended).</li>
          <li>Review the list, click <strong>Resolve this batch</strong>, then repeat for the next 30 until done.</li>
          <li>Or switch to <strong>All schools at once</strong> for a full automatic run.</li>
          <li>Red pin = wrong district GPS (e.g. Muzaffarpur area for Purnia schools) — re-resolve or drag manually.</li>
          <li>Green = verified · Orange = draft · Pink = no pin</li>
          <li>Supervisors see village name + distance from required pin when submitting visits.</li>
        </ol>
      </details>
    </section>
  );
}
