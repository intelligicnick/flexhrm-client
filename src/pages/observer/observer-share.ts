export async function openExternalUrl(url: string): Promise<void> {
  if (!url?.trim()) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function shareUrl(
  url: string,
  title: string,
  onCopied?: (message: string) => void,
): Promise<void> {
  if (!url?.trim()) return;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    onCopied?.("Link copied to clipboard.");
  } catch {
    window.prompt("Copy link:", url);
  }
}
