export interface DataGatherSummary {
  blankFields: string[];
  missingDocuments: string[];
  hasWork: boolean;
}

export interface DataGatherLink {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  token: string;
  status: string;
  requestedBy: string;
  expiresAt: string;
  blankFields: string[];
  missingDocuments: string[];
  changeRequestId?: string;
  submittedAt?: string;
  createdAt?: string;
}

export interface DataGatherFormField {
  key: string;
  label: string;
  inputType: string;
  options?: string[];
}

export interface DataGatherForm {
  employeeName: string;
  employeeCode: string;
  expiresAt: string;
  fields: DataGatherFormField[];
  missingDocuments: string[];
  sessionExpiresAt?: string;
}

export interface CreateDataGatherLinkResult {
  link: DataGatherLink;
  otp: string;
  url: string;
}

const SESSION_HEADER = "X-Gather-Session";

function sessionStorageKey(token: string): string {
  return `flexhrm_gather_session_${token}`;
}

export function loadGatherSession(token: string): string | null {
  try {
    return sessionStorage.getItem(sessionStorageKey(token));
  } catch {
    return null;
  }
}

export function saveGatherSession(token: string, sessionToken: string): void {
  try {
    sessionStorage.setItem(sessionStorageKey(token), sessionToken);
  } catch {
    /* ignore */
  }
}

export function clearGatherSession(token: string): void {
  try {
    sessionStorage.removeItem(sessionStorageKey(token));
  } catch {
    /* ignore */
  }
}

async function readJsonBody<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error("Empty response from server.");
  }
  return JSON.parse(text) as T;
}

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const err = await readJsonBody<Record<string, unknown>>(res).catch(() => ({}));
  if (typeof err?.message === "string") return err.message;
  if (Array.isArray(err?.message)) return err.message.join(", ");
  return fallback;
}

export async function fetchDataGatherSummary(employeeId: string): Promise<DataGatherSummary> {
  const res = await fetch(`/api/employees/${encodeURIComponent(employeeId)}/data-gather/summary`);
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Failed to load data collection summary."));
  }
  return readJsonBody<DataGatherSummary>(res);
}

export async function fetchActiveDataGatherLink(
  employeeId: string,
): Promise<DataGatherLink | null> {
  const res = await fetch(
    `/api/employees/${encodeURIComponent(employeeId)}/data-gather/active-link`,
  );
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Failed to load active link."));
  }
  const data = await readJsonBody<{ link?: DataGatherLink | null }>(res);
  return data.link?.id ? data.link : null;
}

export async function createDataGatherLink(
  employeeId: string,
): Promise<CreateDataGatherLinkResult> {
  const res = await fetch(
    `/api/employees/${encodeURIComponent(employeeId)}/data-gather-link`,
    { method: "POST" },
  );
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Failed to generate data collection link."));
  }
  return res.json();
}

export async function revokeDataGatherLink(linkId: string): Promise<void> {
  const res = await fetch(
    `/api/employees/data-gather-links/${encodeURIComponent(linkId)}/revoke`,
    { method: "POST" },
  );
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Failed to revoke link."));
  }
}

export interface DataGatherLinkStatus {
  usable: boolean;
  status: string;
  message: string;
  employeeName?: string;
  expiresAt?: string;
}

export async function fetchDataGatherLinkStatus(
  token: string,
): Promise<DataGatherLinkStatus> {
  const res = await fetch(
    `/api/employees/data-gather/${encodeURIComponent(token)}/status`,
  );
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Failed to check link status."));
  }
  return readJsonBody<DataGatherLinkStatus>(res);
}

export async function verifyDataGatherOtp(
  token: string,
  otp: string,
): Promise<{ sessionToken: string; sessionExpiresAt: string }> {
  const res = await fetch(
    `/api/employees/data-gather/${encodeURIComponent(token)}/verify-otp`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp }),
    },
  );
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Invalid one-time password."));
  }
  return res.json();
}

export async function fetchDataGatherForm(
  token: string,
  sessionToken: string,
): Promise<DataGatherForm> {
  const res = await fetch(
    `/api/employees/data-gather/${encodeURIComponent(token)}/form`,
    {
      headers: { [SESSION_HEADER]: sessionToken },
    },
  );
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Failed to load form."));
  }
  return res.json();
}

export interface SubmitDataGatherDocumentPayload {
  label: string;
  fileBase64: string;
  mimeType: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  quality?: number;
}

export async function submitDataGatherForm(
  token: string,
  sessionToken: string,
  fieldUpdates: Record<string, string>,
  documents: SubmitDataGatherDocumentPayload[],
): Promise<{ changeRequestId: string; message: string }> {
  const res = await fetch(
    `/api/employees/data-gather/${encodeURIComponent(token)}/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SESSION_HEADER]: sessionToken,
      },
      body: JSON.stringify({ fieldUpdates, documents }),
    },
  );
  if (!res.ok) {
    throw new Error(await readApiErrorMessage(res, "Failed to submit details."));
  }
  return res.json();
}
