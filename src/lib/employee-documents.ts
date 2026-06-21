import { EmployeeDocument } from "../types";
import { resolveDocumentViewUrl } from "./media-url";

export const DOCUMENT_LABEL_PRESETS = [
  "PAN Card",
  "Aadhaar Card",
  "Bank Passbook",
  "Bank Statement",
  "Address Proof",
  "Other",
] as const;

export type DocumentLabelPreset = (typeof DOCUMENT_LABEL_PRESETS)[number];

export function getEmployeeDocumentUrl(employeeId: string, doc: Pick<EmployeeDocument, "id" | "imagekitUrl">): string {
  return resolveDocumentViewUrl(doc, (docId) =>
    `/api/employees/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(docId)}`,
  );
}

export async function fetchEmployeeDocuments(
  employeeId: string,
): Promise<EmployeeDocument[]> {
  const res = await fetch(`/api/employees/${encodeURIComponent(employeeId)}/documents`);
  if (!res.ok) {
    throw new Error("Failed to load employee documents.");
  }
  return res.json();
}

export interface UploadEmployeeDocumentPayload {
  label: string;
  fileBase64: string;
  mimeType: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  quality?: number;
}

export interface ReplaceEmployeeDocumentPayload {
  fileBase64: string;
  mimeType: string;
  storedSizeBytes: number;
  quality?: number;
}

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  if (typeof err.message === "string") return err.message;
  if (Array.isArray(err.message)) return err.message.join(", ");
  return fallback;
}

export async function uploadEmployeeDocument(
  employeeId: string,
  payload: UploadEmployeeDocumentPayload,
): Promise<EmployeeDocument> {
  const res = await fetch(`/api/employees/${encodeURIComponent(employeeId)}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Failed to upload document."));
  }
  const data = await res.json();
  return data.record;
}

export async function uploadEmployeeDocumentsBulk(
  employeeId: string,
  documents: UploadEmployeeDocumentPayload[],
): Promise<EmployeeDocument[]> {
  const res = await fetch(
    `/api/employees/${encodeURIComponent(employeeId)}/documents/bulk`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents }),
    },
  );
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Failed to upload documents."));
  }
  const data = await res.json();
  return data.records;
}

export async function replaceEmployeeDocument(
  employeeId: string,
  docId: string,
  payload: ReplaceEmployeeDocumentPayload,
): Promise<EmployeeDocument> {
  const res = await fetch(
    `/api/employees/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(docId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Failed to save optimized document."));
  }
  const data = await res.json();
  return data.record;
}

export async function deleteEmployeeDocument(
  employeeId: string,
  docId: string,
): Promise<void> {
  const res = await fetch(
    `/api/employees/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(docId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error("Failed to delete document.");
  }
}
