import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CheckCircle2, Loader2, MapPin, RefreshCw, Search } from "lucide-react";
import {
  attachMapResizeObserver,
  attachMapVisibilityObserver,
  createFieldMap,
  createMapTileLayer,
  scheduleMapInvalidate,
  waitForMapContainerSize,
} from "../lib/leaflet-map-setup";
import { localityHintFromSchoolName } from "../lib/school-place-match";
import { locationConfidenceLabel } from "../lib/school-geofence";
import { formatNetworkFetchError } from "../api";
import { SchoolWork } from "../types";

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
  const [overrides, setOverrides] = useState<Record<string, Partial<SchoolWork>>>({});
  const [selectedVillage, setSelectedVillage] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const dragMarkerRef = useRef<L.Marker | null>(null);

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

  const runAutoPin = async () => {
    if (!block.trim()) {
      setError("Select a block first.");
      return;
    }
    setLoading(true);
    setError(null);
    setSummary(null);
    setProgress(null);

    let villageOffset = 0;
    let total = 0;
    let totalVillages = 0;
    let resolved = 0;
    let skipped = 0;
    let failed = 0;
    let villagesResolved = 0;

    try {
      while (true) {
        setProgress(
          totalVillages > 0
            ? `Auto-pinning villages ${Math.min(villageOffset + 1, totalVillages)}–${Math.min(villageOffset + 2, totalVillages)} of ${totalVillages} (${total} schools)…`
            : "Starting village lookup (OpenStreetMap)…",
        );

        const res = await fetchWithRetry("/api/school-works/bulk-assign-village-locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            block: block.trim(),
            district: district.trim() || undefined,
            saveDraft: true,
            skipExisting,
            villageLimit: 2,
            villageOffset,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Village auto-pin failed.");

        total = Number(data.total) || total;
        totalVillages = Number(data.totalVillages) || totalVillages;
        resolved += Number(data.resolved) || 0;
        skipped += Number(data.skipped) || 0;
        failed += Number(data.failed) || 0;
        villagesResolved += Number(data.villagesResolved) || 0;

        if (Array.isArray(data.results)) {
          for (const row of data.results) {
            const schoolId = String(row.schoolWorkId || "");
            if (!schoolId) continue;
            if (row.status === "draft" || row.status === "resolved") {
              patchOverride(schoolId, {
                lat: Number(row.lat),
                lng: Number(row.lng),
                matchedPlaceName: String(row.matchedPlaceName || ""),
                locationConfidence: String(row.locationConfidence || "village"),
                locationVerified: false,
                geofenceRadiusM: Number(row.geofenceRadiusM) || 400,
                googleMapsUrl: String(row.googleMapsUrl || ""),
                locationSource: String(row.locationSource || ""),
              });
            }
          }
        }

        setSummary({ total, totalVillages, resolved, skipped, failed, villagesResolved });
        if (!data.hasMore) break;
        villageOffset = Number(data.nextVillageOffset ?? data.nextOffset) || villageOffset + 2;
      }
      setProgress(null);
      if (skipExisting && resolved === 0 && skipped > 0 && failed === 0) {
        setError(
          "All schools were skipped because they already have pins. Uncheck “Skip schools with existing pins” to replace old Google pins with village pins.",
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Village auto-pin failed.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
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
    if (mapRef.current) {
      mapRef.current.flyTo([hit.lat, hit.lng], 15, { duration: 0.6 });
    }
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

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let detachResize: (() => void) | undefined;
    let detachVisibility: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const sized = await waitForMapContainerSize(container);
      if (!sized || cancelled) return;

      if (!mapRef.current) {
        mapRef.current = createFieldMap(container);
        createMapTileLayer().addTo(mapRef.current);
        markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
        detachResize = attachMapResizeObserver(mapRef.current, container);
        detachVisibility = attachMapVisibilityObserver(mapRef.current, container);
        scheduleMapInvalidate(mapRef.current, 50);
      }
    })();

    return () => {
      cancelled = true;
      detachResize?.();
      detachVisibility?.();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    dragMarkerRef.current = null;

    for (const group of villageGroups) {
      if (!Number.isFinite(group.lat) || !Number.isFinite(group.lng)) continue;
      const isSelectedVillage = selectedVillage === group.village;
      const marker = L.circleMarker([group.lat!, group.lng!], {
        radius: isSelectedVillage ? 9 : 6,
        color: group.verifiedCount === group.schools.length ? "#10b981" : "#f59e0b",
        fillColor: group.verifiedCount === group.schools.length ? "#10b981" : "#f59e0b",
        fillOpacity: 0.85,
        weight: isSelectedVillage ? 3 : 1,
      });
      marker.bindTooltip(`${group.village} (${group.schools.length} schools)`);
      marker.on("click", () => {
        setSelectedVillage(group.village);
        setSelectedSchoolId(group.schools[0]?.id ?? null);
      });
      marker.addTo(layer);
    }

    if (selectedSchool && hasValidPin(selectedSchool)) {
      const lat = Number(selectedSchool.lat);
      const lng = Number(selectedSchool.lng);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${
          selectedSchool.locationVerified ? "#10b981" : "#f59e0b"
        };border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const dragMarker = L.marker([lat, lng], {
        icon,
        draggable: !readOnly,
        zIndexOffset: 1000,
      });
      dragMarker.bindTooltip(selectedSchool.schoolName || "School pin");
      if (!readOnly) {
        dragMarker.on("dragend", () => {
          const pos = dragMarker.getLatLng();
          void saveDraftPin(
            selectedSchool.id,
            pos.lat,
            pos.lng,
            selectedSchool.matchedPlaceName,
          );
        });
      }
      dragMarker.addTo(layer);
      dragMarkerRef.current = dragMarker;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
    } else if (selectedVillage) {
      const group = villageGroups.find((g) => g.village === selectedVillage);
      if (group?.lat != null && group.lng != null) {
        map.flyTo([group.lat, group.lng], Math.max(map.getZoom(), 13), { duration: 0.5 });
      }
    }

    scheduleMapInvalidate(map, 0);
  }, [villageGroups, selectedSchool, selectedVillage, readOnly]);

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div>
        <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
          <MapPin className="text-[#ff791a]" size={18} />
          Village-First School Locations
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Auto-pins the <strong>village</strong> from each school name (400 m geofence). Review on the map,
          drag to correct, then verify. Exact Google school pins (100 m) are optional upgrades.
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
          Skip schools with existing pins (uncheck to replace old pins)
        </label>
        {!readOnly && (
          <button
            type="button"
            onClick={() => void runAutoPin()}
            disabled={loading || !block}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff791a] text-white text-xs font-bold disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Auto-pin villages
          </button>
        )}
      </div>

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
          Schools {summary.total} · Villages {summary.totalVillages} · Draft pinned {summary.resolved} · Skipped{" "}
          {summary.skipped} · Not found {summary.failed} · Villages geocoded {summary.villagesResolved}
        </p>
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
                                <span className="text-[10px] text-slate-400">
                                  {hasValidPin(school)
                                    ? locationConfidenceLabel(school.locationConfidence)
                                    : "No pin"}
                                </span>
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

        <div
          ref={mapContainerRef}
          className="rounded-lg border border-slate-200 min-h-[420px] h-[420px] w-full overflow-hidden"
        />
      </div>

      {selectedSchool && (
        <p className="text-[11px] text-slate-500">
          Selected: <span className="font-semibold text-slate-700">{selectedSchool.schoolName}</span>
          {hasValidPin(selectedSchool) && (
            <>
              {" "}
              · {Number(selectedSchool.lat).toFixed(5)}, {Number(selectedSchool.lng).toFixed(5)}
              {selectedSchool.locationVerified ? " · Verified" : " · Draft — drag pin or search to correct, then verify"}
            </>
          )}
        </p>
      )}

      <details className="text-[11px] text-slate-500 border border-slate-100 rounded-lg px-3 py-2">
        <summary className="font-semibold text-slate-600 cursor-pointer">Admin verify checklist (Amour / any block)</summary>
        <ol className="mt-2 space-y-1 list-decimal list-inside">
          <li>Select district + block, click <strong>Auto-pin villages</strong> (uncheck skip if re-running).</li>
          <li>Orange markers = draft village pins. Open a village and spot-check 2–3 schools.</li>
          <li>Click <strong>Open in Google Maps</strong> — confirm the pin is in the correct village, not block office.</li>
          <li>Drag the pin on the map if the village centroid is wrong, or use <strong>Search</strong> (village name or lat, lng).</li>
          <li>Verify one school or <strong>Verify whole village</strong> when the location looks right.</li>
          <li>Supervisors can submit visits only after a school is <strong>verified</strong> (green).</li>
          <li>Villages that show &quot;missing&quot; need manual search — OSM often has no tiny hamlets.</li>
        </ol>
      </details>
    </section>
  );
}
