import React, { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { locationConfidenceLabel } from "../lib/school-geofence";
import { suspiciousPlaceMatchReason } from "../lib/school-place-match";
import { SchoolWork } from "../types";

function duplicatePinWarnings(
  rows: Array<{ schoolWorkId: string; lat?: number; lng?: number }>,
  minCount = 3,
): Map<string, string> {
  const buckets = new Map<string, string[]>();
  for (const row of rows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const ids = buckets.get(key) ?? [];
    ids.push(row.schoolWorkId);
    buckets.set(key, ids);
  }
  const warnings = new Map<string, string>();
  for (const ids of buckets.values()) {
    if (ids.length < minCount) continue;
    const message = `${ids.length} schools share this pin — likely block office or bad batch match`;
    for (const id of ids) warnings.set(id, message);
  }
  return warnings;
}

function resolutionStepLabel(step?: string): string {
  if (step === "school") return "Step 1 · School on Google";
  if (step === "village") return "Step 2 · Village on Google";
  if (step === "osm_village") return "Step 3 · Village on OpenStreetMap";
  return "";
}

interface SchoolLocationResolverProps {
  schools: SchoolWork[];
  readOnly?: boolean;
}

type ResolveRow = {
  schoolWorkId: string;
  schoolName: string;
  udise: string;
  villageHint?: string;
  block: string;
  district: string;
  status: string;
  lat?: number;
  lng?: number;
  matchedPlaceName?: string;
  googleMapsUrl?: string;
  locationConfidence?: string;
  geofenceRadiusM?: number;
  formattedAddress?: string;
  locationVerified?: boolean;
  matchScore?: number;
  resolutionStep?: string;
};

export default function SchoolLocationResolver({
  schools,
  readOnly = false,
}: SchoolLocationResolverProps) {
  const [district, setDistrict] = useState("");
  const [block, setBlock] = useState("");
  const [saveVerified, setSaveVerified] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [googlePlacesReady, setGooglePlacesReady] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<{ total: number; resolved: number; skipped: number; failed: number } | null>(null);
  const [rows, setRows] = useState<ResolveRow[]>([]);

  const clusterWarnings = useMemo(() => duplicatePinWarnings(rows), [rows]);

  const districts = useMemo(
    () => Array.from(new Set(schools.map((s) => s.district).filter(Boolean))).sort(),
    [schools],
  );

  const blocks = useMemo(() => {
    let list = schools;
    if (district) list = list.filter((s) => s.district === district);
    return Array.from(new Set(list.map((s) => s.block).filter(Boolean))).sort();
  }, [schools, district]);

  const siblingBlocks = blocks;

  useEffect(() => {
    void fetch("/api/health")
      .then((res) => res.json())
      .then((data: { googlePlacesConfigured?: boolean }) => {
        setGooglePlacesReady(data.googlePlacesConfigured === true);
      })
      .catch(() => setGooglePlacesReady(null));
  }, []);

  const runResolve = async () => {
    if (!block.trim()) {
      setError("Select a block first.");
      return;
    }
    setLoading(true);
    setError(null);
    setSummary(null);
    setProgress(null);
    setRows([]);

    const batchSize = 3;
    let offset = 0;
    let total = 0;
    let resolved = 0;
    let skipped = 0;
    let failed = 0;
    const allRows: ResolveRow[] = [];

    try {
      while (true) {
        setProgress(
          total > 0
            ? `Resolving schools ${Math.min(offset + 1, total)}–${Math.min(offset + batchSize, total)} of ${total}…`
            : "Starting location lookup…",
        );

        const res = await fetch("/api/school-works/bulk-resolve-locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            block: block.trim(),
            district: district.trim() || undefined,
            saveVerified,
            skipExisting,
            limit: batchSize,
            offset,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Location resolve failed.");

        total = Number(data.total) || total;
        resolved += Number(data.resolved) || 0;
        skipped += Number(data.skipped) || 0;
        failed += Number(data.failed) || 0;
        if (Array.isArray(data.results)) {
          allRows.push(...data.results);
          setRows([...allRows]);
        }
        setSummary({ total, resolved, skipped, failed });

        if (!data.hasMore) break;
        offset = Number(data.nextOffset) || offset + batchSize;
      }
      setProgress(null);
      if (total > 0 && resolved === 0 && skipped === 0 && failed === total) {
        setError(
          googlePlacesReady === false
            ? "Google Places API key is missing on the backend. Add GOOGLE_PLACES_API_KEY in Hostinger hPanel, enable Places API (New) + Geocoding API, then redeploy."
            : "No schools matched. Check that GOOGLE_PLACES_API_KEY is valid and billing is enabled in Google Cloud, then redeploy the backend and try again.",
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Location resolve failed.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div>
        <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
          <MapPin className="text-[#ff791a]" size={18} />
          School Google Maps Pins
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          <strong>Step 1:</strong> Google Maps lookup for the school itself (100 m).{" "}
          <strong>Step 2:</strong> If not found, lookup the village from the school name (400 m).
          Block offices and wrong villages are never used. Google address must name this block and district.
        </p>
        <ol className="text-[11px] text-slate-500 mt-2 space-y-1 list-decimal list-inside">
          <li>
            Example: <span className="font-medium">GUNANAND M S BISHNUPUR</span> → try school on Google;
            if missing → pin <span className="font-medium">Bishnupur</span> village
          </li>
          <li>
            Example: <span className="font-medium">KANYA U M S BASATPUR</span> → try school; if missing → pin{" "}
            <span className="font-medium">Basatpur</span> village
          </li>
          <li>If Google misses a rural hamlet, OpenStreetMap village lookup is tried (free, no extra API cost)</li>
        </ol>
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
          Review results on the map before saving. &quot;Save as verified&quot; is off by default — turn it on only after
          spot-checking pins. Rows with 3+ schools at the same coordinates are flagged automatically.
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
            checked={saveVerified}
            onChange={(e) => setSaveVerified(e.target.checked)}
            disabled={readOnly || loading}
          />
          Save as verified
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600 pb-2">
          <input
            type="checkbox"
            checked={skipExisting}
            onChange={(e) => setSkipExisting(e.target.checked)}
            disabled={readOnly || loading}
          />
          Skip already saved
        </label>
        {!readOnly && (
          <button
            type="button"
            onClick={() => void runResolve()}
            disabled={loading || !block}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff791a] text-white text-xs font-bold disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Resolve locations
          </button>
        )}
      </div>

      {progress && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-[#ff791a]" />
          {progress}
        </p>
      )}

      {googlePlacesReady === false && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Google Places API is not configured on the backend. Add <code>GOOGLE_PLACES_API_KEY</code> in
          Hostinger hPanel and redeploy before resolving locations.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {summary && (
        <p className="text-xs text-slate-600">
          Total {summary.total} · Resolved {summary.resolved} · Skipped {summary.skipped} · Not found {summary.failed}
        </p>
      )}

      {rows.length > 0 && (
        <div className="max-h-80 overflow-auto border border-slate-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left p-2">School</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Match</th>
                <th className="text-left p-2">Map</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const suspiciousReason = suspiciousPlaceMatchReason(
                  row.schoolName,
                  row.matchedPlaceName,
                  row.block,
                  row.district,
                  row.formattedAddress,
                  siblingBlocks,
                );
                const clusterReason = clusterWarnings.get(row.schoolWorkId);
                const warnReason = suspiciousReason || clusterReason;
                return (
                <tr
                  key={row.schoolWorkId}
                  className={`border-t border-slate-100 ${warnReason ? "bg-amber-50" : ""}`}
                >
                  <td className="p-2">
                    <p className="font-semibold text-slate-800">{row.schoolName}</p>
                    <p className="text-slate-400">{row.udise}</p>
                    {row.villageHint && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Village fallback: <span className="font-medium text-slate-600">{row.villageHint}</span>
                      </p>
                    )}
                  </td>
                  <td className="p-2 capitalize">
                    {row.status.replace("_", " ")}
                    {row.resolutionStep && (
                      <span className="block text-[10px] text-slate-500 normal-case">
                        {resolutionStepLabel(row.resolutionStep)}
                      </span>
                    )}
                    {row.locationConfidence && (
                      <span className="block text-[10px] text-slate-400 normal-case">
                        {locationConfidenceLabel(row.locationConfidence)}
                        {row.matchScore != null ? ` · score ${row.matchScore}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {row.matchedPlaceName || "—"}
                    {warnReason && (
                      <span className="block text-[10px] text-amber-800 font-semibold mt-0.5">
                        {warnReason}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    {row.googleMapsUrl ? (
                      <a
                        href={row.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#ff791a] font-semibold hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
