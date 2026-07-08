import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  ChevronRight,
  Route,
  User,
  Maximize2,
  Minimize2,
  Users,
  Building2,
  Navigation,
  RefreshCw,
  Lock,
  Unlock,
  MapPinned,
} from "lucide-react";
import type { Employee, SchoolSupervisor, SchoolVisit } from "../types";
import {
  buildSupervisorLiveLocations,
  buildSupervisorPaths,
  formatDistanceKm,
  SUPERVISOR_PATH_COLORS,
  type SupervisorLiveLocation,
  type SupervisorPath,
  type SupervisorPathPeriod,
  type SupervisorPathPoint,
} from "../lib/supervisor-map-helpers";
import {
  fetchEmployeePunchPins,
  fetchMapGeofences,
  todayIsoDate,
  type EmployeePunchPin,
  type FieldTrackingLayer,
  type MapGeofence,
} from "../lib/field-tracking-helpers";
import { formatRelativeTimeAgo } from "../lib/date-helpers";
import {
  attachMapInteractionHandlers,
  attachMapResizeObserver,
  attachMapVisibilityObserver,
  createFieldMap,
  createMapTileLayer,
  isTouchMapDevice,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_ATTRIBUTION_SIMPLE,
  MAP_TILE_URL,
  MAP_TILE_URL_SIMPLE,
  scheduleMapInvalidate,
  waitForMapContainerSize,
} from "../lib/leaflet-map-setup";
import { getDateRangeForPeriod, todayIsoInKolkata } from "../lib/supervisor-dates";
import {
  dedupeMapLabels,
  resolveEmployeePinMapLabel,
  resolveMapMarkerLabel,
  resolveSupervisorLiveMapLabel,
  resolveSupervisorPointMapLabel,
} from "../lib/map-location-labels";

type TrailPeriod = SupervisorPathPeriod | "custom";

