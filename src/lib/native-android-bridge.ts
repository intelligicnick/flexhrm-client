import { isFlexHrmNativeApp } from "./supervisor-installed-apps";

export type NativeGpsCoordinates = {
  lat: number;
  lng: number;
  accuracy?: number;
  at?: number;
};

type NativeAndroidBridge = {
  getGpsCoordinates?: () => string;
  requestFreshGps?: () => void;
  warmupGps?: () => void;
  capturePhoto?: () => void;
};

declare global {
  interface Window {
    __flexHrmOnPhotoCaptured?: (dataUrl: string) => void;
    __flexHrmOnPhotoError?: (message: string) => void;
    __flexHrmOnGpsReady?: (coordinatesJson: string) => void;
  }
}

function getBridge(): NativeAndroidBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    FlexHrmAndroid?: NativeAndroidBridge;
    Android?: NativeAndroidBridge;
  };
  return w.FlexHrmAndroid || w.Android;
}

function parseGpsJson(raw: string): NativeGpsCoordinates | null {
  try {
    const parsed = JSON.parse(raw) as {
      lat?: unknown;
      lng?: unknown;
      accuracy?: unknown;
      at?: unknown;
    };
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;
    return {
      lat,
      lng,
      accuracy: Number.isFinite(Number(parsed.accuracy)) ? Number(parsed.accuracy) : undefined,
      at: Number.isFinite(Number(parsed.at)) ? Number(parsed.at) : undefined,
    };
  } catch {
    return null;
  }
}

export function warmupNativeGps(): void {
  if (!isFlexHrmNativeApp()) return;
  try {
    getBridge()?.warmupGps?.();
  } catch {
    /* ignore */
  }
}

export function readNativeGpsCoordinates(): NativeGpsCoordinates | null {
  if (!isFlexHrmNativeApp()) return null;
  try {
    const raw = getBridge()?.getGpsCoordinates?.();
    if (!raw) return null;
    return parseGpsJson(raw);
  } catch {
    return null;
  }
}

export function requestFreshNativeGpsCoordinates(timeoutMs = 22_000): Promise<NativeGpsCoordinates | null> {
  if (!isFlexHrmNativeApp()) {
    return Promise.resolve(null);
  }

  const bridge = getBridge();
  if (!bridge?.requestFreshGps) {
    return Promise.resolve(readNativeGpsCoordinates());
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(readNativeGpsCoordinates());
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      delete window.__flexHrmOnGpsReady;
    };

    window.__flexHrmOnGpsReady = (coordinatesJson: string) => {
      cleanup();
      resolve(parseGpsJson(coordinatesJson) ?? readNativeGpsCoordinates());
    };

    try {
      bridge.requestFreshGps();
    } catch {
      cleanup();
      resolve(readNativeGpsCoordinates());
    }
  });
}

function waitForNativePhoto(timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Camera timed out. Please try again."));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      delete window.__flexHrmOnPhotoCaptured;
      delete window.__flexHrmOnPhotoError;
    };

    window.__flexHrmOnPhotoCaptured = (dataUrl: string) => {
      cleanup();
      if (!dataUrl) {
        reject(new Error("Camera returned an empty photo."));
        return;
      }
      resolve(dataUrl);
    };

    window.__flexHrmOnPhotoError = (message: string) => {
      cleanup();
      reject(new Error(message || "Camera capture failed."));
    };
  });
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = match?.[1] || "image/jpeg";
  const base64 = match?.[2] || trimmed;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mimeType });
}

export async function captureNativePhotoFile(): Promise<File> {
  const bridge = getBridge();
  if (!bridge?.capturePhoto) {
    throw new Error("Native camera is not available.");
  }

  const pending = waitForNativePhoto();
  bridge.capturePhoto();
  const dataUrl = await pending;
  return dataUrlToFile(dataUrl, `live-${Date.now()}.jpg`);
}

export function canUseNativeCamera(): boolean {
  return isFlexHrmNativeApp() && Boolean(getBridge()?.capturePhoto);
}
