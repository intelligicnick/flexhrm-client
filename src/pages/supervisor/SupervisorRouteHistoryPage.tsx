import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CalendarDays, MapPin, Route, Gauge, Timer } from "lucide-react";
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
  createFieldMap,
  createMapTileLayer,
  scheduleMapInvalidate,
} from "../../lib/leaflet-map-setup";
import {
  SupervisorEmptyState,
  SupervisorPageHeader,
  SupervisorSection,
  SupervisorSkeletonStatGrid,
  SupervisorStatCard,
  SupervisorStatGrid,
} from "./SupervisorUI";
import { useSupervisorI18n } from "./SupervisorI18nContext";

const PERIOD_OPTIONS: { key: RoutePeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

function drawRoute(map: L.Map, points: RoutePoint[]) {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  valid.forEach((point) => {
    L.circleMarker([point.lat, point.lng], {
      radius: 3,
      color: point.isMock ? "#ef4444" : "#ff791a",
      fillOpacity: 0.8,
    }).addTo(map);
  });
  if (valid.length >= 2) {
    L.polyline(
      valid.map((p) => [p.lat, p.lng] as [number, number]),
      { color: "#ff791a", weight: 4, opacity: 0.85 },
    ).addTo(map);
    map.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])), {
      padding: [24, 24],
    });
  } else if (valid.length === 1) {
    map.setView([valid[0].lat, valid[0].lng], 15);
  }
}

export default function SupervisorRouteHistoryPage() {
  const { t } = useSupervisorI18n();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const [period, setPeriod] = useState<RoutePeriod>("today");
  const [customDate, setCustomDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
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
    if (!mapRef.current || loading) return;
    if (!leafletRef.current) {
      leafletRef.current = createFieldMap(mapRef.current);
      createMapTileLayer().addTo(leafletRef.current);
    }
    const map = leafletRef.current;
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) return;
      map.removeLayer(layer);
    });
    drawRoute(map, points);
    scheduleMapInvalidate(map);
  }, [loading, points]);

  useEffect(() => {
    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
      }
    };
  }, []);

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
    <div className="space-y-4 pb-24">
      <SupervisorPageHeader
        title="Route history"
        subtitle="Travel path recorded on this device"
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

      <SupervisorSection title="Travel path">
        <style>{`
          .supervisor-route-map-container .leaflet-container {
            height: 100% !important;
            width: 100% !important;
            touch-action: pan-x pan-y pinch-zoom;
            transform: translateZ(0);
          }
          .supervisor-route-map-container .leaflet-pane,
          .supervisor-route-map-container .leaflet-tile-pane,
          .supervisor-route-map-container .leaflet-overlay-pane {
            z-index: 1 !important;
          }
          .supervisor-route-map-container .leaflet-top,
          .supervisor-route-map-container .leaflet-bottom {
            z-index: 2 !important;
          }
        `}</style>
        <div className="relative supervisor-route-map-container isolate z-0 overflow-hidden rounded-xl border border-slate-100">
          <div ref={mapRef} className="h-72 w-full bg-slate-100" />
        </div>
        {!loading && points.length === 0 && (
          <p className="text-xs text-slate-500 mt-3 text-center">
            No GPS points recorded for this period.
          </p>
        )}
      </SupervisorSection>
    </div>
  );
}
