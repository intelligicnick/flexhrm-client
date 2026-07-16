import React, { useEffect, useRef } from "react";
import { SchoolWork } from "../types";
import { localityHintFromSchoolName } from "../lib/school-place-match";
import {
  loadGoogleMaps,
  type GoogleMap,
  type GoogleMarker,
  type GoogleMapsNamespace,
} from "../lib/google-maps-loader";

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

function shortLabel(text: string, max = 14): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

interface SchoolGoogleMapProps {
  schools: SchoolWork[];
  mapsApiKey: string;
  selectedSchoolId: string | null;
  readOnly?: boolean;
  onSelectSchool: (schoolId: string) => void;
  onDragPin?: (schoolId: string, lat: number, lng: number) => void;
}

export default function SchoolGoogleMap({
  schools,
  mapsApiKey,
  selectedSchoolId,
  readOnly = false,
  onSelectSchool,
  onDragPin,
}: SchoolGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const googleRef = useRef<GoogleMapsNamespace | null>(null);
  const markersRef = useRef<GoogleMarker[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mapsApiKey) return;

    let cancelled = false;

    void (async () => {
      try {
        const google = await loadGoogleMaps(mapsApiKey);
        if (cancelled) return;
        googleRef.current = google;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(container, {
            center: { lat: 25.78, lng: 87.0 },
            zoom: 10,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
          });
        }
      } catch {
        // Parent shows config error
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapsApiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const google = googleRef.current;
    if (!map || !google) return;

    for (const marker of markersRef.current) {
      marker.setMap(null);
    }
    markersRef.current = [];

    const pinned = schools.filter(hasValidPin);
    for (const school of pinned) {
      const lat = Number(school.lat);
      const lng = Number(school.lng);
      const village = localityHintFromSchoolName(school.schoolName || "");
      const placeName = String(school.matchedPlaceName || village || school.schoolName || "");
      const isSelected = school.id === selectedSchoolId;
      const color = markerColor(school);

      const marker = new google.maps.Marker({
        map,
        position: { lat, lng },
        title: `${school.schoolName}\n${placeName}`,
        label: {
          text: shortLabel(village || placeName),
          color: "#ffffff",
          fontSize: "10px",
          fontWeight: "bold",
        },
        draggable: isSelected && !readOnly,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 11 : 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: isSelected ? 3 : 2,
        },
      });

      google.maps.event.addListener(marker, "click", () => {
        onSelectSchool(school.id);
      });

      if (isSelected && !readOnly && onDragPin) {
        google.maps.event.addListener(marker, "dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          onDragPin(school.id, pos.lat(), pos.lng());
        });
      }

      markersRef.current.push(marker);
    }

    if (pinned.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      for (const school of pinned) {
        bounds.extend({ lat: Number(school.lat), lng: Number(school.lng) });
      }
      map.fitBounds(bounds, 48);
    }

    const selected = pinned.find((s) => s.id === selectedSchoolId);
    if (selected) {
      map.panTo({ lat: Number(selected.lat), lng: Number(selected.lng) });
      if (pinned.length === 1) {
        map.setZoom(15);
      }
    }
  }, [schools, selectedSchoolId, readOnly, onSelectSchool, onDragPin]);

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-slate-200 min-h-[420px] h-[420px] w-full overflow-hidden bg-slate-100"
    />
  );
}
