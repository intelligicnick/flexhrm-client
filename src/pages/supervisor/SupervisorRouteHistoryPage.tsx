import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CalendarDays, MapPin, Route, Gauge, Timer, Info } from "lucide-react";
import {
  formatDistanceKm,
  formatDuration,
  getRoutePeriodBounds,
  readNativeRoutePoints,
  readNativeRouteSummary,
  type RoutePeriod,
  type RoutePoint,
} from "../../lib/supervisor-route-history";
import { isFlexHrmNativeApp } from "../../lib/supervisor-installed-apps";
import {
  attachMapResizeObserver,
  attachMapVisibilityObserver,
  createFieldMap,
  createMapTileLayer,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  scheduleMapInvalidate,
  waitForMapContainerSize,
} from "../../lib/leaflet-map-setup";
import {
  SupervisorEmptyState,
  SupervisorPageHeader,
  SupervisorSection,
  SupervisorSkeletonStatGrid,
  SupervisorStatCard,
  SupervisorStatGrid,
} from "./SupervisorUI";

const PERIOD_OPTIONS: { key: RoutePeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

const MAX_ROUTE_MARKERS = 120;
const MAX_MAP_POINTS = 1500;

function isValidRouteCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001)
  );
}

function filterRoutePointsForMap(points: RoutePoint[]): RoutePoint[] {
  const valid = points.filter((p) => isValidRouteCoord(p.lat, p.lng));
  if (valid.length <= 2) return valid;

  const sortedLat = valid.map((p) => p.lat).sort((a, b) => a - b);
  const sortedLng = valid.map((p) => p.lng).sort((a, b) => a - b);
  const mid = Math.floor(valid.length / 2);
  const latMed = sortedLat[mid] ?? valid[0].lat;
  const lngMed = sortedLng[mid] ?? valid[0].lng;
  const cosLat = Math.cos((latMed * Math.PI) / 180);

  return valid.filter((p) => {
    const dy = (p.lat - latMed) * 111_000;
    const dx = (p.lng - lngMed) * 111_000 * cosLat;
    return Math.hypot(dx, dy) <= 50_000;
  });
}

function sampleRoutePoints(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= MAX_ROUTE_MARKERS) return points;
  const step = Math.ceil(points.length / MAX_ROUTE_MARKERS);
  const sampled: RoutePoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]);
  }
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

