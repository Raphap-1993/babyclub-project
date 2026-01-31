import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitStore } from "shared/security/rateLimit";

describe("GET /api/reniec rate limit", () => {
  beforeEach(() => {
    vi.resetModules();
    resetRateLimitStore();
    process.env.API_PERU_TOKEN = "test-token";
    process.env.RATE_LIMIT_RENIEC_PER_MIN = "1";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { nombres: "Ana", apellido_paterno: "Perez", apellido_materno: "Lopez" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    ) as any;
  });

  afterEach(() => {
    resetRateLimitStore();
    delete process.env.API_PERU_TOKEN;
    delete process.env.RATE_LIMIT_RENIEC_PER_MIN;
    vi.restoreAllMocks();
  });

  it("retorna 429 al exceder el límite", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/reniec?dni=12345678", {
      headers: { "x-forwarded-for": "9.9.9.9" },
    });

    const first = await GET(req as any);
    expect(first.status).not.toBe(429);

    const second = await GET(req as any);
    expect(second.status).toBe(429);
    const payload = await second.json();
    expect(payload.error).toBe("rate_limited");
  });
});
