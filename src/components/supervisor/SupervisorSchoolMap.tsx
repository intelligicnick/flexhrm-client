import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ExternalLink } from "lucide-react";
import { loadGoogleMaps } from "../../lib/google-maps-loader";
import {
  attachMapResizeObserver,
  attachMapVisibilityObserver,
  createFieldMap,
  createMapTileLayer,
  scheduleMapInvalidate,
  waitForMapContainerSize,
} from "../../lib/leaflet-map-setup";
import { buildGoogleMapsPinUrl } from "../../lib/map-links";
import { isFlexHrmNativeApp } from "../../lib/supervisor-installed-apps";

interface SupervisorSchoolMapProps {
  mapsApiKey?: string;
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

/**
 * School pin + geofence map on the visit screen.
 * Field Team APK uses Leaflet/OSM (Google Maps JS crashes many WebViews).
 * Browser supervisor portal keeps Google Maps when an API key is present.
 */
export default function SupervisorSchoolMap({
  mapsApiKey = "",
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
  const useLeaflet = isFlexHrmNativeApp() || !mapsApiKey;

  if (useLeaflet) {
    return (
      <LeafletSchoolMap
        schoolLat={schoolLat}
        schoolLng={schoolLng}
        geofenceRadiusM={geofenceRadiusM}
        schoolLabel={schoolLabel}
        matchedPlaceName={matchedPlaceName}
        userLat={userLat}
        userLng={userLng}
        withinGeofence={withinGeofence}
        openInMapsLabel={openInMapsLabel}
        googleMapsUrl={googleMapsUrl}
        onLoadError={onLoadError}
      />
    );
  }

  return (
    <GoogleSchoolMap
      mapsApiKey={mapsApiKey}
      schoolLat={schoolLat}
      schoolLng={schoolLng}
      geofenceRadiusM={geofenceRadiusM}
      schoolLabel={schoolLabel}
      matchedPlaceName={matchedPlaceName}
      userLat={userLat}
      userLng={userLng}
      withinGeofence={withinGeofence}
      openInMapsLabel={openInMapsLabel}
      googleMapsUrl={googleMapsUrl}
      onLoadError={onLoadError}
    />
  );
}

function MapShell({
  children,
  externalUrl,
  openInMapsLabel,
}: {
  children: React.ReactNode;
  externalUrl: string;
  openInMapsLabel: string;
}) {
  return (
    <div className="relative z-0 isolate overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 [&_.leaflet-container]:z-0 [&_.leaflet-pane]:!z-auto [&_.leaflet-top]:!z-[1] [&_.leaflet-bottom]:!z-[1]">
      {children}
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 z-[2] inline-flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-[10px] font-bold text-[#ff791a] shadow-sm"
      >
        <ExternalLink size={12} />
        {openInMapsLabel}
      </a>
    </div>
  );
}

function LeafletSchoolMap({
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
}: Omit<SupervisorSchoolMapProps, "mapsApiKey">) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const schoolMarkerRef = useRef<L.CircleMarker | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let detachResize: (() => void) | undefined;
    let detachVisibility: (() => void) | undefined;

    void (async () => {
      try {
        const sized = await waitForMapContainerSize(container);
        if (cancelled || !sized) {
          if (!cancelled) onLoadError?.("Map container not ready.");
          return;
        }

        if (!mapRef.current) {
          mapRef.current = createFieldMap(container);
          createMapTileLayer().addTo(mapRef.current);
          detachResize = attachMapResizeObserver(mapRef.current, container);
          detachVisibility = attachMapVisibilityObserver(mapRef.current, container);
          scheduleMapInvalidate(mapRef.current, 50);
          scheduleMapInvalidate(mapRef.current, 250);
        }

        const map = mapRef.current;
        if (!map) return;

        if (circleRef.current) {
          map.removeLayer(circleRef.current);
          circleRef.current = null;
        }
        circleRef.current = L.circle([schoolLat, schoolLng], {
          radius: geofenceRadiusM,
          color: withinGeofence ? "#059669" : "#d97706",
          fillColor: withinGeofence ? "#10b981" : "#f59e0b",
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(map);

        if (schoolMarkerRef.current) {
          map.removeLayer(schoolMarkerRef.current);
          schoolMarkerRef.current = null;
        }
        schoolMarkerRef.current = L.circleMarker([schoolLat, schoolLng], {
          radius: 9,
          color: "#fff",
          weight: 2,
          fillColor: "#dc2626",
          fillOpacity: 1,
        })
          .bindTooltip(matchedPlaceName || schoolLabel, { direction: "top" })
          .addTo(map);

        map.setView([schoolLat, schoolLng], 16);
        scheduleMapInvalidate(map, 0);
      } catch (err: unknown) {
        onLoadError?.(err instanceof Error ? err.message : "Map failed to load.");
      }
    })();

    return () => {
      cancelled = true;
      detachResize?.();
      detachVisibility?.();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      schoolMarkerRef.current = null;
      userMarkerRef.current = null;
      circleRef.current = null;
    };
  }, [
    schoolLat,
    schoolLng,
    geofenceRadiusM,
    schoolLabel,
    matchedPlaceName,
    onLoadError,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    const hasUser =
      userLat != null &&
      userLng != null &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLng);

    if (hasUser) {
      userMarkerRef.current = L.circleMarker([userLat, userLng], {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: withinGeofence ? "#2563eb" : "#7c3aed",
        fillOpacity: 1,
      })
        .bindTooltip("Your location", { direction: "top" })
        .addTo(map);

      map.fitBounds(
        L.latLngBounds([
          [schoolLat, schoolLng],
          [userLat, userLng],
        ]),
        { padding: [48, 48], maxZoom: 17 },
      );
    } else {
      map.setView([schoolLat, schoolLng], 16);
    }

    if (circleRef.current) {
      circleRef.current.setStyle({
        color: withinGeofence ? "#059669" : "#d97706",
        fillColor: withinGeofence ? "#10b981" : "#f59e0b",
      });
    }
  }, [userLat, userLng, withinGeofence, schoolLat, schoolLng]);

  const externalUrl = googleMapsUrl || buildGoogleMapsPinUrl(schoolLat, schoolLng);

  return (
    <MapShell externalUrl={externalUrl} openInMapsLabel={openInMapsLabel}>
      <div ref={containerRef} className="h-56 w-full min-h-[224px]" />
    </MapShell>
  );
}

function GoogleSchoolMap({
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
}: SupervisorSchoolMapProps & { mapsApiKey: string }) {
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
        const googleNs = await loadGoogleMaps(mapsApiKey);
        if (cancelled) return;

        if (!mapRef.current) {
          mapRef.current = new googleNs.maps.Map(container, {
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
        circleRef.current = new googleNs.maps.Circle({
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
        schoolMarkerRef.current = new googleNs.maps.Marker({
          map: mapRef.current,
          position: { lat: schoolLat, lng: schoolLng },
          title: matchedPlaceName || schoolLabel,
          label: { text: "S", color: "#fff", fontWeight: "700" },
          icon: {
            path: googleNs.maps.SymbolPath.CIRCLE,
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
    const googleNs = window.google;
    const map = mapRef.current;
    if (!googleNs?.maps || !map) return;

    if (userMarkerRef.current) userMarkerRef.current.setMap(null);
    userMarkerRef.current = null;

    const hasUser =
      userLat != null &&
      userLng != null &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLng);

    if (hasUser) {
      userMarkerRef.current = new googleNs.maps.Marker({
        map,
        position: { lat: userLat, lng: userLng },
        title: "Your location",
        label: { text: "You", color: "#fff", fontSize: "10px", fontWeight: "700" },
        icon: {
          path: googleNs.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: withinGeofence ? "#2563eb" : "#7c3aed",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        zIndex: 1000,
      });

      const bounds = new googleNs.maps.LatLngBounds();
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
    <MapShell externalUrl={externalUrl} openInMapsLabel={openInMapsLabel}>
      <div ref={containerRef} className="h-56 w-full min-h-[224px]" />
    </MapShell>
  );
}
