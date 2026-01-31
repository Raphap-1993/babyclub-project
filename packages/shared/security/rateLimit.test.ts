import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, resetRateLimitStore } from "./rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite hasta N y bloquea N+1", () => {
    const req = new Request("http://localhost", { headers: { "x-forwarded-for": "1.2.3.4" } });
    const limit = 2;
    const windowMs = 60_000;

    const first = rateLimit(req, { keyPrefix: "test", limit, windowMs });
    const second = rateLimit(req, { keyPrefix: "test", limit, windowMs });
    const third = rateLimit(req, { keyPrefix: "test", limit, windowMs });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("resetea el contador tras la ventana", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

    const req = new Request("http://localhost", { headers: { "x-forwarded-for": "5.6.7.8" } });
    const limit = 1;
    const windowMs = 1000;

    const first = rateLimit(req, { keyPrefix: "test", limit, windowMs });
    const second = rateLimit(req, { keyPrefix: "test", limit, windowMs });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);

    vi.setSystemTime(new Date("2025-01-01T00:00:02Z"));
    const third = rateLimit(req, { keyPrefix: "test", limit, windowMs });
    expect(third.ok).toBe(true);
  });
});
