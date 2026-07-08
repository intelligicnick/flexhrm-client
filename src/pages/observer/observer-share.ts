import { apiUrl } from "../../api";
import { unwrapChromePdfViewerUrl, wrapChromePdfViewerUrl } from "../../lib/gem-helpers";
import { getObserverToken, isObserverNativeClient } from "../../lib/observer-session";
import {
  canUseObserverNativePdf,
  canUseObserverNativePdfShare,
  openPdfViaNative,
  sharePdfViaNative,
  sharePdfFromBase64ViaNative,
} from "../../lib/observer-native-bridge";

export type PdfActionStatus = "loading" | "ready" | "error";

const PROXY_HOSTS = [
  "bidplus.gem.gov.in",
  "fulfilment.gem.gov.in",
  "ik.imagekit.io",
];

function resolveAbsoluteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(trimmed, window.location.origin).href;
  }
  return trimmed;
}

function sanitizeFilename(title: string): string {
  const base = title.trim().replace(/[^\w.-]+/g, "_").replace(/_+/g, "_") || "document";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

function shouldProxyPdfUrl(absolute: string): boolean {
  try {
    const { hostname } = new URL(absolute);
    return PROXY_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/** Resolve a PDF URL for fetch/open — routes cross-origin docs through the API proxy. */
export function resolvePdfFetchUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/api/")) return apiUrl(trimmed);
  const absolute = resolveAbsoluteUrl(unwrapChromePdfViewerUrl(trimmed));
  if (shouldProxyPdfUrl(absolute)) {
    return apiUrl(`/api/proxy/pdf?url=${encodeURIComponent(absolute)}`);
  }
  return absolute;
}

async function fetchPdfBlob(url: string): Promise<Blob> {
  const fetchUrl = resolvePdfFetchUrl(url);
  const headers = new Headers({ Accept: "application/pdf,*/*" });
  const token = getObserverToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(fetchUrl, {
    credentials: "include",
    mode: "cors",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Could not load PDF (${response.status})`);
  }
  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("PDF file is empty");
  }
  const type = blob.type?.includes("pdf") ? blob.type : "application/pdf";
  return blob.type === type ? blob : new Blob([blob], { type });
}

export async function fetchPdfArrayBuffer(url: string): Promise<ArrayBuffer> {
  const blob = await fetchPdfBlob(url);
  return blob.arrayBuffer();
}

export async function fetchPdfFile(url: string, title: string): Promise<File> {
  const blob = await fetchPdfBlob(url);
  return new File([blob], sanitizeFilename(title), { type: "application/pdf" });
}

function openPdfExternally(url: string): void {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("/api/")) return;
  const absolute = resolveAbsoluteUrl(unwrapChromePdfViewerUrl(trimmed));
  if (absolute.includes("/api/")) return;
  const openUrl = /^chrome-extension:\/\//i.test(trimmed)
    ? trimmed
    : wrapChromePdfViewerUrl(absolute);
  window.open(openUrl, "_blank", "noopener,noreferrer");
}

export function canOpenPdfExternally(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("/api/")) return false;
  const absolute = resolveAbsoluteUrl(unwrapChromePdfViewerUrl(trimmed));
  return !absolute.includes("/api/") && /^https?:\/\//i.test(absolute);
}

export async function viewPdfUrl(
  url: string,
  onStatus?: (status: PdfActionStatus, message?: string) => void,
): Promise<ArrayBuffer | null> {
  if (!url?.trim()) return null;
  onStatus?.("loading", "Loading PDF…");

  try {
    const data = await fetchPdfArrayBuffer(url);
    onStatus?.("ready");
    return data;
  } catch {
    if (canUseObserverNativePdf()) {
      try {
        await openPdfViaNative(resolvePdfFetchUrl(url), sanitizeFilename(url));
        onStatus?.("ready", "PDF opened in viewer app.");
        return null;
      } catch {
        // fall through
      }
    }
    onStatus?.("error", "Could not load PDF in app");
    openPdfExternally(url);
    return null;
  }
}

async function sharePdfFile(file: File, title: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, files: [file] });
    return true;
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, files: [file] });
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return true;
    }
  }

  return false;
}

async function downloadPdfFile(file: File): Promise<void> {
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function sharePdfUrl(
  url: string,
  title: string,
  onStatus?: (status: PdfActionStatus, message?: string) => void,
): Promise<void> {
  if (!url?.trim()) return;
  onStatus?.("loading", "Preparing PDF…");

  const filename = sanitizeFilename(title);
  const resolvedUrl = resolvePdfFetchUrl(url);

  if (canUseObserverNativePdf()) {
    try {
      await sharePdfViaNative(resolvedUrl, title, filename);
      onStatus?.("ready");
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not share PDF.";
      onStatus?.("error", message);
      return;
    }
  }

  try {
    const file = await fetchPdfFile(url, title);
    const shared = await sharePdfFile(file, title);
    if (shared) {
      onStatus?.("ready");
      return;
    }

    if (isObserverNativeClient()) {
      try {
        await downloadPdfFile(file);
        onStatus?.("ready", "PDF saved — share from your downloads folder.");
      } catch {
        onStatus?.("error", "Could not share PDF on this device.");
      }
      return;
    }

    await downloadPdfFile(file);
    onStatus?.("ready", "PDF saved — share from your downloads folder.");
  } catch {
    onStatus?.("error", "Could not fetch PDF to share.");
    openPdfExternally(url);
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!url?.trim()) return;
  openPdfExternally(url);
}

export async function shareUrl(
  url: string,
  title: string,
  onCopied?: (message: string) => void,
): Promise<void> {
  await sharePdfUrl(url, title, (status, message) => {
    if (status === "error" && message) onCopied?.(message);
    if (status === "ready" && message) onCopied?.(message);
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read PDF file."));
    reader.readAsDataURL(file);
  });
}

export async function shareGeneratedPdfFile(
  file: File,
  title: string,
  onStatus?: (status: PdfActionStatus, message?: string) => void,
): Promise<void> {
  onStatus?.("loading", "Preparing PDF…");

  if (canUseObserverNativePdfShare()) {
    try {
      const dataUrl = await fileToBase64(file);
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      await sharePdfFromBase64ViaNative(base64, title, file.name);
      onStatus?.("ready", "Share sheet opened — choose WhatsApp or another app.");
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not share PDF.";
      onStatus?.("error", message);
      return;
    }
  }

  const shared = await sharePdfFile(file, title);
  if (shared) {
    onStatus?.("ready", "PDF shared.");
    return;
  }

  try {
    await downloadPdfFile(file);
    onStatus?.("ready", "PDF saved — share from your downloads folder.");
  } catch {
    onStatus?.("error", "Could not share PDF on this device.");
  }
}
