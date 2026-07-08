import type { Tender } from "../types";

const MANPOWER_TERM_RE =
  /tenure|basic pay|provident fund|esi|working days|duration of employment|estimated bid|in months|in inr/i;

function isLikelyConsigneeName(value: string): boolean {
  const name = value.trim().replace(/^[\d.]+\s+/, "");
  if (!name || !/[A-Za-z]/.test(name)) return false;
  if (MANPOWER_TERM_RE.test(name)) return false;
  if (/^(consignee|reporting|officer)$/i.test(name)) return false;
  if (/^number of\b/i.test(name)) return false;
  if (/^address\s*:/i.test(name)) return false;
  return true;
}

function extractConsigneeFromText(text: string): string {
  const patterns = [
    /consignee\s+reporting\s*\/?\s*officer\s*[:\-–]?\s*([A-Za-z][A-Za-z\s.'-]{1,80}?)(?=\s*,|\s+address|\n|$)/i,
    /(?:^|[\n,])\s*\d+\s+([A-Z][A-Za-z]+(?:\s+[A-Za-z.'-]+){1,4})\s*(?:\n|,|\d{6})/m,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1]?.trim() ?? "";
    if (isLikelyConsigneeName(candidate)) return candidate.replace(/^\d+\s+/, "").trim();
  }
  return "";
}

export function tenderOrganisation(tender: Tender): string {
  return tender.organisation?.trim() || tender.department?.trim() || "";
}

export function tenderDepartment(tender: Tender): string {
  const org = tenderOrganisation(tender);
  const dept = tender.department?.trim() || "";
  if (!dept || dept === org) return "";
  return dept;
}

export function tenderConsignee(tender: Tender): string {
  const raw = tender.consigneeOfficer?.trim() || tender.officerName?.trim() || "";
  if (isLikelyConsigneeName(raw)) return raw.replace(/^\d+\s+/, "").trim();

  const fromRaw = extractConsigneeFromText(raw);
  if (fromRaw) return fromRaw;

  const addReq = tender.additionalRequirements?.trim() || "";
  const fromAddReq = extractConsigneeFromText(addReq);
  if (fromAddReq) return fromAddReq;

  return "";
}

export function tenderMinistryLabel(tender: Tender): string {
  return tender.ministry?.trim() || "";
}

export function tenderListSubtitleLines(tender: Tender): string[] {
  const ministry = tenderMinistryLabel(tender);
  const organisation = tenderOrganisation(tender);
  const department = tenderDepartment(tender);
  const consignee = tenderConsignee(tender);

  const lines: string[] = [];
  if (ministry) lines.push(ministry);
  if (organisation && organisation !== ministry) lines.push(organisation);
  if (department && department !== organisation && department !== ministry) lines.push(department);
  if (consignee) lines.push(consignee);
  return lines;
}

export function tenderMatchesObserverSearch(tender: Tender, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return [
    tender.bidNo,
    tender.category,
    tender.ministry,
    tenderOrganisation(tender),
    tenderDepartment(tender),
    tenderConsignee(tender),
    tender.consigneeOfficer,
    tender.officerName,
    tender.address,
    tender.description,
    tender.notes,
    tender.status,
    tender.outcome,
    tender.additionalRequirements,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
