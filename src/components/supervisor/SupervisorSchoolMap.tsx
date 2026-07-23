import React, { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { loadGoogleMaps } from "../../lib/google-maps-loader";
import { buildGoogleMapsPinUrl } from "../../lib/map-links";

interface SupervisorSchoolMapProps {
  mapsApiKey: string;
  schoolLat: number;
  schoolLng: number;
  geofenceRadiusM: number;
  schoolLabel: string;
  matchedPlaceName?: string;
  userLat?: number | null;
  userLng?: number | null;
  withinGeofence?: boolean;
  openInMapsLabel?: string;
  googleMapsUrl?: string;
  onLoadError?: (message: string) => void;
}

export default function SupervisorSchoolMap({
  mapsApiKey,
  schoolLat,
  schoolLng,
  geofenceRadiusM,
  schoolLabel,
  matchedPlaceName,
  userLat,
  userLng,
  withinGeofence,
  openInMapsLabel = "Open in Google Maps",
  googleMapsUrl,
  onLoadError,
}: SupervisorSchoolMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const schoolMarkerRef = useRef<google.maps.Marker | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mapsApiKey) return;

    let cancelled = false;

    void (async () => {
      try {
        const google = await loadGoogleMaps(mapsApiKey);
        if (cancelled) return;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(container, {
            center: { lat: schoolLat, lng: schoolLng },
            zoom: 16,
            mapTypeControl: true,
            mapTypeControlOptions: {
              mapTypeIds: ["roadmap", "satellite", "hybrid"],
            },
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: "greedy",
          });
        }

        if (circleRef.current) circleRef.current.setMap(null);
        circleRef.current = new google.maps.Circle({
          map: mapRef.current,
          center: { lat: schoolLat, lng: schoolLng },
          radius: geofenceRadiusM,
          fillColor: withinGeofence ? "#10b981" : "#f59e0b",
          fillOpacity: 0.15,
          strokeColor: withinGeofence ? "#059669" : "#d97706",
          strokeOpacity: 0.8,
          strokeWeight: 2,
        });

        if (schoolMarkerRef.current) schoolMarkerRef.current.setMap(null);
        schoolMarkerRef.current = new google.maps.Marker({
          map: mapRef.current,
          position: { lat: schoolLat, lng: schoolLng },
          title: matchedPlaceName || schoolLabel,
          label: { text: "S", color: "#fff", fontWeight: "700" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#dc2626",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
      } catch (err: unknown) {
        onLoadError?.(err instanceof Error ? err.message : "Google Maps failed to load.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mapsApiKey,
    schoolLat,
    schoolLng,
    geofenceRadiusM,
    schoolLabel,
    matchedPlaceName,
    onLoadError,
  ]);

  useEffect(() => {
    const google = window.google;
    const map = mapRef.current;
    if (!google?.maps || !map) return;

    if (userMarkerRef.current) userMarkerRef.current.setMap(null);
    userMarkerRef.current = null;

    const hasUser =
      userLat != null &&
      userLng != null &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLng);

    if (hasUser) {
      userMarkerRef.current = new google.maps.Marker({
        map,
        position: { lat: userLat, lng: userLng },
        title: "Your location",
        label: { text: "You", color: "#fff", fontSize: "10px", fontWeight: "700" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: withinGeofence ? "#2563eb" : "#7c3aed",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        zIndex: 1000,
      });

      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: schoolLat, lng: schoolLng });
      bounds.extend({ lat: userLat, lng: userLng });
      map.fitBounds(bounds, 48);
    } else {
      map.setCenter({ lat: schoolLat, lng: schoolLng });
      map.setZoom(16);
    }

    if (circleRef.current) {
      circleRef.current.setOptions({
        fillColor: withinGeofence ? "#10b981" : "#f59e0b",
        strokeColor: withinGeofence ? "#059669" : "#d97706",
      });
    }
  }, [userLat, userLng, withinGeofence, schoolLat, schoolLng]);

  const externalUrl = googleMapsUrl || buildGoogleMapsPinUrl(schoolLat, schoolLng);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
      <div ref={containerRef} className="h-56 w-full min-h-[224px]" />
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-[10px] font-bold text-[#ff791a] shadow-sm"
      >
        <ExternalLink size={12} />
        {openInMapsLabel}
      </a>
    </div>
  );
}
