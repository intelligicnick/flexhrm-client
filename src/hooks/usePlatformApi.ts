import { useCallback, useEffect, useState } from "react";
import { apiUrl, parseApiError } from "../api";

export function usePlatformApi<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl(path), { credentials: "include" });
      if (!res.ok) throw await parseApiError(res, "Request failed");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload, ...deps]);

  return { data, loading, error, reload };
}

export async function platformPost(path: string, body?: unknown) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await parseApiError(res, "Request failed");
  return res.json();
}

export async function platformPatch(path: string, body?: unknown) {
  const res = await fetch(apiUrl(path), {
    method: "PATCH",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await parseApiError(res, "Request failed");
  return res.json();
}
