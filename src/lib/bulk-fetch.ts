import { formatNetworkFetchError } from "../api";

/**
 * Gap between school resolve calls.
 * Keep short — each school is its own request; long delays make 222 schools feel broken.
 */
export const BULK_BATCH_DELAY_MS = 350;

const NETWORK_RETRY_WAIT_MS = 1500;
const GATEWAY_BACKOFF_MS = [3000, 8000] as const;
const THROTTLE_RETRY_MS = 65_000;
const MAX_RATE_LIMIT_PAUSES = 1;

export type BulkFetchWaitReason = "rate_limit" | "gateway" | "network" | "timeout";

function isRateLimitResponse(status: number, message: string): boolean {
  if (status === 429) return true;
  return /throttler|too many requests/i.test(message);
}

function isGatewayError(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = String((err as { name?: string }).name || "");
  const message = String((err as { message?: string }).message || "").toLowerCase();
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    message.includes("aborted") ||
    message.includes("the operation was aborted")
  );
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * One HTTP attempt for bulk resolve.
 * Do NOT attach AbortSignal.timeout here — browsers often surface aborted
 * cross-origin fetches as TypeError "Failed to fetch", which looked like
 * endless "Connection issue — retrying" and blocked progress at school 1.
 */
async function fetchOnce(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "x-flexhrm-no-retry": "1",
    },
  });
}

async function fetchWithNetworkRetry(
  url: string,
  init: RequestInit,
  onWait?: (reason: BulkFetchWaitReason, waitMs: number) => void,
): Promise<Response> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchOnce(url, init);
    } catch (err) {
      lastErr = err;
      if (isAbortError(err)) {
        throw new Error("Resolve request was cancelled. Click Resolve again to continue.");
      }
      // Single short retry only — then let the caller skip this school and move on.
      if (attempt === 0) {
        onWait?.("network", NETWORK_RETRY_WAIT_MS);
        await sleep(NETWORK_RETRY_WAIT_MS);
      }
    }
  }

  throw formatNetworkFetchError(
    lastErr,
    "Connection lost while resolving this school. Skipping and continuing…",
  );
}

/** Fetch one bulk-resolve chunk; bounded retries on rate limits / gateway errors. */
export async function fetchBulkBatch(
  url: string,
  init: RequestInit,
  opts?: {
    onWait?: (reason: BulkFetchWaitReason, waitMs: number) => void;
  },
): Promise<Response> {
  let gatewayAttempts = 0;
  let rateLimitPauses = 0;

  for (;;) {
    const res = await fetchWithNetworkRetry(url, init, opts?.onWait);
    let message = "";
    try {
      const data = (await res.clone().json()) as { message?: string };
      message = String(data?.message || "");
    } catch {
      // non-json response
    }

    if (isRateLimitResponse(res.status, message)) {
      rateLimitPauses += 1;
      if (rateLimitPauses > MAX_RATE_LIMIT_PAUSES) {
        throw new Error(
          "API rate limit kept rejecting resolve requests. Wait a minute, then resolve the next batch.",
        );
      }
      opts?.onWait?.("rate_limit", THROTTLE_RETRY_MS);
      await sleep(THROTTLE_RETRY_MS);
      continue;
    }

    if (isGatewayError(res.status)) {
      if (gatewayAttempts >= GATEWAY_BACKOFF_MS.length) {
        throw new Error(
          "Server gateway kept failing (502/503/504). Skipping this school and continuing…",
        );
      }
      const waitMs = GATEWAY_BACKOFF_MS[gatewayAttempts] ?? 8000;
      gatewayAttempts += 1;
      opts?.onWait?.("gateway", waitMs);
      await sleep(waitMs);
      continue;
    }

    return res;
  }
}
