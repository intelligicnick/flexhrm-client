import { parseApiError } from "../api";

export interface StandaloneUpload {
  id: string;
  displayName: string;
  filename: string;
  monthKey?: string;
  description?: string;
  resourceKind?: string;
  resourceId?: string;
  resourceLabel?: string;
  mimeType: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  imagekitUrl?: string;
}

export interface ListUploadsParams {
  month?: string;
  resource?: string;
  q?: string;
}

function withQuery(path: string, params: ListUploadsParams) {
  const sp = new URLSearchParams();
  if (params.month) sp.set("month", params.month);
  if (params.resource) sp.set("resource", params.resource);
  if (params.q) sp.set("q", params.q);
  const q = sp.toString();
  return `${path}${q ? `?${q}` : ""}`;
}

async function uploadsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/uploads${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw await parseApiError(res, "Upload request failed");
  const text = await res.text();
  if (!text.trim()) return null as T;
  return JSON.parse(text) as T;
}

export function uploadFileUrl(id: string): string {
  return `/api/uploads/${id}/file`;
}

export function resourceOptionValue(kind: "block" | "office", id: string): string {
  return `${kind}:${id}`;
}

/** Form: user chose "Other" — show custom name field. */
export const OTHER_RESOURCE_PICK = "other:__pick__";

/** List filter: all custom "other" resources. */
export const OTHER_RESOURCE_FILTER_ALL = "other:*";

export const uploadsApi = {
  list: (params: ListUploadsParams = {}) =>
    uploadsFetch<StandaloneUpload[]>(withQuery("", params)),
  create: (body: {
    displayName: string;
    monthKey: string;
    description?: string;
    resourceKind: "block" | "office" | "other";
    resourceId: string;
    resourceLabel: string;
    filename: string;
    mimeType: string;
    fileBase64: string;
    originalSizeBytes: number;
  }) => uploadsFetch<StandaloneUpload>("", { method: "POST", body: JSON.stringify(body) }),
  delete: (id: string) => uploadsFetch<{ success: boolean }>(`/${id}`, { method: "DELETE" }),
};
