import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SchoolWork } from "../types";
import { localityHintFromSchoolName, isUnsafeSchoolPin } from "../lib/school-place-match";
import {
  attachFieldMapLayerControl,
  attachMapResizeObserver,
  attachMapVisibilityObserver,
  createFieldMap,
  scheduleMapInvalidate,
  waitForMapContainerSize,
} from "../lib/leaflet-map-setup";

function hasValidPin(school: SchoolWork): boolean {
  const lat = Number(school.lat);
  const lng = Number(school.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function markerColor(school: SchoolWork): string {
  if (!hasValidPin(school)) return "#f87171";
  if (isUnsafeSchoolPin(school)) return "#dc2626";
  if (school.locationVerified) return "#10b981";
  return "#f59e0b";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortPlaceLabel(value: string, max = 22): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function displayLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return trimmed;
  return trimmed.toLowerCase().replace(/\b([a-z])/g, (ch) => ch.toUpperCase());
}

type VillageCluster = {
  key: string;
  village: string;
  lat: number;
  lng: number;
  schoolCount: number;
  hasSelected: boolean;
};

type LabelSlot = { offsetX: number; offsetY: number };

const LABEL_WIDTH = 112;
const LABEL_HEIGHT = 24;
/** Pixel offsets tried in order when packing village names without overlap. */
const LABEL_SLOTS: LabelSlot[] = [
  { offsetX: 0, offsetY: -20 },
  { offsetX: 26, offsetY: -14 },
  { offsetX: -26, offsetY: -14 },
  { offsetX: 34, offsetY: 2 },
  { offsetX: -34, offsetY: 2 },
  { offsetX: 0, offsetY: 22 },
  { offsetX: 28, offsetY: 18 },
  { offsetX: -28, offsetY: 18 },
  { offsetX: 48, offsetY: -8 },
  { offsetX: -48, offsetY: -8 },
];

function rectsOverlap(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number },
  pad = 4,
): boolean {
  return !(
    a.x2 + pad < b.x1 ||
    a.x1 - pad > b.x2 ||
    a.y2 + pad < b.y1 ||
    a.y1 - pad > b.y2
  );
}

function buildVillageClusters(
  schools: SchoolWork[],
  selectedSchoolId: string | null,
): VillageCluster[] {
  const groups = new Map<string, SchoolWork[]>();
  for (const school of schools) {
    if (!hasValidPin(school)) continue;
    const village =
      localityHintFromSchoolName(school.schoolName || "") ||
      String(school.matchedPlaceName || "").trim() ||
      "(unknown)";
    const list = groups.get(village) ?? [];
    list.push(school);
    groups.set(village, list);
  }

  return [...groups.entries()].map(([village, groupSchools]) => {
    const lat =
      groupSchools.reduce((sum, s) => sum + Number(s.lat), 0) / groupSchools.length;
    const lng =
      groupSchools.reduce((sum, s) => sum + Number(s.lng), 0) / groupSchools.length;
    return {
      key: village,
      village,
      lat,
      lng,
      schoolCount: groupSchools.length,
      hasSelected: groupSchools.some((s) => s.id === selectedSchoolId),
    };
  });
}

function schoolDotIcon(school: SchoolWork, isSelected: boolean): L.DivIcon {
  const color = markerColor(school);
  const size = isSelected ? 14 : 10;
  const ring = isSelected ? "0 0 0 3px rgba(255,121,26,.35)" : "0 1px 4px rgba(0,0,0,.35)";
  return L.divIcon({
    className: "school-pin-dot",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:${ring};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function villageLabelIcon(
  village: string,
  schoolCount: number,
  emphasized: boolean,
): L.DivIcon {
  const text = shortPlaceLabel(displayLabel(village), emphasized ? 26 : 20);
  const count =
    schoolCount > 1
      ? `<span style="opacity:.8;font-weight:600;margin-left:3px;">·${schoolCount}</span>`
      : "";
  const bg = emphasized ? "rgba(255,121,26,.96)" : "rgba(15,23,42,.93)";
  const shadow = emphasized
    ? "0 2px 8px rgba(255,121,26,.35)"
    : "0 1px 5px rgba(0,0,0,.35)";

  return L.divIcon({
    className: "village-map-label",
    html: `<div style="
        width:${LABEL_WIDTH}px;
        text-align:center;
        background:${bg};
        color:#fff;
        font-size:${emphasized ? 11 : 10}px;
        font-weight:800;
        letter-spacing:.01em;
        line-height:1.15;
        padding:4px 8px;
        border-radius:7px;
        box-shadow:${shadow};
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        pointer-events:none;
        text-shadow:0 1px 1px rgba(0,0,0,.28);
        border:1px solid rgba(255,255,255,.2);
        box-sizing:border-box;
      ">${escapeHtml(text)}${count}</div>`,
    iconSize: [LABEL_WIDTH, LABEL_HEIGHT],
    iconAnchor: [LABEL_WIDTH / 2, LABEL_HEIGHT / 2],
  });
}

function selectedSchoolLabelIcon(schoolName: string): L.DivIcon {
  const text = shortPlaceLabel(displayLabel(schoolName), 28);
  return L.divIcon({
    className: "school-selected-label",
    html: `<div style="
        display:flex;flex-direction:column;align-items:center;pointer-events:none;
      ">
        <div style="
          max-width:140px;text-align:center;background:#fff;color:#0f172a;
          font-size:10px;font-weight:700;line-height:1.2;padding:3px 7px;border-radius:6px;
          box-shadow:0 2px 8px rgba(15,23,42,.2);border:1px solid rgba(255,121,26,.45);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        ">${escapeHtml(text)}</div>
        <div style="width:2px;height:6px;background:#ff791a;opacity:.7;"></div>
      </div>`,
    iconSize: [140, 28],
    iconAnchor: [70, 28],
  });
}

function placeVillageLabels(
  map: L.Map,
  clusters: VillageCluster[],
): Array<VillageCluster & { labelLat: number; labelLng: number }> {
  const zoom = map.getZoom();
  // Prefer denser villages / selected first so their labels win good slots.
  const sorted = [...clusters].sort((a, b) => {
    if (a.hasSelected !== b.hasSelected) return a.hasSelected ? -1 : 1;
    return b.schoolCount - a.schoolCount || a.village.localeCompare(b.village);
  });

  // At low zoom keep the map readable; zoom in to reveal more names.
  const maxLabels = zoom >= 15 ? 90 : zoom >= 13 ? 55 : zoom >= 11 ? 32 : 18;
  const occupied: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const placed: Array<VillageCluster & { labelLat: number; labelLng: number }> = [];

  for (const cluster of sorted) {
    if (placed.length >= maxLabels && !cluster.hasSelected) continue;

    const point = map.latLngToContainerPoint([cluster.lat, cluster.lng]);
    let chosenPoint: L.Point | null = null;

    for (const slot of LABEL_SLOTS) {
      const cx = point.x + slot.offsetX;
      const cy = point.y + slot.offsetY;
      const rect = {
        x1: cx - LABEL_WIDTH / 2,
        y1: cy - LABEL_HEIGHT / 2,
        x2: cx + LABEL_WIDTH / 2,
        y2: cy + LABEL_HEIGHT / 2,
      };
      if (occupied.some((other) => rectsOverlap(rect, other))) continue;
      chosenPoint = L.point(cx, cy);
      occupied.push(rect);
      break;
    }

    // Selected village always gets a label even if crowded.
    if (!chosenPoint && cluster.hasSelected) {
      const slot = LABEL_SLOTS[0];
      chosenPoint = L.point(point.x + slot.offsetX, point.y + slot.offsetY);
    }
    if (!chosenPoint) continue;

    const latLng = map.containerPointToLatLng(chosenPoint);
    placed.push({ ...cluster, labelLat: latLng.lat, labelLng: latLng.lng });
  }

  return placed;
}

interface SchoolLeafletMapProps {
  schools: SchoolWork[];
  selectedSchoolId: string | null;
  readOnly?: boolean;
  onSelectSchool: (schoolId: string) => void;
  onDragPin?: (schoolId: string, lat: number, lng: number) => void;
}

export default function SchoolLeafletMap({
  schools,
  selectedSchoolId,
  readOnly = false,
  onSelectSchool,
  onDragPin,
}: SchoolLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const schoolLayerRef = useRef<L.LayerGroup | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const dragMarkerRef = useRef<L.Marker | null>(null);
  const mapReadyRef = useRef(false);
  const schoolsRef = useRef(schools);
  const selectedRef = useRef(selectedSchoolId);
  const onSelectRef = useRef(onSelectSchool);
  const fittedKeyRef = useRef<string>("");

  schoolsRef.current = schools;
  selectedRef.current = selectedSchoolId;
  onSelectRef.current = onSelectSchool;

  const redrawVillageLabels = () => {
    const map = mapRef.current;
    const labelLayer = labelLayerRef.current;
    if (!map || !labelLayer) return;

    labelLayer.clearLayers();
    const clusters = buildVillageClusters(schoolsRef.current, selectedRef.current);
    const placed = placeVillageLabels(map, clusters);

    for (const item of placed) {
      const marker = L.marker([item.labelLat, item.labelLng], {
        icon: villageLabelIcon(item.village, item.schoolCount, item.hasSelected),
        interactive: false,
        keyboard: false,
        zIndexOffset: item.hasSelected ? 800 : 400,
      });
      marker.addTo(labelLayer);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let detachResize: (() => void) | undefined;
    let detachVisibility: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const sized = await waitForMapContainerSize(container);
      if (!sized || cancelled) return;

      if (!mapRef.current) {
        const map = createFieldMap(container);
        mapRef.current = map;
        attachFieldMapLayerControl(map, "streets");
        schoolLayerRef.current = L.layerGroup().addTo(map);
        labelLayerRef.current = L.layerGroup().addTo(map);
        mapReadyRef.current = true;
        detachResize = attachMapResizeObserver(map, container);
        detachVisibility = attachMapVisibilityObserver(map, container);
        map.on("zoomend moveend", redrawVillageLabels);
        scheduleMapInvalidate(map, 50);
      }
    })();

    return () => {
      cancelled = true;
      detachResize?.();
      detachVisibility?.();
      mapRef.current?.off("zoomend moveend", redrawVillageLabels);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const schoolLayer = schoolLayerRef.current;
    if (!map || !schoolLayer || !mapReadyRef.current) return;

    schoolLayer.clearLayers();
    dragMarkerRef.current = null;

    const pinned = schools.filter(hasValidPin);
    for (const school of pinned) {
      const lat = Number(school.lat);
      const lng = Number(school.lng);
      const village =
        localityHintFromSchoolName(school.schoolName || "") ||
        String(school.matchedPlaceName || "").trim() ||
        "";
      const placeName = String(school.matchedPlaceName || village || school.schoolName || "");
      const isSelected = school.id === selectedSchoolId;

      const marker = L.marker([lat, lng], {
        icon: schoolDotIcon(school, isSelected),
        zIndexOffset: isSelected ? 1200 : 0,
      });
      marker.bindTooltip(
        `<div style="font-size:11px;line-height:1.35;">
          <strong>${escapeHtml(displayLabel(school.schoolName || ""))}</strong><br/>
          <span style="color:#64748b;">${escapeHtml(displayLabel(village || placeName))}</span>
        </div>`,
        { direction: "top", opacity: 0.96, offset: [0, -6], sticky: true },
      );
      marker.on("click", () => onSelectRef.current(school.id));
      marker.addTo(schoolLayer);

      if (isSelected) {
        L.marker([lat, lng], {
          icon: selectedSchoolLabelIcon(school.schoolName || placeName),
          interactive: false,
          keyboard: false,
          zIndexOffset: 1300,
        }).addTo(schoolLayer);
      }
    }

    redrawVillageLabels();

    const selected = pinned.find((s) => s.id === selectedSchoolId);
    if (selected && !readOnly && onDragPin) {
      const lat = Number(selected.lat);
      const lng = Number(selected.lng);
      const dragMarker = L.marker([lat, lng], {
        draggable: true,
        zIndexOffset: 2000,
        icon: L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#ff791a;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      });
      dragMarker.bindTooltip("Drag to correct pin", {
        permanent: true,
        direction: "right",
        offset: [10, 0],
        opacity: 0.95,
        className: "school-drag-tip",
      });
      dragMarker.on("dragend", () => {
        const pos = dragMarker.getLatLng();
        onDragPin(selected.id, pos.lat, pos.lng);
      });
      dragMarker.addTo(schoolLayer);
      dragMarkerRef.current = dragMarker;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.45 });
    } else if (pinned.length > 0) {
      const boundsKey = pinned
        .map((s) => `${s.id}:${Number(s.lat).toFixed(5)},${Number(s.lng).toFixed(5)}`)
        .sort()
        .join("|");
      if (fittedKeyRef.current !== boundsKey) {
        fittedKeyRef.current = boundsKey;
        const bounds = L.latLngBounds(pinned.map((s) => [Number(s.lat), Number(s.lng)]));
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15 });
      }
    }

    scheduleMapInvalidate(map, 0);
  }, [schools, selectedSchoolId, readOnly, onDragPin]);

  return (
    <div className="relative w-full h-full min-h-[320px]">
      <div
        ref={containerRef}
        className="rounded-xl border-0 min-h-[420px] h-full w-full overflow-hidden bg-slate-100"
      />
      <p className="absolute bottom-2 left-2 z-[500] text-[9px] text-slate-600 bg-white/90 px-2 py-1 rounded shadow-xs pointer-events-none">
        Village names on pins · Streets / Satellite in top-right
      </p>
      <style>{`
        .village-map-label,
        .school-pin-dot,
        .school-selected-label {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-tooltip.school-drag-tip {
          background: #0f172a;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 7px;
          box-shadow: 0 2px 6px rgba(0,0,0,.25);
        }
        .leaflet-tooltip.school-drag-tip::before {
          border-right-color: #0f172a;
        }
      `}</style>
    </div>
  );
}
