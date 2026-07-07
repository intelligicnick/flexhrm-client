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

function normalizeGemContractId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

/** Extract GeM fulfilment contractId token from a URL or stored value. */
export function extractGemContractId(input: string): string {
  const trimmed = unwrapChromePdfViewerUrl(input?.trim() ?? "");
  if (!trimmed) return "";

  const fromQuery = trimmed.match(/[?&]contractId=([^&#]+)/i)?.[1];
  if (fromQuery) return normalizeGemContractId(fromQuery);

  const fromPath = trimmed.match(/contract\/fds\/([A-Za-z0-9+/=%._-]+)/i)?.[1];
  if (fromPath) return normalizeGemContractId(fromPath);

  if (!/^https?:\/\//i.test(trimmed) && /^[A-Za-z0-9+/=%._-]+$/.test(trimmed)) {
    if (/^GEMC-\d+$/i.test(trimmed)) return "";
    return normalizeGemContractId(trimmed);
  }

  return "";
}

/** Extract raw contractId query value from a URL (everything after contractId=, not decoded). */
export function extractGemContractIdQueryValue(input: string): string {
  const trimmed = unwrapChromePdfViewerUrl(input?.trim() ?? "");
  if (!trimmed) return "";

  const fromQuery = trimmed.match(/[?&]contractId=([^&#]*)/i)?.[1];
  if (fromQuery) return fromQuery;

  const fromPath = trimmed.match(/contract\/fds\/([A-Za-z0-9+/=%._-]+)/i)?.[1];
  if (fromPath) {
    if (/%[0-9A-Fa-f]{2}/.test(fromPath)) return fromPath;
    return encodeURIComponent(normalizeGemContractId(fromPath));
  }

  if (!/^https?:\/\//i.test(trimmed) && /^[A-Za-z0-9+/=%._-]+$/.test(trimmed)) {
    if (/%[0-9A-Fa-f]{2}/.test(trimmed)) return trimmed;
    return encodeURIComponent(normalizeGemContractId(trimmed));
  }

  return "";
}

/** Full GeM contractId token (decoded, including trailing = padding). */
export function resolveGemContractId(contract: {
  contractNo?: string;
  gemContractPdfUrl?: string;
  gemContractId?: string;
  notes?: string;
}): string {
  const fromNotes = contract.notes?.match(/GeM contractId:\s*([A-Za-z0-9+/]+=*)/i)?.[1];
  const candidates = [
    contract.gemContractId,
    contract.gemContractPdfUrl,
    fromNotes,
    contract.contractNo,
  ];

  for (const candidate of candidates) {
    const id = extractGemContractId(candidate ?? "");
    if (id) return id;
  }

  return "";
}

/** ContractId as it appears in the PDF URL after contractId= (for copy). */
export function resolveGemContractIdForCopy(contract: {
  gemContractId?: string;
  gemContractPdfUrl?: string;
  contractNo?: string;
  notes?: string;
}): string {
  const contractId = resolveGemContractId(contract);
  return contractId ? encodeURIComponent(contractId) : "";
}

/** Full GeM contract PDF HTTPS link for copy/paste (decoded contractId, trailing = preserved). */
export function resolveGemContractFullLinkForCopy(contract: {
  gemContractId?: string;
  gemContractPdfUrl?: string;
  contractNo?: string;
  notes?: string;
}): string {
  const contractId = resolveGemContractId(contract);
  if (!contractId) return "";
  return `${GEM_CONTRACT_PDF_BASE}?contractId=${contractId}`;
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
  notes?: string;
}): string | null {
  const contractId = resolveGemContractId(contract);
  if (contractId) return buildGemContractPdfUrl(contractId);
  return null;
}

/** GeM fulfilment contract PDF viewer URL (opens in Chrome PDF viewer via extension link). */
export function resolveGemContractPdfUrl(contract: {
  contractNo?: string;
  gemContractPdfUrl?: string;
  gemContractId?: string;
  notes?: string;
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
