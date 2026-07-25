import { formatNetworkFetchError } from "../api";

/** Gap between bulk resolve batches — keeps under NestJS 120 req/min with headroom. */
export const BULK_BATCH_DELAY_MS = 800;

const THROTTLE_RETRY_MS = 65_000;
const GATEWAY_RETRY_MS = 10_000;

export type BulkFetchWaitReason = "rate_limit" | "gateway" | "network";

function isRateLimitResponse(status: number, message: string): boolean {
  if (status === 429) return true;
  return /throttler|too many requests/i.test(message);
}

function isGatewayError(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchWithNetworkRetry(
  url: string,
  init: RequestInit,
  onWait?: (reason: BulkFetchWaitReason, waitMs: number) => void,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt < 2) {
        const waitMs = 1500 * (attempt + 1);
        onWait?.("network", waitMs);
        await sleep(waitMs);
      }
    }
  }
  throw formatNetworkFetchError(lastErr);
}

/** Fetch one bulk-resolve batch; pauses and retries on rate limits / gateway errors instead of stopping. */
export async function fetchBulkBatch(
  url: string,
  init: RequestInit,
  opts?: {
    onWait?: (reason: BulkFetchWaitReason, waitMs: number) => void;
  },
): Promise<Response> {
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
      opts?.onWait?.("rate_limit", THROTTLE_RETRY_MS);
      await sleep(THROTTLE_RETRY_MS);
      continue;
    }

    if (isGatewayError(res.status)) {
      opts?.onWait?.("gateway", GATEWAY_RETRY_MS);
      await sleep(GATEWAY_RETRY_MS);
      continue;
    }

    return res;
  }
}
