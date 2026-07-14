import { apiUrl } from "../api";
import { resolvePhotoSrc } from "./media-url";
import {
  canUseObserverNativeUrlFetch,
  fetchUrlAsDataUrlViaNative,
} from "./observer-native-bridge";
import type { SchoolVisitPhoto } from "../types";

const PROXY_IMAGE_HOSTS = ["ik.imagekit.io"];

function toDataUrlFromBase64(base64: string, mimeType?: string): string {
  const trimmed = base64.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:")) return trimmed;
  return `data:${mimeType || "image/jpeg"};base64,${trimmed}`;
}

function resolveAbsoluteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(trimmed, window.location.origin).href;
  }
  return trimmed;
}

function shouldProxyImageUrl(absolute: string): boolean {
  try {
    const { hostname } = new URL(absolute);
    return PROXY_IMAGE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function visitPhotoFileEndpoint(visitId: string, photoId: string): string {
  return `/api/school-visits/${encodeURIComponent(visitId)}/photos/${encodeURIComponent(photoId)}/file`;
}

function resolveRemotePhotoFetchUrl(src: string): string {
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("/api/")) return apiUrl(trimmed);
  const absolute = resolveAbsoluteUrl(trimmed);
  if (shouldProxyImageUrl(absolute)) {
    return apiUrl(`/api/proxy/image?url=${encodeURIComponent(absolute)}`);
  }
  return absolute;
}

async function fetchUrlAsDataUrlViaWeb(url: string): Promise<string> {
  if (!url.trim()) throw new Error("Missing image URL");
  const response = await fetch(url, {
    credentials: "include",
    mode: "cors",
    headers: { Accept: "image/*,*/*" },
  });
  if (!response.ok) throw new Error(`Could not load image (${response.status})`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image data"));
    reader.readAsDataURL(blob);
  });
}

async function tryFetchDataUrl(url: string): Promise<string> {
  if (canUseObserverNativeUrlFetch()) {
    try {
      return await fetchUrlAsDataUrlViaNative(url);
    } catch {
      // Fall through to WebView fetch.
    }
  }
  return fetchUrlAsDataUrlViaWeb(url);
}

/** Load a visit photo as a data URL for PDF embedding — tries API, native, and proxy fallbacks. */
export async function fetchVisitPhotoDataUrl(
  visitId: string,
  photo: SchoolVisitPhoto,
): Promise<string> {
  const embedded = photo.photoDataBase64?.trim();
  if (embedded) {
    return toDataUrlFromBase64(embedded, photo.mimeType);
  }

  const candidates: string[] = [];
  if (visitId && photo.id) {
    candidates.push(resolveRemotePhotoFetchUrl(visitPhotoFileEndpoint(visitId, photo.id)));
  }

  const directSrc = resolvePhotoSrc(photo);
  if (directSrc && !directSrc.startsWith("data:")) {
    const resolved = resolveRemotePhotoFetchUrl(directSrc);
    if (!candidates.includes(resolved)) {
      candidates.push(resolved);
    }
    if (directSrc.startsWith("http") && !candidates.includes(directSrc)) {
      candidates.push(directSrc);
    }
  }

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      return await tryFetchDataUrl(candidate);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Could not load image");
    }
  }

  throw lastError || new Error("Could not load image");
}
