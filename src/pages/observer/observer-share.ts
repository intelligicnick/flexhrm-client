export type PdfActionStatus = "loading" | "ready" | "error";

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

function resolveFetchUrl(url: string): string {
  const absolute = resolveAbsoluteUrl(url);
  if (/^https?:\/\/(bidplus\.gem\.gov\.in|fulfilment\.gem\.gov\.in)/i.test(absolute)) {
    return `/api/proxy/pdf?url=${encodeURIComponent(absolute)}`;
  }
  return absolute;
}

async function fetchPdfBlob(url: string): Promise<Blob> {
  const fetchUrl = resolveFetchUrl(url);
  const response = await fetch(fetchUrl, {
    credentials: "include",
    mode: "cors",
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

export async function fetchPdfFile(url: string, title: string): Promise<File> {
  const blob = await fetchPdfBlob(url);
  return new File([blob], sanitizeFilename(title), { type: "application/pdf" });
}

export async function viewPdfUrl(
  url: string,
  onStatus?: (status: PdfActionStatus, message?: string) => void,
): Promise<string | null> {
  if (!url?.trim()) return null;
  onStatus?.("loading", "Loading PDF…");
  try {
    const blob = await fetchPdfBlob(url);
    const objectUrl = URL.createObjectURL(blob);
    onStatus?.("ready");
    return objectUrl;
  } catch {
    onStatus?.("error", "Could not load PDF in app");
    const absoluteUrl = resolveAbsoluteUrl(url);
    window.open(absoluteUrl, "_blank", "noopener,noreferrer");
    return null;
  }
}

export async function sharePdfUrl(
  url: string,
  title: string,
  onStatus?: (status: PdfActionStatus, message?: string) => void,
): Promise<void> {
  if (!url?.trim()) return;
  onStatus?.("loading", "Preparing PDF…");

  try {
    const file = await fetchPdfFile(url, title);
    onStatus?.("ready");

    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return;
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, files: [file] });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    const objectUrl = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    onStatus?.("ready", "PDF saved — share from your downloads folder.");
  } catch {
    onStatus?.("error", "Could not fetch PDF to share.");
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!url?.trim()) return;
  window.open(resolveAbsoluteUrl(url), "_blank", "noopener,noreferrer");
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
