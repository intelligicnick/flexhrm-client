import {
  BankInstrument,
  BankInstrumentDocument,
  BankInstrumentStatus,
  BankInstrumentType,
  CreateBankInstrumentInput,
} from "../types";

export const BANK_INSTRUMENT_STATUS_LABELS: Record<BankInstrumentStatus, string> = {
  submitted_to_dept: "Submitted to Dept",
  received_from_department: "Received from Department",
  returned_to_bank: "Returned to Bank",
  cancelled_received_fd: "Cancelled & Received FD",
  money_credited_back: "Money Credited Back to Account",
};

export const BANK_INSTRUMENT_TYPE_LABELS: Record<BankInstrumentType, string> = {
  bg: "BG",
  dd: "DD",
};

export function getBankInstrumentDocumentUrl(
  instrumentId: string,
  docId: string,
): string {
  return `/api/bank-instruments/${encodeURIComponent(instrumentId)}/documents/${encodeURIComponent(docId)}`;
}

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  if (typeof err.message === "string") return err.message;
  if (Array.isArray(err.message)) return err.message.join(", ");
  return fallback;
}

export async function fetchBankInstruments(filters?: {
  instrumentType?: BankInstrumentType;
  status?: BankInstrumentStatus;
  search?: string;
  contractId?: string;
  expiry?: "active" | "expiring_soon" | "expired" | "all";
}): Promise<BankInstrument[]> {
  const params = new URLSearchParams();
  if (filters?.instrumentType) params.set("instrumentType", filters.instrumentType);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.contractId) params.set("contractId", filters.contractId);
  if (filters?.expiry) params.set("expiry", filters.expiry);
  const qs = params.toString();
  const res = await fetch(`/api/bank-instruments${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to load BG/DD records.");
  return res.json();
}

export async function createBankInstrument(
  payload: CreateBankInstrumentInput,
): Promise<BankInstrument> {
  const res = await fetch("/api/bank-instruments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to create record."));
  return res.json();
}

export async function updateBankInstrument(
  id: string,
  payload: Partial<CreateBankInstrumentInput>,
): Promise<BankInstrument> {
  const res = await fetch(`/api/bank-instruments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to update record."));
  return res.json();
}

export async function deleteBankInstrument(id: string): Promise<void> {
  const res = await fetch(`/api/bank-instruments/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to delete record."));
}

export async function fetchBankInstrumentDocuments(
  instrumentId: string,
): Promise<BankInstrumentDocument[]> {
  const res = await fetch(`/api/bank-instruments/${encodeURIComponent(instrumentId)}/documents`);
  if (!res.ok) throw new Error("Failed to load documents.");
  return res.json();
}

export interface UploadBankInstrumentDocumentPayload {
  label: string;
  mimeType: string;
  fileBase64: string;
  originalSizeBytes: number;
  quality?: number;
}

export async function uploadBankInstrumentDocumentsBulk(
  instrumentId: string,
  documents: UploadBankInstrumentDocumentPayload[],
): Promise<BankInstrumentDocument[]> {
  const res = await fetch(
    `/api/bank-instruments/${encodeURIComponent(instrumentId)}/documents/bulk`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents }),
    },
  );
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to upload documents."));
  const data = await res.json();
  return data.records || [];
}

export async function deleteBankInstrumentDocument(
  instrumentId: string,
  docId: string,
): Promise<void> {
  const res = await fetch(
    `/api/bank-instruments/${encodeURIComponent(instrumentId)}/documents/${encodeURIComponent(docId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to delete document."));
}
