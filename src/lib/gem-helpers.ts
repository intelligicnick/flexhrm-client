const GEM_BASE = "https://bidplus.gem.gov.in";
const GEM_CONTRACT_PDF_BASE = "https://fulfilment.gem.gov.in/contract/fds";

/** Chrome built-in PDF viewer extension — opens GeM PDFs directly in the browser. */
export const CHROME_PDF_VIEWER_EXTENSION_ID = "oemmndcbldboiebfnladdacbdfmadadm";

export function unwrapChromePdfViewerUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  const prefix = `chrome-extension://${CHROME_PDF_VIEWER_EXTENSION_ID}/`;
  if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  return trimmed;
}

/** Wrap a GeM HTTPS PDF URL so Chrome opens it in the built-in PDF viewer. */
export function wrapChromePdfViewerUrl(url: string): string {
  const absolute = unwrapChromePdfViewerUrl(url);
  if (!absolute || !/^https?:\/\//i.test(absolute)) return url;
  if (!/gem\.gov\.in/i.test(absolute)) return absolute;
  return `chrome-extension://${CHROME_PDF_VIEWER_EXTENSION_ID}/${absolute}`;
}

export function extractGemDocId(gemDocUrl: string): string {
  const match = unwrapChromePdfViewerUrl(gemDocUrl).match(
    /(?:showbidDocument|downloadBidDocument)\/(\d+)/i,
  );
  return match?.[1] ?? "";
}

/** Extract GeM fulfilment contractId token from a URL or stored value. */
export function extractGemContractId(input: string): string {
  const trimmed = unwrapChromePdfViewerUrl(input?.trim() ?? "");
  if (!trimmed) return "";

  const fromQuery = trimmed.match(/[?&]contractId=([^&]+)/i)?.[1];
  if (fromQuery) return decodeURIComponent(fromQuery);

  if (!/^https?:\/\//i.test(trimmed) && /^[A-Za-z0-9+/=%._-]+$/.test(trimmed)) {
    return decodeURIComponent(trimmed);
  }

  return "";
}

export function buildGemContractPdfUrl(contractId: string): string {
  const id = contractId.trim();
  if (!id) return "";
  return `${GEM_CONTRACT_PDF_BASE}?contractId=${encodeURIComponent(id)}`;
}

/** Raw GeM bid PDF HTTPS URL (for fetch/proxy). */
export function resolveGemBidPdfSourceUrl(tender: { gemDocUrl?: string }): string | null {
  const raw = tender.gemDocUrl?.trim() ?? "";
  if (!raw) return null;

  const unwrapped = unwrapChromePdfViewerUrl(raw);
  const docId = extractGemDocId(unwrapped);
  if (docId) return `${GEM_BASE}/showbidDocument/${docId}`;

  if (/gem\.gov\.in/i.test(unwrapped)) return unwrapped;
  return null;
}

/** GeM bid PDF viewer URL (opens in Chrome PDF viewer via extension link). */
export function resolveGemBidPdfUrl(tender: { gemDocUrl?: string }): string | null {
  const source = resolveGemBidPdfSourceUrl(tender);
  return source ? wrapChromePdfViewerUrl(source) : null;
}

/** Raw GeM fulfilment contract PDF HTTPS URL (for fetch/proxy). */
export function resolveGemContractPdfSourceUrl(contract: {
  contractNo?: string;
  gemContractPdfUrl?: string;
  gemContractId?: string;
}): string | null {
  const explicit = contract.gemContractPdfUrl?.trim() ?? "";
  if (explicit) return unwrapChromePdfViewerUrl(explicit);

  const contractId =
    contract.gemContractId?.trim() ||
    extractGemContractId(contract.contractNo ?? "") ||
    extractGemContractId(contract.gemContractPdfUrl ?? "");
  if (contractId) return buildGemContractPdfUrl(contractId);

  const raw = contract.contractNo?.trim() ?? "";
  if (/fulfilment\.gem\.gov\.in\/contract\/fds/i.test(raw)) {
    return unwrapChromePdfViewerUrl(raw);
  }

  return null;
}

/** GeM fulfilment contract PDF viewer URL (opens in Chrome PDF viewer via extension link). */
export function resolveGemContractPdfUrl(contract: {
  contractNo?: string;
  gemContractPdfUrl?: string;
  gemContractId?: string;
}): string | null {
  const source = resolveGemContractPdfSourceUrl(contract);
  return source ? wrapChromePdfViewerUrl(source) : null;
}

/** Label shown in Contract No column when the stored value is a PDF URL. */
export function resolveGemContractNoLabel(contract: {
  contractNo?: string;
  gemContractPdfUrl?: string;
  gemContractId?: string;
  notes?: string;
}): string {
  const pdfUrl = resolveGemContractPdfSourceUrl(contract);
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
