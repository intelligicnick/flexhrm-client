import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapPin, ChevronRight, Route, User } from "lucide-react";
import type { SchoolSupervisor, SchoolVisit } from "../types";
import {
  buildSupervisorPaths,
  type SupervisorPath,
  type SupervisorPathPoint,
} from "../lib/supervisor-map-helpers";
import { formatRelativeTimeAgo } from "../lib/date-helpers";

const INDIA_CENTER: L.LatLngExpression = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

type SupervisorMapPanelProps = {
  supervisors: SchoolSupervisor[];
  visits: SchoolVisit[];
  onOpenFieldTeam?: () => void;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPointPopupHtml(path: SupervisorPath, point: SupervisorPathPoint): string {
  const statusLabel = path.isOnline ? "Online" : "Offline";
  const statusColor = path.isOnline ? "#16a34a" : "#64748b";
  const location = point.locationLabel?.trim() || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
  const lastActive = path.lastActiveAt ? formatRelativeTimeAgo(path.lastActiveAt) : "—";
  const stepLabel = point.step === path.points.length ? "Current position" : `Stop ${point.step}`;

  return `
    <div style="min-width:190px;font-family:Montserrat,system-ui,sans-serif;font-size:12px;line-height:1.45">
      <strong style="font-size:13px;color:${path.color}">${escapeHtml(path.name)}</strong>
      <div style="margin-top:6px;color:#475569">
        <div style="font-weight:700;color:#0f172a">${escapeHtml(stepLabel)}</div>
        <div><span style="color:${statusColor};font-weight:700">${statusLabel}</span> · last active ${escapeHtml(lastActive)}</div>
        <div style="margin-top:4px"><strong>Date:</strong> ${escapeHtml(point.visitDate)}</div>
        <div><strong>School:</strong> ${escapeHtml(point.schoolName || "—")}</div>
        <div style="margin-top:4px"><strong>Location:</strong> ${escapeHtml(location)}</div>
      </div>
    </div>
  `;
}

function createPersonIcon(color: string, isOnline: boolean): L.DivIcon {
  const pulse = isOnline
    ? `<span style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid ${color};opacity:0.35;animation:supervisor-map-pulse 2s ease-out infinite"></span>`
    : "";

  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
    html: `
      <div style="position:relative;width:36px;height:36px">
        ${pulse}
        <div style="position:relative;width:36px;height:36px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 4px 10px rgba(15,23,42,0.25);display:flex;align-items:center;justify-content:center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="7" r="3.5"></circle>
            <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"></path>
          </svg>
        </div>
      </div>
    `,
  });
}

function createStepIcon(color: string, step: number, isStart: boolean): L.DivIcon {
  const size = isStart ? 22 : 18;
  const bg = isStart ? "#0f172a" : color;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -10],
    html: `
      <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bg};color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,0.2);display:flex;align-items:center;justify-content:center;font-size:${isStart ? 9 : 8}px;font-weight:800;font-family:Montserrat,system-ui,sans-serif">
        ${isStart ? "S" : step}
      </div>
    `,
  });
}

function midpoint(a: L.LatLngExpression, b: L.LatLngExpression): L.LatLngExpression {
  const aa = L.latLng(a);
  const bb = L.latLng(b);
  return [(aa.lat + bb.lat) / 2, (aa.lng + bb.lng) / 2];
}

function segmentBearing(a: L.LatLngExpression, b: L.LatLngExpression): number {
  const aa = L.latLng(a);
  const bb = L.latLng(b);
  const dy = bb.lat - aa.lat;
  const dx = bb.lng - aa.lng;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

function createArrowIcon(color: string, rotationDeg: number): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `
      <div style="width:14px;height:14px;display:flex;align-items:center;justify-content:center;transform:rotate(${rotationDeg}deg)">
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid ${color};opacity:0.85"></div>
      </div>
    `,
  });
}

