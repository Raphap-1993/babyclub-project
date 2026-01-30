import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  getSession: vi.fn(),
  refreshSession: vi.fn(),
};

vi.mock("@/lib/supabaseClient", () => ({
  supabaseClient: { auth },
}));

const { authedFetch } = await import("./authedFetch");

describe("authedFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as any;
  });

  it("usa token existente", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "token-1", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    });

    await authedFetch("http://localhost/api/test");

    const [, init] = (global.fetch as any).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("refresca token expirado", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "token-old", expires_at: Math.floor(Date.now() / 1000) - 10 } },
      error: null,
    });
    auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: "token-new", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    });

    await authedFetch("http://localhost/api/test");

    const [, init] = (global.fetch as any).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-new");
  });

  it("reintenta una vez tras 401", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "token-old", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    });
    auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: "token-new", expires_at: Math.floor(Date.now() / 1000) + 3600 } },
      error: null,
    });
    (global.fetch as any)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await authedFetch("http://localhost/api/test");

    expect((global.fetch as any).mock.calls.length).toBe(2);
    const [, firstInit] = (global.fetch as any).mock.calls[0];
    const [, secondInit] = (global.fetch as any).mock.calls[1];
    expect(new Headers(firstInit.headers).get("Authorization")).toBe("Bearer token-old");
    expect(new Headers(secondInit.headers).get("Authorization")).toBe("Bearer token-new");
  });
});