function drawRoute(layerGroup: L.LayerGroup, points: RoutePoint[]) {
  const valid = filterRoutePointsForMap(points);
  if (valid.length === 0) return;

  if (valid.length >= 2) {
    L.polyline(
      valid.map((p) => [p.lat, p.lng] as [number, number]),
      { color: "#ff791a", weight: 4, opacity: 0.85 },
    ).addTo(layerGroup);

    const start = valid[0];
    const end = valid[valid.length - 1];
    L.circleMarker([start.lat, start.lng], {
      radius: 6,
      color: "#16a34a",
      fillColor: "#22c55e",
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip("Start", { permanent: false })
      .addTo(layerGroup);
    L.circleMarker([end.lat, end.lng], {
      radius: 6,
      color: "#ff791a",
      fillColor: "#fb923c",
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip("Latest", { permanent: false })
      .addTo(layerGroup);

    return valid;
  }

  L.circleMarker([valid[0].lat, valid[0].lng], {
    radius: 6,
    color: valid[0].isMock ? "#ef4444" : "#ff791a",
    fillOpacity: 0.9,
  }).addTo(layerGroup);
  return valid;
}

export default function SupervisorRouteHistoryPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const [period, setPeriod] = useState<RoutePeriod>("today");
  const [customDate, setCustomDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [summary, setSummary] = useState<ReturnType<typeof readNativeRouteSummary>>(null);

  const bounds = useMemo(
    () => getRoutePeriodBounds(period, customDate),
    [period, customDate],
  );

  useEffect(() => {
    if (!isFlexHrmNativeApp()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      setPoints(readNativeRoutePoints(bounds.fromMs, bounds.toMs));
      setSummary(readNativeRouteSummary(bounds.fromMs, bounds.toMs));
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bounds.fromMs, bounds.toMs]);

  useEffect(() => {
    if (!isFlexHrmNativeApp() || !mapRef.current) return;

    let cancelled = false;
    let detachResize = () => undefined;
    let detachVisibility = () => undefined;

    void (async () => {
      const sized = await waitForMapContainerSize(mapRef.current!);
      if (!sized || cancelled || !mapRef.current) return;

      if (!leafletRef.current) {
        leafletRef.current = createFieldMap(mapRef.current);
        createMapTileLayer().addTo(leafletRef.current);
        routeLayerRef.current = L.layerGroup().addTo(leafletRef.current);
        detachResize = attachMapResizeObserver(leafletRef.current, mapRef.current);
        detachVisibility = attachMapVisibilityObserver(leafletRef.current, mapRef.current);
        scheduleMapInvalidate(leafletRef.current, 50);
        scheduleMapInvalidate(leafletRef.current, 250);
      }

      if (!cancelled) setMapReady(true);
    })();

    return () => {
      cancelled = true;
      detachResize();
      detachVisibility();
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
        routeLayerRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !leafletRef.current || !routeLayerRef.current || loading) return;

    routeLayerRef.current.clearLayers();
    const mapPoints = sampleRoutePoints(filterRoutePointsForMap(points).slice(0, MAX_MAP_POINTS));
    const valid = drawRoute(routeLayerRef.current, mapPoints);
    const map = leafletRef.current;
    if (valid && valid.length >= 2) {
      map.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [24, 24],
        maxZoom: 17,
      });
    } else if (valid && valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 15);
    } else {
      map.setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM);
    }
    scheduleMapInvalidate(map, 0);
    scheduleMapInvalidate(map, 200);
  }, [mapReady, loading, points]);

  if (!isFlexHrmNativeApp()) {
    return (
      <SupervisorEmptyState
        icon={Route}
        title="Route history"
        hint="Open the Field Team Android app to view GPS route history."
      />
    );
  }

  return (
    <div className="space-y-4 pb-32">
      <SupervisorPageHeader
        title="Route history"
        subtitle="Travel path recorded on this device while you are logged in"
      />

      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setPeriod(option.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
              period === option.key
                ? "bg-[#ff791a] text-white border-[#ff791a]"
                : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <CalendarDays size={16} />
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 bg-white"
          />
        </label>
      )}

      {loading ? (
        <SupervisorSkeletonStatGrid />
      ) : (
        <SupervisorStatGrid>
          <SupervisorStatCard
            icon={Route}
            label="Distance"
            value={formatDistanceKm(summary?.totalDistanceMeters ?? 0)}
          />
          <SupervisorStatCard
            icon={Timer}
            label="Travel time"
            value={formatDuration(summary?.travelTimeMs ?? 0)}
            accent="blue"
          />
          <SupervisorStatCard
            icon={Gauge}
            label="Avg speed"
            value={`${(summary?.averageSpeedKmh ?? 0).toFixed(1)} km/h`}
            accent="emerald"
          />
          <SupervisorStatCard
            icon={MapPin}
            label="GPS points"
            value={summary?.pointCount ?? points.length}
            accent="slate"
          />
        </SupervisorStatGrid>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5 text-[#ff791a]" />
        <p className="text-[11px] text-slate-600 leading-relaxed">
          <span className="font-bold text-slate-800">GPS points</span> are location snapshots recorded
          by the app while you are logged in — typically every 15–30 seconds when moving, or every
          2–5 minutes when stationary. They form your travel line on the map and are used to calculate
          distance and time on the field.
        </p>
      </div>

      <SupervisorSection title="Travel path">
        <style>{`
          .supervisor-route-map-container {
            position: relative;
            isolation: isolate;
            z-index: 0;
            overflow: hidden;
          }
          .supervisor-route-map-container .leaflet-container {
            height: 100% !important;
            width: 100% !important;
            min-height: 18rem;
            touch-action: pan-x pan-y pinch-zoom;
          }
        `}</style>
        <div className="relative supervisor-route-map-container mb-2 rounded-xl border border-slate-100 bg-slate-100">
          <div ref={mapRef} className="h-72 w-full" />
          {!mapReady && (
            <div className="absolute inset-0 z-[3] flex items-center justify-center bg-slate-100 text-xs text-slate-500">
              Loading map…
            </div>
          )}
        </div>
        {!loading && points.length === 0 && (
          <p className="text-xs text-slate-500 mt-3 text-center">
            No GPS points recorded for this period. Keep location on and stay logged in while travelling.
          </p>
        )}
      </SupervisorSection>
    </div>
  );
}