export default function SupervisorMapPanel({
  supervisors,
  visits,
  onOpenFieldTeam,
}: SupervisorMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pathsLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("all");
  const [showPaths, setShowPaths] = useState(true);

  const paths = useMemo(() => buildSupervisorPaths(supervisors, visits), [supervisors, visits]);
  const visiblePaths = useMemo(
    () =>
      selectedSupervisorId === "all"
        ? paths
        : paths.filter((path) => path.supervisorId === selectedSupervisorId),
    [paths, selectedSupervisorId],
  );

  const activeSupervisorCount = useMemo(
    () => supervisors.filter((supervisor) => supervisor.status !== "inactive").length,
    [supervisors],
  );
  const onlineCount = useMemo(
    () => supervisors.filter((supervisor) => supervisor.status !== "inactive" && supervisor.isOnline).length,
    [supervisors],
  );
  const totalStops = useMemo(
    () => visiblePaths.reduce((sum, path) => sum + path.points.length, 0),
    [visiblePaths],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: INDIA_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    pathsLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      pathsLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const pathsLayer = pathsLayerRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !pathsLayer || !markersLayer) return;

    pathsLayer.clearLayers();
    markersLayer.clearLayers();

    if (visiblePaths.length === 0) {
      map.setView(INDIA_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds([]);

    visiblePaths.forEach((path) => {
      const latLngs = path.points.map((point) => [point.lat, point.lng] as L.LatLngExpression);

      latLngs.forEach((latLng) => bounds.extend(latLng));

      if (showPaths && latLngs.length > 1) {
        L.polyline(latLngs, {
          color: path.color,
          weight: 4,
          opacity: 0.82,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(pathsLayer);

        for (let i = 0; i < latLngs.length - 1; i += 1) {
          const from = latLngs[i];
          const to = latLngs[i + 1];
          const arrowPoint = midpoint(from, to);
          const rotation = segmentBearing(from, to);
          L.marker(arrowPoint, {
            icon: createArrowIcon(path.color, rotation),
            interactive: false,
          }).addTo(pathsLayer);
        }
      }

      path.points.forEach((point, index) => {
        const isLatest = index === path.points.length - 1;
        const isStart = index === 0;

        if (isLatest) {
          const personMarker = L.marker([point.lat, point.lng], {
            icon: createPersonIcon(path.color, !!path.isOnline),
            zIndexOffset: 1000,
          });
          personMarker.bindPopup(buildPointPopupHtml(path, point));
          personMarker.addTo(markersLayer);
          return;
        }

        const stepMarker = L.marker([point.lat, point.lng], {
          icon: createStepIcon(path.color, point.step, isStart),
          zIndexOffset: 500,
        });
        stepMarker.bindPopup(buildPointPopupHtml(path, point));
        stepMarker.addTo(markersLayer);
      });
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    }
  }, [visiblePaths, showPaths]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left">
      <style>{`
        @keyframes supervisor-map-pulse {
          0% { transform: scale(0.85); opacity: 0.45; }
          70% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <MapPin size={16} className="text-[#ff791a]" />
            Supervisor Map
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Traversed visit paths with person markers at each supervisor&apos;s latest position
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
            <Route size={12} />
            <select
              value={selectedSupervisorId}
              onChange={(event) => setSelectedSupervisorId(event.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-700"
            >
              <option value="all">All supervisors</option>
              {paths.map((path) => (
                <option key={path.supervisorId} value={path.supervisorId}>
                  {path.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showPaths}
              onChange={(event) => setShowPaths(event.target.checked)}
              className="rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a]/30"
            />
            Show paths
          </label>
          {onOpenFieldTeam && (
            <button
              type="button"
              onClick={onOpenFieldTeam}
              className="text-[10px] font-bold text-[#ff791a] flex items-center gap-0.5 hover:gap-1 transition-all cursor-pointer"
            >
              Field Team <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500 mb-3">
        <span className="inline-flex items-center gap-1.5">
          <User size={12} className="text-emerald-600" />
          Online ({onlineCount})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <User size={12} className="text-[#ff791a]" />
          Offline ({Math.max(activeSupervisorCount - onlineCount, 0)})
        </span>
        <span>{paths.length} supervisors with GPS trails</span>
        <span>{totalStops} mapped stops</span>
      </div>

      {paths.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {paths.map((path) => (
            <button
              key={path.supervisorId}
              type="button"
              onClick={() =>
                setSelectedSupervisorId((current) =>
                  current === path.supervisorId ? "all" : path.supervisorId,
                )
              }
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold transition cursor-pointer ${
                selectedSupervisorId === path.supervisorId
                  ? "border-slate-800 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-white shadow-sm shrink-0"
                style={{ backgroundColor: path.color }}
              />
              {path.name}
              <span className="opacity-70">({path.points.length})</span>
            </button>
          ))}
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="h-80 md:h-[28rem] w-full rounded-xl overflow-hidden border border-slate-200 z-0"
        aria-label="Supervisor traversed paths map"
      />

      {paths.length === 0 ? (
        <p className="text-xs text-slate-400 mt-3">
          No supervisor visit GPS data yet. Paths appear after supervisors submit geo-tagged field visits.
        </p>
      ) : (
        <p className="text-[10px] text-slate-400 mt-3">
          S = journey start · numbered stops = visit checkpoints · person icon = latest position · arrows show travel direction
        </p>
      )}
    </div>
  );
}
