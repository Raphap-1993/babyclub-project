type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
  getKey?: (req: Request) => string | null | undefined;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetMs: number;
  resetAt: number;
  limit: number;
  key: string;
};

const store = new Map<string, RateLimitEntry>();

export function resetRateLimitStore() {
  store.clear();
}

export function parseRateLimitEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const direct = (req as any)?.ip;
  if (typeof direct === "string" && direct.trim().length > 0) return direct.trim();
  return "unknown";
}

export function rateLimit(req: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const keyPart = options.getKey ? options.getKey(req) : getClientIp(req);
  const key = `${options.keyPrefix}:${keyPart || "unknown"}`;

  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + options.windowMs };
    store.set(key, entry);
  }

  if (entry.count >= options.limit) {
    const resetMs = Math.max(0, entry.resetAt - now);
    return {
      ok: false,
      remaining: 0,
      resetMs,
      resetAt: entry.resetAt,
      limit: options.limit,
      key,
    };
  }

  entry.count += 1;
  const remaining = Math.max(0, options.limit - entry.count);
  const resetMs = Math.max(0, entry.resetAt - now);

  return {
    ok: true,
    remaining,
    resetMs,
    resetAt: entry.resetAt,
    limit: options.limit,
    key,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "Retry-After": String(Math.ceil(result.resetMs / 1000)),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(result.resetAt),
  };
}