const PERIOD_OPTIONS: { key: TrailPeriod; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

const LAYER_OPTIONS: { key: FieldTrackingLayer; label: string; icon: typeof User }[] = [
  { key: "supervisors", label: "Supervisors", icon: User },
  { key: "employees", label: "Staff GPS", icon: Users },
  { key: "all", label: "All", icon: Navigation },
];

type FieldTrackingMapProps = {
  supervisors: SchoolSupervisor[];
  visits: SchoolVisit[];
  employees?: Employee[];
  showEmployeeTracking?: boolean;
  onOpenFieldTeam?: () => void;
  layoutRevision?: string;
  variant?: "default" | "embedded";
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

function buildSupervisorPopupHtml(location: SupervisorLiveLocation): string {
  const statusLabel = location.isOnline ? "Online" : "Offline";
  const statusColor = location.isOnline ? "#16a34a" : "#64748b";
  const place =
    resolveMapMarkerLabel({
      schoolName: location.schoolName,
      locationLabel: location.locationLabel,
      lat: location.lat,
      lng: location.lng,
    }) || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  const lastActive = location.lastActiveAt ? formatRelativeTimeAgo(location.lastActiveAt) : "—";

  return `
    <div style="min-width:200px;font-family:Montserrat,system-ui,sans-serif;font-size:12px;line-height:1.45">
      <strong style="font-size:13px;color:${location.color}">${escapeHtml(location.name)}</strong>
      <div style="margin-top:6px;color:#475569">
        <div><span style="color:${statusColor};font-weight:700">${statusLabel}</span> · last active ${escapeHtml(lastActive)}</div>
        <div style="margin-top:4px"><strong>Last visit:</strong> ${escapeHtml(location.visitDate)}</div>
        <div><strong>School:</strong> ${escapeHtml(location.schoolName || "—")}</div>
        <div style="margin-top:4px"><strong>Village / street:</strong> ${escapeHtml(place)}</div>
      </div>
    </div>
  `;
}

function buildPointPopupHtml(path: SupervisorPath, point: SupervisorPathPoint): string {
  const statusLabel = path.isOnline ? "Online" : "Offline";
  const statusColor = path.isOnline ? "#16a34a" : "#64748b";
  const location =
    resolveMapMarkerLabel({
      schoolName: point.schoolName,
      locationLabel: point.locationLabel,
      lat: point.lat,
      lng: point.lng,
      step: point.step,
    }) || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
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
        <div style="margin-top:4px"><strong>Village / street:</strong> ${escapeHtml(location)}</div>
      </div>
    </div>
  `;
}

function buildEmployeePopupHtml(pin: EmployeePunchPin): string {
  const punchLabel = pin.punchType === "in" ? "Check In" : "Check Out";
  const punchColor = pin.punchType === "in" ? "#16a34a" : "#dc2626";
  const geoStatus = pin.withinGeofence
    ? '<span style="color:#16a34a;font-weight:700">Within geofence</span>'
    : '<span style="color:#dc2626;font-weight:700">Outside geofence</span>';
  const time = new Date(pin.punchedAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const place =
    resolveMapMarkerLabel({
      locationName: pin.locationName,
      address: pin.address,
      lat: pin.lat,
      lng: pin.lng,
    }) || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;

  return `
    <div style="min-width:200px;font-family:Montserrat,system-ui,sans-serif;font-size:12px;line-height:1.45">
      <strong style="font-size:13px;color:#0C1E4A">${escapeHtml(pin.employeeName)}</strong>
      <div style="margin-top:4px;color:#64748b;font-weight:600">${escapeHtml(pin.employeeCode)} · ${escapeHtml(pin.locationName)}</div>
      <div style="margin-top:6px;color:#475569">
        <div><span style="color:${punchColor};font-weight:700">${punchLabel}</span> · ${escapeHtml(time)}</div>
        <div style="margin-top:4px">${geoStatus}</div>
        <div style="margin-top:4px"><strong>Village / street:</strong> ${escapeHtml(place)}</div>
      </div>
    </div>
  `;
}

function createSupervisorIcon(color: string, isOnline: boolean): L.DivIcon {
  const pulse = isOnline
    ? `<span style="position:absolute;inset:-5px;border-radius:9999px;border:2px solid ${color};opacity:0.4;animation:field-map-pulse 2s ease-out infinite"></span>`
    : "";

  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
    html: `
      <div style="position:relative;width:40px;height:40px">
        ${pulse}
        <div style="position:relative;width:40px;height:40px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 4px 14px rgba(15,23,42,0.28);display:flex;align-items:center;justify-content:center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="7" r="3.5"></circle>
            <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"></path>
          </svg>
        </div>
      </div>
    `,
  });
}

function createEmployeeIcon(punchType: "in" | "out"): L.DivIcon {
  const bg = punchType === "in" ? "#059669" : "#dc2626";
  const label = punchType === "in" ? "IN" : "OUT";
  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
    html: `
      <div style="width:32px;height:32px;border-radius:10px;background:${bg};border:2px solid #fff;box-shadow:0 3px 10px rgba(15,23,42,0.22);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#fff;font-family:Montserrat,system-ui,sans-serif">
        ${label}
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

function drawRoutePolyline(
  latLngs: L.LatLngExpression[],
  color: string,
  pathsLayer: L.LayerGroup,
): void {
  if (latLngs.length < 2) return;
  L.polyline(latLngs, {
    ...PATH_LINE_OPTIONS,
    color: "#94a3b8",
    weight: 8,
    opacity: 0.35,
  }).addTo(pathsLayer);
  L.polyline(latLngs, {
    ...PATH_LINE_OPTIONS,
    color,
    weight: 4,
    opacity: 0.9,
  }).addTo(pathsLayer);
}

type EmployeeDayRoute = {
  employeeId: string;
  employeeName: string;
  color: string;
  latLngs: L.LatLngExpression[];
};

const LOCATION_TOOLTIP_OPTIONS: L.TooltipOptions = {
  permanent: true,
  direction: "top",
  offset: [0, -14],
  className: "field-map-location-label",
};

function bindLocationTooltip(
  marker: L.Marker | L.Circle,
  label: string,
  show: boolean,
): void {
  if (!show || !label) return;
  marker.bindTooltip(label, {
    ...LOCATION_TOOLTIP_OPTIONS,
    opacity: 0.95,
  });
}

function buildEmployeeDayRoutes(pins: EmployeePunchPin[]): EmployeeDayRoute[] {
  const byEmployee = new Map<string, EmployeePunchPin[]>();
  for (const pin of pins) {
    const bucket = byEmployee.get(pin.employeeId) || [];
    bucket.push(pin);
    byEmployee.set(pin.employeeId, bucket);
  }
  const routes: EmployeeDayRoute[] = [];
  let colorIndex = 0;
  for (const [employeeId, employeePins] of byEmployee.entries()) {
    const sorted = [...employeePins].sort((a, b) => a.punchedAt.localeCompare(b.punchedAt));
    if (sorted.length < 2) continue;
    routes.push({
      employeeId,
      employeeName: sorted[0].employeeName,
      color: SUPERVISOR_PATH_COLORS[colorIndex % SUPERVISOR_PATH_COLORS.length],
      latLngs: sorted.map((pin) => [pin.lat, pin.lng] as L.LatLngExpression),
    });
    colorIndex += 1;
  }
  return routes;
}

export default function FieldTrackingMap({
  supervisors,
  visits,
  employees = [],
  showEmployeeTracking = true,
  onOpenFieldTeam,
  layoutRevision,
  variant = "default",
  mapHeightClass,
  isFullscreen = false,
  onToggleFullscreen,
}: FieldTrackingMapProps) {
  const embedded = variant === "embedded";
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);
  const pathsLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const lastFitKeyRef = useRef<string>("");
  const userInteractedRef = useRef(false);
  const touchDevice = useMemo(() => isTouchMapDevice(), []);

  const useInternalFullscreen = !onToggleFullscreen;
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const activeFullscreen = useInternalFullscreen ? internalFullscreen : isFullscreen;
  const handleToggleFullscreen = () => {
    if (onToggleFullscreen) onToggleFullscreen();
    else setInternalFullscreen((value) => !value);
  };

  const [layer, setLayer] = useState<FieldTrackingLayer>("supervisors");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [showPaths, setShowPaths] = useState(true);
  const [lockView, setLockView] = useState(false);
  const [showLocationLabels, setShowLocationLabels] = useState(true);
  const [showDetailedMapLabels, setShowDetailedMapLabels] = useState(true);
  const [period, setPeriod] = useState<TrailPeriod>("day");
  const [trailFromDate, setTrailFromDate] = useState(todayIsoInKolkata());
  const [trailToDate, setTrailToDate] = useState(todayIsoInKolkata());
  const [trackingDate, setTrackingDate] = useState(todayIsoDate());
  const [punchPins, setPunchPins] = useState<EmployeePunchPin[]>([]);
  const [geofences, setGeofences] = useState<MapGeofence[]>([]);
  const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);

  const showSupervisors = layer === "supervisors" || layer === "all";
  const showEmployees = showEmployeeTracking && (layer === "employees" || layer === "all");

  const periodRange = useMemo(() => {
    if (period === "custom") {
      const fromDate = trailFromDate <= trailToDate ? trailFromDate : trailToDate;
      const toDate = trailFromDate <= trailToDate ? trailToDate : trailFromDate;
      return { fromDate, toDate };
    }
    return getDateRangeForPeriod(period);
  }, [period, trailFromDate, trailToDate]);
  const paths = useMemo(
    () =>
      buildSupervisorPaths(supervisors, visits, {
        fromDate: periodRange.fromDate,
        toDate: periodRange.toDate,
      }),
    [supervisors, visits, periodRange.fromDate, periodRange.toDate],
  );
  const liveLocations = useMemo(
    () => buildSupervisorLiveLocations(supervisors, visits, paths),
    [supervisors, visits, paths],
  );
  const visiblePaths = useMemo(
    () =>
      selectedSupervisorId === "all"
        ? paths
        : paths.filter((path) => path.supervisorId === selectedSupervisorId),
    [paths, selectedSupervisorId],
  );
  const visibleLiveLocations = useMemo(
    () =>
      selectedSupervisorId === "all"
        ? liveLocations
        : liveLocations.filter((loc) => loc.supervisorId === selectedSupervisorId),
    [liveLocations, selectedSupervisorId],
  );

  const employeeSummaries = useMemo(() => {
    const byEmployee = new Map<
      string,
      { employeeId: string; employeeName: string; lat: number; lng: number; color: string }
    >();
    let colorIndex = 0;
    const sortedPins = [...punchPins].sort((a, b) => a.punchedAt.localeCompare(b.punchedAt));
    for (const pin of sortedPins) {
      const color =
        byEmployee.get(pin.employeeId)?.color ??
        SUPERVISOR_PATH_COLORS[colorIndex % SUPERVISOR_PATH_COLORS.length];
      if (!byEmployee.has(pin.employeeId)) colorIndex += 1;
      byEmployee.set(pin.employeeId, {
        employeeId: pin.employeeId,
        employeeName: pin.employeeName,
        lat: pin.lat,
        lng: pin.lng,
        color,
      });
    }
    return Array.from(byEmployee.values());
  }, [punchPins]);

  const visiblePunchPins = useMemo(
    () =>
      selectedEmployeeId === "all"
        ? punchPins
        : punchPins.filter((pin) => pin.employeeId === selectedEmployeeId),
    [punchPins, selectedEmployeeId],
  );

  const employeeRouteCount = useMemo(
    () => buildEmployeeDayRoutes(visiblePunchPins).length,
    [visiblePunchPins],
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
    if (period === "custom") {
      return periodRange.fromDate === periodRange.toDate
        ? periodRange.fromDate
        : `${periodRange.fromDate} – ${periodRange.toDate}`;
    }
    if (period === "day") return periodRange.fromDate;
    if (period === "month" && periodRange.monthKey) {
      const [year, month] = periodRange.monthKey.split("-").map(Number);
      return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
        new Date(year, month - 1, 1),
      );
    }
    return `${periodRange.fromDate} – ${periodRange.toDate}`;
  }, [period, periodRange]);

  const loadEmployeeTrackingData = useCallback(async () => {
    if (!showEmployeeTracking) return;
    setLoadingEmployeeData(true);
    try {
      const [pins, fences] = await Promise.all([
        fetchEmployeePunchPins(trackingDate, employees),
        fetchMapGeofences(),
      ]);
      setPunchPins(pins);
      setGeofences(fences);
    } catch {
      setPunchPins([]);
      setGeofences([]);
    } finally {
      setLoadingEmployeeData(false);
    }
  }, [showEmployeeTracking, trackingDate, employees]);

  useEffect(() => {
    if (!showEmployees) return;
    void loadEmployeeTrackingData();
  }, [showEmployees, loadEmployeeTrackingData]);

  useEffect(() => {
    if (selectedSupervisorId === "all") return;
    if (!liveLocations.some((loc) => loc.supervisorId === selectedSupervisorId)) {
      setSelectedSupervisorId("all");
    }
  }, [liveLocations, selectedSupervisorId]);

  useEffect(() => {
    if (selectedEmployeeId === "all") return;
    if (!employeeSummaries.some((emp) => emp.employeeId === selectedEmployeeId)) {
      setSelectedEmployeeId("all");
    }
  }, [employeeSummaries, selectedEmployeeId]);

  useEffect(() => {
    const containerEl = mapContainerRef.current;
    if (!containerEl || mapRef.current) return;

    let cancelled = false;
    let detachResize = () => undefined;
    let detachInteraction = () => undefined;
    let detachVisibility = () => undefined;

    void (async () => {
      await waitForMapContainerSize(containerEl);
      if (cancelled || mapRef.current) return;

      const map = createFieldMap(containerEl);
      const tileLayer = createMapTileLayer(showDetailedMapLabels);
      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

      geofenceLayerRef.current = L.layerGroup().addTo(map);
      pathsLayerRef.current = L.layerGroup().addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      const markUserInteracted = () => {
        userInteractedRef.current = true;
      };
      map.on("dragstart", markUserInteracted);
      map.on("zoomstart", markUserInteracted);

      detachResize = attachMapResizeObserver(map, containerEl);
      detachInteraction = attachMapInteractionHandlers(map);
      detachVisibility = attachMapVisibilityObserver(map, containerEl);
      scheduleMapInvalidate(map, 80);
      scheduleMapInvalidate(map, 300);
    })();

    return () => {
      cancelled = true;
      const map = mapRef.current;
      if (map) {
        map.remove();
      }
      mapRef.current = null;
      geofenceLayerRef.current = null;
      pathsLayerRef.current = null;
      markersLayerRef.current = null;
      lastFitKeyRef.current = "";
      userInteractedRef.current = false;
      detachResize();
      detachInteraction();
      detachVisibility();
    };
  }, []);

  useEffect(() => {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) return;
    tileLayer.setUrl(showDetailedMapLabels ? MAP_TILE_URL : MAP_TILE_URL_SIMPLE);
    tileLayer.options.attribution = showDetailedMapLabels
      ? MAP_TILE_ATTRIBUTION
      : MAP_TILE_ATTRIBUTION_SIMPLE;
    tileLayer.options.subdomains = showDetailedMapLabels ? "abc" : "abcd";
    const map = mapRef.current;
    if (map) scheduleMapInvalidate(map, 80);
  }, [showDetailedMapLabels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    scheduleMapInvalidate(map, 120);
  }, [visiblePaths.length, showPaths, layoutRevision, activeFullscreen, layer, visiblePunchPins.length]);

  const flyTo = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    userInteractedRef.current = true;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
    scheduleMapInvalidate(map, 350);
  }, []);

  const autoFitKey = useMemo(
    () =>
      `${layer}:${period}:${trackingDate}:${selectedSupervisorId}:${selectedEmployeeId}:${visiblePaths.length}:${visiblePunchPins.length}:${visibleLiveLocations.length}`,
    [
      layer,
      period,
      trackingDate,
      selectedSupervisorId,
      selectedEmployeeId,
      visiblePaths.length,
      visiblePunchPins.length,
      visibleLiveLocations.length,
    ],
  );

  const viewAllStaffRoutes = useCallback(() => {
    setLayer("employees");
    setSelectedEmployeeId("all");
    setShowPaths(true);
    if (!lockView) {
      userInteractedRef.current = false;
      lastFitKeyRef.current = "";
    }
  }, [lockView]);

  const employeePinLabels = useMemo(
    () =>
      dedupeMapLabels(
        visiblePunchPins.map((pin) => ({
          key: pin.id,
          label: resolveEmployeePinMapLabel(pin),
          lat: pin.lat,
          lng: pin.lng,
        })),
      ),
    [visiblePunchPins],
  );

  const supervisorStepLabels = useMemo(
    () =>
      dedupeMapLabels(
        visiblePaths.flatMap((path) =>
          path.points
            .filter((_, index) => index !== path.points.length - 1)
            .map((point) => ({
              key: `${path.supervisorId}-${point.visitId}-${point.step}`,
              label: resolveSupervisorPointMapLabel(point),
              step: point.step,
              lat: point.lat,
              lng: point.lng,
            })),
        ),
      ),
    [visiblePaths],
  );

  const supervisorLiveLabels = useMemo(
    () =>
      dedupeMapLabels(
        visibleLiveLocations.map((loc) => ({
          key: loc.supervisorId,
          label: resolveSupervisorLiveMapLabel(loc),
          lat: loc.lat,
          lng: loc.lng,
        })),
      ),
    [visibleLiveLocations],
  );

  useEffect(() => {
    const geofenceLayer = geofenceLayerRef.current;
    const pathsLayer = pathsLayerRef.current;
    const markersLayer = markersLayerRef.current;
    if (!geofenceLayer || !pathsLayer || !markersLayer) return;

    geofenceLayer.clearLayers();
    pathsLayer.clearLayers();
    markersLayer.clearLayers();

    if (showEmployees) {
      for (const fence of geofences) {
        const circle = L.circle([fence.lat, fence.lng], {
          radius: fence.radiusMeters,
          color: "#0C1E4A",
          fillColor: "#0C1E4A",
          fillOpacity: 0.08,
          weight: 2,
          dashArray: "4 6",
        });
        circle.bindPopup(
          `<strong>${escapeHtml(fence.name)}</strong><br/>${escapeHtml(fence.location || "")}<br/>Radius: ${fence.radiusMeters}m`,
        );
        bindLocationTooltip(circle, fence.location || fence.name, showLocationLabels);
        circle.addTo(geofenceLayer);

        const fenceMarker = L.marker([fence.lat, fence.lng], {
          icon: L.divIcon({
            className: "",
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            html: `<div style="width:28px;height:28px;border-radius:8px;background:#0C1E4A;border:2px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,0.2);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6"/></svg></div>`,
          }),
        }).bindPopup(`<strong>${escapeHtml(fence.name)}</strong>`);
        bindLocationTooltip(fenceMarker, fence.name, showLocationLabels);
        fenceMarker.addTo(markersLayer);
      }

      for (const pin of visiblePunchPins) {
        const marker = L.marker([pin.lat, pin.lng], {
          icon: createEmployeeIcon(pin.punchType),
          zIndexOffset: 800,
        });
        marker.bindPopup(buildEmployeePopupHtml(pin));
        bindLocationTooltip(
          marker,
          employeePinLabels.get(pin.id) || resolveEmployeePinMapLabel(pin),
          showLocationLabels,
        );
        marker.addTo(markersLayer);
      }

      if (showPaths) {
        for (const route of buildEmployeeDayRoutes(visiblePunchPins)) {
          drawRoutePolyline(route.latLngs, route.color, pathsLayer);
        }
      }
    }

    if (showSupervisors) {
      visiblePaths.forEach((path) => {
        if (showPaths) {
          for (const segment of path.segments) {
            const segmentLatLngs = segment.points.map(
              (point) => [point.lat, point.lng] as L.LatLngExpression,
            );
            drawRoutePolyline(segmentLatLngs, path.color, pathsLayer);
          }
        }

        path.points.forEach((point, index) => {
          const isLatest = index === path.points.length - 1;
          const isStart = index === 0;
          if (isLatest) return;

          const labelKey = `${path.supervisorId}-${point.visitId}-${point.step}`;
          const stepMarker = L.marker([point.lat, point.lng], {
            icon: createStepIcon(path.color, point.step, isStart),
            zIndexOffset: 500,
          });
          stepMarker.bindPopup(buildPointPopupHtml(path, point));
          bindLocationTooltip(
            stepMarker,
            supervisorStepLabels.get(labelKey) || resolveSupervisorPointMapLabel(point),
            showLocationLabels,
          );
          stepMarker.addTo(markersLayer);
        });
      });

      visibleLiveLocations.forEach((location) => {
        const marker = L.marker([location.lat, location.lng], {
          icon: createSupervisorIcon(location.color, !!location.isOnline),
          zIndexOffset: 1000,
        });
        marker.bindPopup(buildSupervisorPopupHtml(location));
        bindLocationTooltip(
          marker,
          supervisorLiveLabels.get(location.supervisorId) || resolveSupervisorLiveMapLabel(location),
          showLocationLabels,
        );
        marker.addTo(markersLayer);
      });
    }
  }, [
    visiblePaths,
    visibleLiveLocations,
    showPaths,
    showSupervisors,
    showEmployees,
    geofences,
    visiblePunchPins,
    showLocationLabels,
    employeePinLabels,
    supervisorStepLabels,
    supervisorLiveLabels,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lockView || userInteractedRef.current) return;
    if (lastFitKeyRef.current === autoFitKey) return;

    const bounds = L.latLngBounds([]);
    if (showEmployees) {
      for (const fence of geofences) bounds.extend([fence.lat, fence.lng]);
      for (const pin of visiblePunchPins) bounds.extend([pin.lat, pin.lng]);
    }
    if (showSupervisors) {
      for (const path of visiblePaths) {
        for (const point of path.points) bounds.extend([point.lat, point.lng]);
      }
      for (const loc of visibleLiveLocations) bounds.extend([loc.lat, loc.lng]);
    }

    if (!bounds.isValid()) {
      map.setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM);
    } else {
      map.fitBounds(bounds, { padding: [52, 52], maxZoom: 15, animate: false });
    }
    lastFitKeyRef.current = autoFitKey;
    scheduleMapInvalidate(map, 150);
  }, [
    autoFitKey,
    lockView,
    showEmployees,
    showSupervisors,
    geofences,
    visiblePunchPins,
    visiblePaths,
    visibleLiveLocations,
  ]);

  useEffect(() => {
    if (lockView) return;
    userInteractedRef.current = false;
    lastFitKeyRef.current = "";
  }, [lockView, layer, period, trailFromDate, trailToDate, selectedSupervisorId, selectedEmployeeId]);

  useEffect(() => {
    if (!activeFullscreen) return;
    const map = mapRef.current;
    if (!map) return;
    scheduleMapInvalidate(map, 200);
    scheduleMapInvalidate(map, 500);
  }, [activeFullscreen]);

  const resolvedMapHeight =
    mapHeightClass ||
    (activeFullscreen && useInternalFullscreen
      ? "h-[calc(100dvh-12rem)]"
      : embedded
        ? "h-[calc(100dvh-11rem)]"
        : "h-80 md:h-[32rem]");

  const layerOptions = showEmployeeTracking
    ? LAYER_OPTIONS
    : LAYER_OPTIONS.filter((option) => option.key === "supervisors");

  const rootClassName =
    useInternalFullscreen && activeFullscreen
      ? "fixed inset-0 z-50 bg-[#f4f6f9] overflow-y-auto p-4 text-left"
      : embedded
        ? "text-left"
        : "bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left";

  return (
    <div className={rootClassName}>
      <style>{`
        @keyframes field-map-pulse {
          0% { transform: scale(0.85); opacity: 0.45; }
          70% { transform: scale(1.2); opacity: 0; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        .field-tracking-map-container .leaflet-container {
          font-family: Montserrat, system-ui, sans-serif;
          background: #e2e8f0;
          height: 100% !important;
          width: 100% !important;
          touch-action: none;
          -webkit-tap-highlight-color: transparent;
          transform: translateZ(0);
        }
        .field-tracking-map-container .leaflet-tile-pane {
          transform: translateZ(0);
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
        .field-tracking-map-container .leaflet-tile {
          image-rendering: auto;
        }
        .field-tracking-map-container .leaflet-pane,
        .field-tracking-map-container .leaflet-tile-pane,
        .field-tracking-map-container .leaflet-overlay-pane {
          z-index: 1;
        }
        .field-tracking-map-container .leaflet-top,
        .field-tracking-map-container .leaflet-bottom {
          z-index: 500;
        }
        .field-tracking-map-container .leaflet-div-icon {
          background: transparent;
          border: none;
        }
        .field-tracking-map-container .field-map-location-label {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 2px 7px;
          font-size: 10px;
          font-weight: 700;
          color: #334155;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
          white-space: nowrap;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .field-tracking-map-container .field-map-location-label::before {
          border-top-color: rgba(255, 255, 255, 0.96);
        }
      `}</style>

      <div className={`flex flex-col lg:flex-row lg:items-start justify-between gap-3 ${embedded ? "px-3 pt-2" : "mb-4"}`}>
        <div>
          {!embedded && (
            <>
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <MapPin size={16} className="text-[#ff791a]" />
                Field Tracking Map
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                OpenStreetMap (India villages & streets) · supervisor trails & staff GPS
              </p>
            </>
          )}
          {embedded && (
            <p className="text-[11px] text-slate-500">
              OpenStreetMap · village & street names from OSM · tap markers for details
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 cursor-pointer"
          >
            {activeFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {activeFullscreen ? "Exit full screen" : "Full screen"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLockView((value) => {
                const next = !value;
                if (next) userInteractedRef.current = true;
                return next;
              });
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
              lockView
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            title="Keep the current zoom and position when data refreshes"
          >
            {lockView ? <Lock size={12} /> : <Unlock size={12} />}
            {lockView ? "Map locked" : "Stable map"}
          </button>
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showLocationLabels}
              onChange={(event) => setShowLocationLabels(event.target.checked)}
              className="rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a]/30"
            />
            Location names
          </label>
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showDetailedMapLabels}
              onChange={(event) => setShowDetailedMapLabels(event.target.checked)}
              className="rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a]/30"
            />
            Village & street map
          </label>
          {showEmployeeTracking && (
            <button
              type="button"
              onClick={() => void loadEmployeeTrackingData()}
              disabled={loadingEmployeeData}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={12} className={loadingEmployeeData ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
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

      <div className={`flex flex-wrap gap-2 ${embedded ? "px-3 mb-2" : "mb-3"}`}>
        {layerOptions.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setLayer(key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition cursor-pointer ${
              layer === key
                ? "border-[#0C1E4A] bg-[#0C1E4A] text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {showSupervisors && (
        <div className={`flex flex-wrap items-center gap-2 ${embedded ? "px-3 mb-2" : "mb-3"}`}>
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
              {liveLocations.map((loc) => (
                <option key={loc.supervisorId} value={loc.supervisorId}>
                  {loc.name}
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
            Show route lines
          </label>
        </div>
      )}

      {showSupervisors && period === "custom" && (
        <div className={`flex flex-wrap items-center gap-2 ${embedded ? "px-3 mb-2" : "mb-3"}`}>
          <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
            From
            <input
              type="date"
              value={trailFromDate}
              onChange={(event) => setTrailFromDate(event.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-700"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
            To
            <input
              type="date"
              value={trailToDate}
              onChange={(event) => setTrailToDate(event.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-700"
            />
          </label>
          <span className="text-[10px] text-slate-400">{periodLabel}</span>
        </div>
      )}

      {showEmployees && (
        <div className={`flex flex-wrap items-center gap-2 ${embedded ? "px-3 mb-2" : "mb-3"}`}>
          <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
            <Building2 size={12} />
            Staff GPS date
            <input
              type="date"
              value={trackingDate}
              onChange={(event) => setTrackingDate(event.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-700"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showPaths}
              onChange={(event) => setShowPaths(event.target.checked)}
              className="rounded border-slate-300 text-[#ff791a] focus:ring-[#ff791a]/30"
            />
            Show staff routes
          </label>
          <button
            type="button"
            onClick={viewAllStaffRoutes}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#ff791a]/30 bg-[#fff7ed] text-[10px] font-bold text-[#c2410c] cursor-pointer hover:border-[#ff791a]/50"
          >
            <MapPinned size={12} />
            View all staff routes
          </button>
        </div>
      )}

      <div className={`flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500 ${embedded ? "px-3 mb-2" : "mb-3"}`}>
        {showSupervisors && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <User size={12} className="text-emerald-600" />
              Online ({onlineCount})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User size={12} className="text-slate-400" />
              Offline ({Math.max(activeSupervisorCount - onlineCount, 0)})
            </span>
            <span>{visibleLiveLocations.length} on map</span>
            <span>{totalStops} trail stops · ~{formatDistanceKm(totalDistanceKm)} · {periodLabel}</span>
          </>
        )}
        {showEmployees && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Users size={12} className="text-[#ff791a]" />
              {visiblePunchPins.length} GPS punches
            </span>
            <span>{employeeRouteCount} staff routes</span>
            <span>{geofences.length} geofences</span>
          </>
        )}
      </div>

      {showEmployees && employeeSummaries.length > 0 && (
        <div className={`flex flex-wrap gap-2 max-h-24 overflow-y-auto ${embedded ? "px-3 mb-2" : "mb-3"}`}>
          {employeeSummaries.map((emp) => (
            <button
              key={emp.employeeId}
              type="button"
              onClick={() => {
                setSelectedEmployeeId((current) =>
                  current === emp.employeeId ? "all" : emp.employeeId,
                );
                flyTo(emp.lat, emp.lng);
              }}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold transition cursor-pointer ${
                selectedEmployeeId === emp.employeeId
                  ? "border-slate-800 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-white shadow-sm shrink-0"
                style={{ backgroundColor: emp.color }}
              />
              {emp.employeeName}
            </button>
          ))}
        </div>
      )}

      {showSupervisors && liveLocations.length > 0 && (
        <div className={`flex flex-wrap gap-2 max-h-24 overflow-y-auto ${embedded ? "px-3 mb-2" : "mb-3"}`}>
          {liveLocations.map((loc) => (
            <button
              key={loc.supervisorId}
              type="button"
              onClick={() => {
                setSelectedSupervisorId((current) =>
                  current === loc.supervisorId ? "all" : loc.supervisorId,
                );
                flyTo(loc.lat, loc.lng);
              }}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold transition cursor-pointer ${
                selectedSupervisorId === loc.supervisorId
                  ? "border-slate-800 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-white shadow-sm shrink-0"
                style={{ backgroundColor: loc.color }}
              />
              {loc.name}
              <span className={`${loc.isOnline ? "text-emerald-300" : "opacity-60"}`}>
                {loc.isOnline ? "●" : "○"}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={`relative field-tracking-map-container rounded-xl border border-slate-200 shadow-sm overflow-hidden ${embedded ? "mx-1" : ""}`}>
        {embedded && (
          <div className="pointer-events-none absolute inset-x-2 top-2 z-[401] flex justify-center">
            <span className="rounded-full bg-gradient-to-r from-[#0C1E4A] to-[#1a3568] px-3 py-1 text-[10px] font-bold text-white shadow-lg border border-white/10">
              Live Field Tracking
            </span>
          </div>
        )}
        <div
          ref={mapContainerRef}
          className={`${resolvedMapHeight} w-full z-0`}
          style={{ minHeight: embedded ? 280 : 320 }}
          aria-label="Field tracking map"
        />
        {touchDevice && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1.5 text-[10px] font-semibold text-white shadow-lg backdrop-blur-sm z-[402]">
            Pinch or drag to move the map
          </p>
        )}
      </div>

      {showEmployees && visiblePunchPins.length > 0 && (
        <div className={`mt-3 space-y-1.5 max-h-36 overflow-y-auto ${embedded ? "px-3" : ""}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Staff punches · {trackingDate}</p>
          {visiblePunchPins.slice(0, 12).map((pin) => (
            <button
              key={pin.id}
              type="button"
              onClick={() => flyTo(pin.lat, pin.lng)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-left hover:border-[#ff791a]/30 cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{pin.employeeName}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {pin.punchType === "in" ? "Check in" : "Check out"} · {resolveEmployeePinMapLabel(pin)}
                </p>
              </div>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black ${
                  pin.punchType === "in" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}
              >
                {pin.punchType.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}

      {showSupervisors && liveLocations.length === 0 && !showEmployees && (
        <p className={`text-xs text-slate-400 ${embedded ? "px-3 mt-2" : "mt-3"}`}>
          No supervisor GPS data yet. Positions appear after geo-tagged field visits are submitted.
        </p>
      )}

      {showEmployees && punchPins.length === 0 && !loadingEmployeeData && liveLocations.length === 0 && (
        <p className={`text-xs text-slate-400 ${embedded ? "px-3 mt-2" : "mt-3"}`}>
          No GPS punch data for {trackingDate}. Staff locations appear when employees punch in/out with GPS enabled.
        </p>
      )}

      {!embedded && (
        <p className="text-[10px] text-slate-400 mt-3">
          Supervisors: person icon = last known visit GPS · numbered stops = trail checkpoints · Staff: IN/OUT badges =
          attendance punch locations · colored lines = staff day routes · dashed circles = office geofences · use
          Stable map to lock zoom while exploring
        </p>
      )}
    </div>
  );
}
