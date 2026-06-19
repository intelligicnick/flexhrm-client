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

/** GeM fulfilment contract PDF viewer URL. */
export function resolveGemContractPdfUrl(contract: {
  contractNo?: string;
  gemContractPdfUrl?: string;
}): string | null {
  const explicit = contract.gemContractPdfUrl?.trim() ?? "";
  if (explicit) return explicit;

  const raw = contract.contractNo?.trim() ?? "";
  if (/fulfilment\.gem\.gov\.in\/contract\/fds/i.test(raw)) return raw;
  return null;
}

/** Label shown in Contract No column when the stored value is a PDF URL. */
export function resolveGemContractNoLabel(contract: {
  contractNo?: string;
  gemContractPdfUrl?: string;
  notes?: string;
}): string {
  const pdfUrl = resolveGemContractPdfUrl(contract);
  if (!pdfUrl) return contract.contractNo?.trim() ?? "";

  const fromNotes = contract.notes?.match(/GeM contract number:\s*(GEMC-\d+)/i)?.[1];
  if (fromNotes) return fromNotes;

  if (/^GEMC-\d+$/i.test(contract.contractNo ?? "")) return contract.contractNo!;

  return "View Contract PDF";
}

/** Public GeM bids search when no stored PDF URL exists. */
export function resolveGemBidSearchUrl(bidNo: string): string {
  return `${GEM_BASE}/all-bids`;
}
