import {
  CreateRenewalInput,
  Renewal,
  RenewalCategory,
  RenewalDocument,
} from "../types";

export const RENEWAL_TAB_TO_CATEGORY: Record<string, RenewalCategory> = {
  "Car Papers": "car_papers",
  "IT Renewals": "it_renewals",
  Licenses: "licenses",
};

export const CAR_PAPER_SUBTYPE_LABELS: Record<string, string> = {
  rc_book: "RC Book",
  insurance: "Insurance",
  road_tax: "Road Tax",
  permit: "Permit",
  puc: "PUC",
};

export const IT_RENEWAL_SUBTYPE_LABELS: Record<string, string> = {
  domain: "Domain",
  server: "Server",
};

export const LICENSE_SUBTYPE_LABELS: Record<string, string> = {
  travel_plus: "Travel Plus",
  intelligic_solutions: "Intelligic Solutions",
  rent_agreements: "Rent Agreements",
  travel_plus_huf: "Travel Plus HUF",
  intelligic_huf: "Intelligic HUF",
  intelligic_solutions_pvt_ltd: "Intelligic Solutions PVT LTD",
};

export function getSubtypeLabels(category: RenewalCategory): Record<string, string> {
  if (category === "car_papers") return CAR_PAPER_SUBTYPE_LABELS;
  if (category === "it_renewals") return IT_RENEWAL_SUBTYPE_LABELS;
  return LICENSE_SUBTYPE_LABELS;
}

export function getRenewalDocumentUrl(renewalId: string, docId: string): string {
  return `/api/renewals/${encodeURIComponent(renewalId)}/documents/${encodeURIComponent(docId)}`;
}

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  if (typeof err.message === "string") return err.message;
  if (Array.isArray(err.message)) return err.message.join(", ");
  return fallback;
}

export async function fetchRenewals(filters?: {
  category?: RenewalCategory;
  subType?: string;
  search?: string;
  expiry?: "active" | "expiring_soon" | "expired" | "all";
  ownerType?: string;
}): Promise<Renewal[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.set("category", filters.category);
  if (filters?.subType) params.set("subType", filters.subType);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.expiry) params.set("expiry", filters.expiry);
  if (filters?.ownerType) params.set("ownerType", filters.ownerType);
  const qs = params.toString();
  const res = await fetch(`/api/renewals${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to load renewals.");
  return res.json();
}

export async function createRenewal(payload: CreateRenewalInput): Promise<Renewal> {
  const res = await fetch("/api/renewals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to create renewal."));
  return res.json();
}

export async function updateRenewal(
  id: string,
  payload: Partial<CreateRenewalInput>,
): Promise<Renewal> {
  const res = await fetch(`/api/renewals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to update renewal."));
  return res.json();
}

export async function deleteRenewal(id: string): Promise<void> {
  const res = await fetch(`/api/renewals/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete renewal.");
}

export async function fetchRenewalDocuments(renewalId: string): Promise<RenewalDocument[]> {
  const res = await fetch(`/api/renewals/${encodeURIComponent(renewalId)}/documents`);
  if (!res.ok) throw new Error("Failed to load documents.");
  return res.json();
}

export interface UploadRenewalDocumentPayload {
  label?: string;
  fileBase64: string;
  mimeType: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  quality?: number;
}

export async function uploadRenewalDocument(
  renewalId: string,
  payload: UploadRenewalDocumentPayload,
): Promise<RenewalDocument> {
  const res = await fetch(`/api/renewals/${encodeURIComponent(renewalId)}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to upload document."));
  const data = await res.json();
  return data.record;
}

export async function uploadRenewalDocumentsBulk(
  renewalId: string,
  documents: UploadRenewalDocumentPayload[],
): Promise<RenewalDocument[]> {
  const res = await fetch(`/api/renewals/${encodeURIComponent(renewalId)}/documents/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to upload documents."));
  const data = await res.json();
  return data.records;
}

export async function replaceRenewalDocument(
  renewalId: string,
  docId: string,
  payload: Omit<UploadRenewalDocumentPayload, "label" | "originalSizeBytes"> & {
    storedSizeBytes: number;
    quality?: number;
  },
): Promise<RenewalDocument> {
  const res = await fetch(
    `/api/renewals/${encodeURIComponent(renewalId)}/documents/${encodeURIComponent(docId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to update document."));
  const data = await res.json();
  return data.record;
}

export async function deleteRenewalDocument(
  renewalId: string,
  docId: string,
): Promise<void> {
  const res = await fetch(
    `/api/renewals/${encodeURIComponent(renewalId)}/documents/${encodeURIComponent(docId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Failed to delete document.");
}
