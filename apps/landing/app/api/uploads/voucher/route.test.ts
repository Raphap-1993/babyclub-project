import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("POST /api/uploads/voucher", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("acepta comprobantes HEIC aunque el navegador no envie MIME type", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://example.com/voucher.heic" },
    });
    const storageFrom = vi.fn().mockReturnValue({ upload, getPublicUrl });
    const supabase = {
      storage: {
        getBucket: vi.fn().mockResolvedValue({ error: null }),
        createBucket: vi.fn(),
        from: storageFrom,
      },
    };

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const form = new FormData();
    form.append("file", new File(["voucher"], "comprobante.HEIC", { type: "" }));
    form.append("tableName", "mesa-18");

    const res = await POST(
      new Request("http://localhost/api/uploads/voucher", {
        method: "POST",
        body: form,
      }),
    );
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^vouchers\/mesa-18-\d+\.heic$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/heic" }),
    );
  });

  it("rechaza comprobantes mayores al limite publico", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://example.com/voucher.jpg" },
    });
    const supabase = {
      storage: {
        getBucket: vi.fn().mockResolvedValue({ error: null }),
        createBucket: vi.fn(),
        from: vi.fn().mockReturnValue({ upload, getPublicUrl }),
      },
    };

    (createClient as any).mockReturnValue(supabase);
    const { POST } = await import("./route");

    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "comprobante.jpg", {
        type: "image/jpeg",
      }),
    );
    form.append("tableName", "mesa");

    const res = await POST(
      new Request("http://localhost/api/uploads/voucher", {
        method: "POST",
        body: form,
      }),
    );
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("5MB");
    expect(upload).not.toHaveBeenCalled();
  });
});
