import L from "leaflet";
import { isFlexHrmNativeApp } from "./supervisor-installed-apps";

/**
 * OpenStreetMap Humanitarian tiles — open source, strong India coverage,
 * and clearer village / street names at street-level zoom than CARTO Voyager.
 */
export const MAP_TILE_URL =
  "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">Humanitarian OSM Team</a> hosted by <a href="https://openstreetmap.fr/">OSM France</a>';

/** Standard OSM raster — alternate label density; still open source. */
export const MAP_TILE_URL_STANDARD = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_TILE_ATTRIBUTION_STANDARD =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Cleaner CARTO style — fewer small-place labels (optional “simple” mode). */
export const MAP_TILE_URL_SIMPLE =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
export const MAP_TILE_ATTRIBUTION_SIMPLE =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** @deprecated Use MAP_TILE_URL_STANDARD — kept for older call sites. */
export const MAP_TILE_URL_DETAILED = MAP_TILE_URL_STANDARD;
/** @deprecated Use MAP_TILE_ATTRIBUTION_STANDARD */
export const MAP_TILE_ATTRIBUTION_DETAILED = MAP_TILE_ATTRIBUTION_STANDARD;

export const MAP_DEFAULT_CENTER: L.LatLngExpression = [20.5937, 78.9629];
export const MAP_DEFAULT_ZOOM = 5;

export function isTouchMapDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function createMapTileLayer(detailedLabels = true): L.TileLayer {
  const touch = isTouchMapDevice();
  const native = isFlexHrmNativeApp();
  // detailedLabels=true (default): HOT OSM with India village/street labels
  // detailedLabels=false: simpler CARTO Voyager (fewer labels)
  const url = detailedLabels ? MAP_TILE_URL : MAP_TILE_URL_SIMPLE;
  const attribution = detailedLabels ? MAP_TILE_ATTRIBUTION : MAP_TILE_ATTRIBUTION_SIMPLE;
  return L.tileLayer(url, {
    attribution,
    maxZoom: 20,
    // HOT OSM uses a/b/c; CARTO uses a/b/c/d — both tolerate extra subdomain retries
    subdomains: detailedLabels ? "abc" : "abcd",
    // Android WebView: load tiles while panning/zooming to avoid blank white map.
    updateWhenIdle: !touch,
    updateWhenZooming: touch,
    keepBuffer: touch ? 8 : 4,
    // crossOrigin breaks tile loading in many Android WebViews.
    ...(native ? {} : { crossOrigin: true }),
  });
}

export function createFieldMap(container: HTMLElement): L.Map {
  const touch = isTouchMapDevice();
  return L.map(container, {
    center: MAP_DEFAULT_CENTER,
    zoom: MAP_DEFAULT_ZOOM,
    zoomControl: true,
    attributionControl: true,
    preferCanvas: false,
    fadeAnimation: !touch,
    zoomAnimation: !touch,
    markerZoomAnimation: !touch,
    scrollWheelZoom: !touch,
    touchZoom: true,
    dragging: true,
    bounceAtZoomLimits: false,
    inertia: true,
  });
}

export function scheduleMapInvalidate(map: L.Map, delayMs = 0): void {
  window.setTimeout(() => {
    if (!map.getContainer()?.isConnected) return;
    map.invalidateSize({ animate: false, pan: false });
    // Force tile layer redraw after layout changes (common WebView white-screen fix).
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        layer.redraw();
      }
    });
  }, delayMs);
}

/** Wait until the map container has measurable dimensions (lazy tabs / mobile layout). */
export function waitForMapContainerSize(
  container: HTMLElement,
  maxAttempts = 24,
): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        resolve(true);
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        resolve(false);
        return;
      }
      window.requestAnimationFrame(check);
    };
    check();
  });
}

export function attachMapResizeObserver(map: L.Map, container: HTMLElement): () => void {
  if (typeof ResizeObserver === "undefined") {
    const onWindowResize = () => scheduleMapInvalidate(map, 50);
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }

  let frame = 0;
  const observer = new ResizeObserver(() => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => scheduleMapInvalidate(map, 0));
  });
  observer.observe(container);
  return () => {
    window.cancelAnimationFrame(frame);
    observer.disconnect();
  };
}

export function attachMapInteractionHandlers(map: L.Map): () => void {
  const container = map.getContainer();
  const onMoveEnd = () => scheduleMapInvalidate(map, 0);
  const onZoomEnd = () => scheduleMapInvalidate(map, 0);
  const onResize = () => scheduleMapInvalidate(map, 50);

  map.on("moveend", onMoveEnd);
  map.on("zoomend", onZoomEnd);
  map.on("resize", onResize);

  const touch = isTouchMapDevice();
  const onTouchEnd = () => scheduleMapInvalidate(map, 50);
  if (touch) {
    container.addEventListener("touchend", onTouchEnd, { passive: true });
  }

  const onVisibility = () => {
    if (document.visibilityState === "visible") scheduleMapInvalidate(map, 100);
  };
  document.addEventListener("visibilitychange", onVisibility);

  // Desktop: enable wheel zoom after first click without React state updates.
  let wheelEnabled = isTouchMapDevice();
  const enableWheel = () => {
    if (wheelEnabled) return;
    wheelEnabled = true;
    map.scrollWheelZoom.enable();
  };
  if (!wheelEnabled) {
    container.addEventListener("mousedown", enableWheel, { once: true });
    container.addEventListener("wheel", enableWheel, { once: true, passive: true });
  }

  return () => {
    map.off("moveend", onMoveEnd);
    map.off("zoomend", onZoomEnd);
    map.off("resize", onResize);
    if (touch) container.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

export function attachMapVisibilityObserver(map: L.Map, container: HTMLElement): () => void {
  if (typeof IntersectionObserver === "undefined") return () => undefined;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        scheduleMapInvalidate(map, 80);
        scheduleMapInvalidate(map, 250);
      }
    },
    { threshold: 0.1 },
  );
  observer.observe(container);
  return () => observer.disconnect();
}
