import React, { useMemo, useState } from "react";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { SchoolWork } from "../types";

interface SchoolLocationResolverProps {
  schools: SchoolWork[];
  readOnly?: boolean;
}

type ResolveRow = {
  schoolWorkId: string;
  schoolName: string;
  udise: string;
  block: string;
  district: string;
  status: string;
  lat?: number;
  lng?: number;
  matchedPlaceName?: string;
  googleMapsUrl?: string;
  locationConfidence?: string;
  geofenceRadiusM?: number;
  locationVerified?: boolean;
};

export default function SchoolLocationResolver({
  schools,
  readOnly = false,
}: SchoolLocationResolverProps) {
  const [district, setDistrict] = useState("");
  const [block, setBlock] = useState("");
  const [saveVerified, setSaveVerified] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ total: number; resolved: number; skipped: number; failed: number } | null>(null);
  const [rows, setRows] = useState<ResolveRow[]>([]);

  const districts = useMemo(
    () => Array.from(new Set(schools.map((s) => s.district).filter(Boolean))).sort(),
    [schools],
  );

  const blocks = useMemo(() => {
    let list = schools;
    if (district) list = list.filter((s) => s.district === district);
    return Array.from(new Set(list.map((s) => s.block).filter(Boolean))).sort();
  }, [schools, district]);

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
            skipExisting: true,
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
          One-time lookup per school using Google Places. Saves verified pins for visit geofencing.
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
              {rows.map((row) => (
                <tr key={row.schoolWorkId} className="border-t border-slate-100">
                  <td className="p-2">
                    <p className="font-semibold text-slate-800">{row.schoolName}</p>
                    <p className="text-slate-400">{row.udise}</p>
                  </td>
                  <td className="p-2 capitalize">{row.status.replace("_", " ")}</td>
                  <td className="p-2">
                    {row.matchedPlaceName || "—"}
                    {row.locationConfidence && (
                      <span className="block text-[10px] text-slate-400">{row.locationConfidence}</span>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
