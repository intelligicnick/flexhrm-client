import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, ChevronRight, Route, User, Maximize2, Minimize2 } from "lucide-react";
import type { SchoolSupervisor, SchoolVisit } from "../types";
import {
  buildSupervisorPaths,
  formatDistanceKm,
  type SupervisorPath,
  type SupervisorPathPeriod,
  type SupervisorPathPoint,
} from "../lib/supervisor-map-helpers";
import { formatRelativeTimeAgo } from "../lib/date-helpers";
import { getDateRangeForPeriod } from "../lib/supervisor-dates";

const INDIA_CENTER: L.LatLngExpression = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

const PERIOD_OPTIONS: { key: SupervisorPathPeriod; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

type SupervisorMapPanelProps = {
  supervisors: SchoolSupervisor[];
  visits: SchoolVisit[];
  onOpenFieldTeam?: () => void;
  layoutRevision?: string;
  variant?: "default" | "embedded";
  mapVariant?: "default" | "trajectory";
  mapHeightClass?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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
  const distanceLabel = path.distanceKm > 0 ? formatDistanceKm(path.distanceKm) : "—";

  return `
    <div style="min-width:190px;font-family:Montserrat,system-ui,sans-serif;font-size:12px;line-height:1.45">
      <strong style="font-size:13px;color:${path.color}">${escapeHtml(path.name)}</strong>
      <div style="margin-top:6px;color:#475569">
        <div style="font-weight:700;color:#0f172a">${escapeHtml(stepLabel)}</div>
        <div><span style="color:${statusColor};font-weight:700">${statusLabel}</span> · last active ${escapeHtml(lastActive)}</div>
        <div style="margin-top:4px"><strong>Est. distance:</strong> ~${escapeHtml(distanceLabel)}</div>
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

const PATH_LINE_OPTIONS = {
  smoothFactor: 0,
  noClip: true,
  lineCap: "round" as const,
  lineJoin: "round" as const,
};

export default function SupervisorMapPanel({
  supervisors,
  visits,
  onOpenFieldTeam,
  layoutRevision,
  variant = "default",
  mapVariant = "default",
  mapHeightClass,
  isFullscreen = false,
  onToggleFullscreen,
}: SupervisorMapPanelProps) {
  const embedded = variant === "embedded";
  const trajectory = mapVariant === "trajectory";
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pathRendererRef = useRef<L.Canvas | null>(null);
  const pathsLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const lastFitKeyRef = useRef<string>("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("all");
  const [showPaths, setShowPaths] = useState(true);
  const [mapWheelActive, setMapWheelActive] = useState(false);
  const [period, setPeriod] = useState<SupervisorPathPeriod>("week");

  const periodRange = useMemo(() => getDateRangeForPeriod(period), [period]);
  const paths = useMemo(
    () =>
      buildSupervisorPaths(supervisors, visits, {
        fromDate: periodRange.fromDate,
        toDate: periodRange.toDate,
      }),
    [supervisors, visits, periodRange.fromDate, periodRange.toDate],
  );
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
  const totalDistanceKm = useMemo(
    () => visiblePaths.reduce((sum, path) => sum + path.distanceKm, 0),
    [visiblePaths],
  );
  const periodLabel = useMemo(() => {
    if (period === "day") return periodRange.fromDate;
    if (period === "month" && periodRange.monthKey) {
      const [year, month] = periodRange.monthKey.split("-").map(Number);
      return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
        new Date(year, month - 1, 1),
      );
    }
    return `${periodRange.fromDate} – ${periodRange.toDate}`;
  }, [period, periodRange]);

  useEffect(() => {
    if (selectedSupervisorId === "all") return;
    if (!paths.some((path) => path.supervisorId === selectedSupervisorId)) {
      setSelectedSupervisorId("all");
    }
  }, [paths, selectedSupervisorId]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: INDIA_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: false,
      preferCanvas: true,
    });

    L.tileLayer(
      trajectory
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: "abcd",
      },
    ).addTo(map);

    pathRendererRef.current = L.canvas({ padding: 0.5 });
    pathsLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const container = map.getContainer();
    container.tabIndex = 0;

    const activateWheelZoom = () => {
      map.scrollWheelZoom.enable();
      setMapWheelActive(true);
    };

    const deactivateWheelZoom = () => {
      map.scrollWheelZoom.disable();
      setMapWheelActive(false);
    };

    container.addEventListener("click", activateWheelZoom);
    container.addEventListener("focus", activateWheelZoom);
    container.addEventListener("blur", deactivateWheelZoom);

    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (!container.contains(event.target as Node)) {
        deactivateWheelZoom();
      }
    };
    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      map.remove();
      mapRef.current = null;
      pathRendererRef.current = null;
      pathsLayerRef.current = null;
      markersLayerRef.current = null;
      lastFitKeyRef.current = "";
    };
  }, [trajectory]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(timer);
  }, [visiblePaths.length, showPaths, layoutRevision]);

  const autoFitKey = useMemo(
    () =>
      `${period}:${selectedSupervisorId}:${visiblePaths.map((path) => path.supervisorId).join(",")}`,
    [period, selectedSupervisorId, visiblePaths],
  );

  useEffect(() => {
    const map = mapRef.current;
    const pathsLayer = pathsLayerRef.current;
    const markersLayer = markersLayerRef.current;
    const pathRenderer = pathRendererRef.current;
    if (!map || !pathsLayer || !markersLayer) return;

    pathsLayer.clearLayers();
    markersLayer.clearLayers();

    if (visiblePaths.length === 0) {
      if (lastFitKeyRef.current !== autoFitKey) {
        map.setView(INDIA_CENTER, DEFAULT_ZOOM);
        lastFitKeyRef.current = autoFitKey;
      }
      return;
    }

    const bounds = L.latLngBounds([]);

    visiblePaths.forEach((path) => {
      const latLngs = path.points.map((point) => [point.lat, point.lng] as L.LatLngExpression);
      latLngs.forEach((latLng) => bounds.extend(latLng));

      if (showPaths && latLngs.length > 1) {
        const renderer = pathRenderer ?? undefined;
        L.polyline(latLngs, {
          ...PATH_LINE_OPTIONS,
          color: trajectory ? "#ffffff" : "#0f172a",
          weight: trajectory ? 9 : 7,
          opacity: trajectory ? 0.35 : 0.22,
          renderer,
        }).addTo(pathsLayer);

        L.polyline(latLngs, {
          ...PATH_LINE_OPTIONS,
          color: path.color,
          weight: trajectory ? 5 : 4,
          opacity: trajectory ? 0.95 : 0.88,
          renderer,
        }).addTo(pathsLayer);
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

    if (bounds.isValid() && lastFitKeyRef.current !== autoFitKey) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
      lastFitKeyRef.current = autoFitKey;
    }
  }, [visiblePaths, showPaths, trajectory, autoFitKey]);

  const resolvedMapHeight =
    mapHeightClass || (embedded ? "h-[calc(100dvh-11rem)]" : "h-80 md:h-[28rem]");

  return (
    <div
      className={
        embedded
          ? "text-left"
          : "bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left"
      }
    >
      <style>{`
        @keyframes supervisor-map-pulse {
          0% { transform: scale(0.85); opacity: 0.45; }
          70% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>

      <div className={`flex flex-col lg:flex-row lg:items-start justify-between gap-3 ${embedded ? "px-3 pt-2" : "mb-4"}`}>
        <div>
          {!embedded && (
            <>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <MapPin size={16} className="text-[#ff791a]" />
                Supervisor Map
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Traversed visit paths for {periodLabel} with estimated travel distance
              </p>
            </>
          )}
          {embedded && (
            <p className="text-[11px] text-slate-500">
              {periodLabel} · tap pins for supervisor details
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 cursor-pointer"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen map"}
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              {isFullscreen ? "Exit" : "Full screen"}
            </button>
          )}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                  period === option.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
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

      <div className={`flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500 ${embedded ? "px-3 mb-2" : "mb-3"}`}>
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
        <span className="inline-flex items-center gap-1 text-slate-600">
          <Route size={12} className="text-[#ff791a]" />
          ~{formatDistanceKm(totalDistanceKm)} tentative
        </span>
      </div>

      {paths.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${embedded ? "px-3 mb-2" : "mb-3"}`}>
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
              <span className="opacity-70">
                ({path.points.length} · ~{formatDistanceKm(path.distanceKm)})
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={`relative ${embedded ? "px-1" : ""}`}>
        {embedded && (
          <div className="pointer-events-none absolute inset-x-2 top-2 z-[401] flex justify-center">
            <span className="rounded-full bg-gradient-to-r from-[#0C1E4A] to-[#1a3568] px-3 py-1 text-[10px] font-bold text-white shadow-lg border border-white/10">
              Live Supervisor Map
            </span>
          </div>
        )}
        <div
          ref={mapContainerRef}
          className={`${resolvedMapHeight} w-full rounded-xl overflow-hidden border z-0 transition ${
            embedded
              ? mapWheelActive
                ? "border-[#ff791a] ring-2 ring-[#ff791a]/30 shadow-lg shadow-orange-200/40"
                : "border-slate-300 shadow-md"
              : mapWheelActive
                ? "border-[#ff791a]/50 ring-2 ring-[#ff791a]/20"
                : "border-slate-200"
          }`}
          aria-label="Supervisor traversed paths map"
        />
        {!mapWheelActive && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1.5 text-[10px] font-semibold text-white shadow-lg backdrop-blur-sm">
            Tap map to pan & zoom
          </p>
        )}
      </div>

      {paths.length === 0 ? (
        <p className={`text-xs text-slate-400 ${embedded ? "px-3 mt-2" : "mt-3"}`}>
          No supervisor visit GPS data for {periodLabel.toLowerCase()}. Paths appear after supervisors submit
          geo-tagged field visits in this period.
        </p>
      ) : (
        !embedded && (
        <p className="text-[10px] text-slate-400 mt-3">
          S = journey start · numbered stops = visit checkpoints · person icon = latest position in period · lines
          connect every GPS checkpoint in visit order · distance is straight-line estimate between GPS points (actual road distance may differ)
        </p>
        )
      )}
    </div>
  );
}
