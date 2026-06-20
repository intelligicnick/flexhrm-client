import {
  BgDdDocument,
  BgDdInstrumentType,
  BgDdRecord,
  BgDdStatus,
  CreateBgDdInput,
} from "../types";

export const BG_DD_STATUS_LABELS: Record<BgDdStatus, string> = {
  submitted_to_dept: "Submitted to Dept",
  received_from_department: "Received from Department",
  returned_to_bank: "Returned to Bank",
  cancelled: "Cancelled",
  received_fd: "Received FD",
  money_credited_back: "Money Credited Back to Account",
};

export const BG_DD_STATUS_STYLES: Record<BgDdStatus, string> = {
  submitted_to_dept: "bg-sky-50 text-sky-700 border-sky-200",
  received_from_department: "bg-emerald-50 text-emerald-700 border-emerald-200",
  returned_to_bank: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-slate-200 text-slate-600 border-slate-300",
  received_fd: "bg-violet-50 text-violet-700 border-violet-200",
  money_credited_back: "bg-teal-50 text-teal-700 border-teal-200",
};

export const BG_DD_INSTRUMENT_LABELS: Record<BgDdInstrumentType, string> = {
  bg: "Bank Guarantee",
  dd: "Demand Draft",
};

export function getBgDdDocumentUrl(bgDdId: string, docId: string): string {
  return `/api/bg-dd/${encodeURIComponent(bgDdId)}/documents/${encodeURIComponent(docId)}`;
}

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  if (typeof err.message === "string") return err.message;
  if (Array.isArray(err.message)) return err.message.join(", ");
  return fallback;
}

export async function fetchBgDdRecords(filters?: {
  instrumentType?: BgDdInstrumentType;
  status?: BgDdStatus;
  contractId?: string;
  search?: string;
  expiry?: "active" | "expiring_soon" | "expired" | "all";
}): Promise<BgDdRecord[]> {
  const params = new URLSearchParams();
  if (filters?.instrumentType) params.set("instrumentType", filters.instrumentType);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.contractId) params.set("contractId", filters.contractId);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.expiry) params.set("expiry", filters.expiry);
  const qs = params.toString();
  const res = await fetch(`/api/bg-dd${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to load BG/DD records.");
  return res.json();
}

export async function createBgDdRecord(payload: CreateBgDdInput): Promise<BgDdRecord> {
  const res = await fetch("/api/bg-dd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to create BG/DD record."));
  return res.json();
}

export async function updateBgDdRecord(
  id: string,
  payload: Partial<CreateBgDdInput>,
): Promise<BgDdRecord> {
  const res = await fetch(`/api/bg-dd/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to update BG/DD record."));
  return res.json();
}

export async function deleteBgDdRecord(id: string): Promise<void> {
  const res = await fetch(`/api/bg-dd/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete BG/DD record.");
}

export async function fetchBgDdDocuments(bgDdId: string): Promise<BgDdDocument[]> {
  const res = await fetch(`/api/bg-dd/${encodeURIComponent(bgDdId)}/documents`);
  if (!res.ok) throw new Error("Failed to load documents.");
  return res.json();
}

export interface UploadBgDdDocumentPayload {
  label?: string;
  fileBase64: string;
  mimeType: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  quality?: number;
}

export async function uploadBgDdDocumentsBulk(
  bgDdId: string,
  documents: UploadBgDdDocumentPayload[],
): Promise<BgDdDocument[]> {
  const res = await fetch(`/api/bg-dd/${encodeURIComponent(bgDdId)}/documents/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to upload documents."));
  const data = await res.json();
  return data.records;
}

export async function deleteBgDdDocument(bgDdId: string, docId: string): Promise<void> {
  const res = await fetch(
    `/api/bg-dd/${encodeURIComponent(bgDdId)}/documents/${encodeURIComponent(docId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Failed to delete document.");
}
