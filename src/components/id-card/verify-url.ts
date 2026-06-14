import { PRODUCTION_FRONTEND_ORIGIN } from "../../deploy-urls";
import { getIdCardVerifyBase } from "../../env";

/** Site origin used for public ID card verification links (no /employee suffix). */
export function getIdCardVerifySiteOrigin(): string {
  const base = getIdCardVerifyBase().replace(/\/employee\/?$/i, "").replace(/\/$/, "");
  if (base && /^https?:\/\//i.test(base)) return base;
  if (typeof window !== "undefined") return window.location.origin;
  return PRODUCTION_FRONTEND_ORIGIN;
}

/** QR-friendly public verification URL (dedicated route, not the portal root). */
export function getIdCardVerifyUrl(idNo: string): string {
  const id = idNo.trim();
  return `${getIdCardVerifySiteOrigin()}/verify/${encodeURIComponent(id)}`;
}

/** Public supervisor mobile login URL (open on phone to log field visits). */
export function getSupervisorLoginUrl(): string {
  return `${getIdCardVerifySiteOrigin()}/supervisor/login`;
}

/** Normalize route/query values, including malformed multi-line QR scanner URLs. */
export function parseIdCardFromVerifyParam(raw: string): string {
  let value = raw.trim();
  if (!value) return "";

  try {
    value = decodeURIComponent(value);
  } catch {
    // keep raw value when encoding is malformed
  }

  const firstLine = value.split(/\r?\n/)[0]?.trim() ?? "";

  if (/^https?:\/\//i.test(firstLine)) {
    try {
      const url = new URL(firstLine);
      const fromQuery = url.searchParams.get("id") ?? url.searchParams.get("idCard");
      if (fromQuery?.trim()) return parseIdCardFromVerifyParam(fromQuery);
      const segment = url.pathname.split("/").filter(Boolean).pop();
      if (segment) return parseIdCardFromVerifyParam(segment);
    } catch {
      // fall through
    }
  }

  if (firstLine && !firstLine.includes(":")) {
    return firstLine;
  }

  const idMatch = value.match(/(?:^|\r?\n)ID:([^\r\n]+)/i);
  if (idMatch?.[1]) return idMatch[1].trim();

  return firstLine || value;
}
