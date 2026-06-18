const GEM_BASE = "https://bidplus.gem.gov.in";

export function extractGemDocId(gemDocUrl: string): string {
  const match = gemDocUrl.match(/(?:showbidDocument|downloadBidDocument)\/(\d+)/i);
  return match?.[1] ?? "";
}

/** GeM bid PDF viewer URL (opens in a new browser tab). */
export function resolveGemBidPdfUrl(tender: { gemDocUrl?: string }): string | null {
  const raw = tender.gemDocUrl?.trim() ?? "";
  if (!raw) return null;

  const docId = extractGemDocId(raw);
  if (docId) return `${GEM_BASE}/showbidDocument/${docId}`;

  if (/gem\.gov\.in/i.test(raw)) return raw;
  return null;
}

/** Public GeM bids search when no stored PDF URL exists. */
export function resolveGemBidSearchUrl(bidNo: string): string {
  return `${GEM_BASE}/all-bids`;
}
