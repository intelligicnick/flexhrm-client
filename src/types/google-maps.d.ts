declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts?: Record<string, unknown>);
    setCenter(latLng: LatLngLiteral): void;
    setZoom(zoom: number): void;
    fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
  }
  class Marker {
    constructor(opts?: Record<string, unknown>);
    setMap(map: Map | null): void;
  }
  class Circle {
    constructor(opts?: Record<string, unknown>);
    setMap(map: Map | null): void;
    setOptions(opts: Record<string, unknown>): void;
  }
  class LatLngBounds {
    extend(latLng: LatLngLiteral): void;
  }
  enum SymbolPath {
    CIRCLE,
  }
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }
  interface Padding {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  }
}

declare const google: {
  maps: typeof google.maps;
};
