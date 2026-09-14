const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

export function rateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (existing.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { allowed: true };
}

export function clientKey(ip: string | undefined, xff: string | string[] | undefined): string {
  const forwarded = Array.isArray(xff) ? xff[0] : (xff ?? "");
  const first = forwarded.split(",")[0]?.trim();
  return first || ip || "unknown";
}

/** Best-effort in-memory rate limiting. Not a security boundary for hostile traffic. */
export function _resetForTests() {
  buckets.clear();
}
