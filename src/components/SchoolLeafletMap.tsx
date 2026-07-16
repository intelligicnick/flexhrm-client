import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SchoolWork } from "../types";
import { localityHintFromSchoolName } from "../lib/school-place-match";
import {
  attachMapResizeObserver,
  attachMapVisibilityObserver,
  createFieldMap,
  createMapTileLayer,
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
        createMapTileLayer().addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
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
    if (!map || !layer) return;

    layer.clearLayers();
    dragMarkerRef.current = null;

    const pinned = schools.filter(hasValidPin);
    for (const school of pinned) {
      const lat = Number(school.lat);
      const lng = Number(school.lng);
      const village = localityHintFromSchoolName(school.schoolName || "");
      const placeName = String(school.matchedPlaceName || village || school.schoolName || "");
      const isSelected = school.id === selectedSchoolId;
      const color = markerColor(school);

      const marker = L.circleMarker([lat, lng], {
        radius: isSelected ? 9 : 6,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: isSelected ? 3 : 1,
      });
      marker.bindTooltip(`${village || placeName}<br/><span style="font-size:10px">${placeName}</span>`);
      marker.on("click", () => onSelectSchool(school.id));
      marker.addTo(layer);
    }

    const selected = pinned.find((s) => s.id === selectedSchoolId);
    if (selected && !readOnly && onDragPin) {
      const lat = Number(selected.lat);
      const lng = Number(selected.lng);
      const village = localityHintFromSchoolName(selected.schoolName || "");
      const dragMarker = L.marker([lat, lng], {
        draggable: true,
        zIndexOffset: 1000,
      });
      dragMarker.bindTooltip(selected.schoolName || village || "School pin");
      dragMarker.on("dragend", () => {
        const pos = dragMarker.getLatLng();
        onDragPin(selected.id, pos.lat, pos.lng);
      });
      dragMarker.addTo(layer);
      dragMarkerRef.current = dragMarker;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
    } else if (pinned.length > 0) {
      const bounds = L.latLngBounds(pinned.map((s) => [Number(s.lat), Number(s.lng)]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }

    scheduleMapInvalidate(map, 0);
  }, [schools, selectedSchoolId, readOnly, onSelectSchool, onDragPin]);

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-slate-200 min-h-[420px] h-[420px] w-full overflow-hidden bg-slate-100"
    />
  );
}
