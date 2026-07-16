import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SchoolWork } from "../types";
import { localityHintFromSchoolName } from "../lib/school-place-match";
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

function shortPlaceLabel(value: string, max = 18): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function labeledPinIcon(school: SchoolWork, isSelected: boolean): L.DivIcon {
  const village = localityHintFromSchoolName(school.schoolName || "");
  const placeName = String(school.matchedPlaceName || village || school.schoolName || "");
  const label = shortPlaceLabel(village || placeName, 20);
  const sublabel = placeName !== label ? shortPlaceLabel(placeName, 24) : "";
  const color = markerColor(school);
  const size = isSelected ? 12 : 10;

  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
      <div style="max-width:110px;text-align:center;background:rgba(15,23,42,.88);color:#fff;font-size:9px;font-weight:700;line-height:1.2;padding:2px 5px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(label)}</div>
      ${sublabel ? `<div style="max-width:120px;margin-top:1px;text-align:center;background:rgba(255,255,255,.92);color:#334155;font-size:8px;line-height:1.2;padding:1px 4px;border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,.2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(sublabel)}</div>` : ""}
      <div style="width:${size}px;height:${size}px;margin-top:3px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>
    </div>`,
    iconSize: [120, sublabel ? 52 : 40],
    iconAnchor: [60, sublabel ? 52 : 40],
  });
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
  const layerRef = useRef<L.LayerGroup | null>(null);
  const dragMarkerRef = useRef<L.Marker | null>(null);
  const mapReadyRef = useRef(false);

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
        mapRef.current = createFieldMap(container);
        attachFieldMapLayerControl(mapRef.current, "streets");
        layerRef.current = L.layerGroup().addTo(mapRef.current);
        mapReadyRef.current = true;
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
    const layer = layerRef.current;
    if (!map || !layer || !mapReadyRef.current) return;

    layer.clearLayers();
    dragMarkerRef.current = null;

    const pinned = schools.filter(hasValidPin);
    for (const school of pinned) {
      const lat = Number(school.lat);
      const lng = Number(school.lng);
      const village = localityHintFromSchoolName(school.schoolName || "");
      const placeName = String(school.matchedPlaceName || village || school.schoolName || "");
      const isSelected = school.id === selectedSchoolId;

      const marker = L.marker([lat, lng], {
        icon: labeledPinIcon(school, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
      });
      marker.bindTooltip(
        `<strong>${escapeHtml(school.schoolName || "")}</strong><br/>${escapeHtml(placeName)}`,
        { direction: "top", opacity: 0.95 },
      );
      marker.on("click", () => onSelectSchool(school.id));
      marker.addTo(layer);
    }

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
      dragMarker.bindTooltip("Drag to correct pin", { permanent: true, direction: "right" });
      dragMarker.on("dragend", () => {
        const pos = dragMarker.getLatLng();
        onDragPin(selected.id, pos.lat, pos.lng);
      });
      dragMarker.addTo(layer);
      dragMarkerRef.current = dragMarker;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.5 });
    } else if (pinned.length > 0) {
      const bounds = L.latLngBounds(pinned.map((s) => [Number(s.lat), Number(s.lng)]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    }

    scheduleMapInvalidate(map, 0);
  }, [schools, selectedSchoolId, readOnly, onSelectSchool, onDragPin]);

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="rounded-lg border border-slate-200 min-h-[420px] h-[420px] w-full overflow-hidden bg-slate-100"
      />
      <p className="absolute bottom-2 left-2 z-[500] text-[9px] text-slate-600 bg-white/90 px-2 py-1 rounded shadow-xs pointer-events-none">
        Streets · Satellite · Satellite + labels — top-right
      </p>
    </div>
  );
}
