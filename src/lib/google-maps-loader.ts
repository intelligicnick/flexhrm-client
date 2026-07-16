type GoogleMapsNamespace = {
  maps: {
    Map: new (
      el: HTMLElement,
      opts: {
        center: { lat: number; lng: number };
        zoom: number;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
      },
    ) => GoogleMap;
    Marker: new (opts: GoogleMarkerOptions) => GoogleMarker;
    LatLngBounds: new () => GoogleLatLngBounds;
    SymbolPath: { CIRCLE: number };
    event: {
      addListener: (instance: GoogleMarker, event: string, handler: () => void) => void;
    };
  };
};

type GoogleMap = {
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
  panTo: (pos: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type GoogleMarker = {
  setMap: (map: GoogleMap | null) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  setPosition: (pos: { lat: number; lng: number }) => void;
};

type GoogleLatLngBounds = {
  extend: (pos: { lat: number; lng: number }) => void;
};

export type GoogleMarkerOptions = {
  map: GoogleMap;
  position: { lat: number; lng: number };
  title?: string;
  label?: { text: string; color?: string; fontSize?: string; fontWeight?: string };
  draggable?: boolean;
  icon?: {
    path: number;
    scale: number;
    fillColor: string;
    fillOpacity: number;
    strokeColor: string;
    strokeWeight: number;
  };
};

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
    __flexhrmGoogleMapsPromise?: Promise<GoogleMapsNamespace>;
  }
}

export async function loadGoogleMaps(apiKey: string): Promise<GoogleMapsNamespace> {
  if (window.google?.maps) return window.google;
  if (window.__flexhrmGoogleMapsPromise) return window.__flexhrmGoogleMapsPromise;

  window.__flexhrmGoogleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to load."));
    };
    script.onerror = () => reject(new Error("Google Maps script failed to load."));
    document.head.appendChild(script);
  });

  return window.__flexhrmGoogleMapsPromise;
}

export type { GoogleMap, GoogleMarker, GoogleMapsNamespace, GoogleLatLngBounds };
