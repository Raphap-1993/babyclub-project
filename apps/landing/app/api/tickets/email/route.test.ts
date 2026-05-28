import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("shared/email/resend", () => ({
  sendEmail: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { sendEmail } = await import("shared/email/resend");

function buildTicketEmailSupabase() {
  return createSupabaseMock({
    "tickets.select": [
      {
        data: {
          id: "ticket-1",
          qr_token: "qr-token-1",
          full_name: "Ana Perez",
          doc_type: "dni",
          document: "12345678",
          dni: "12345678",
          email: "ana@test.com",
          phone: "999999999",
          code: {
            code: "FREE-123",
            type: "free",
            expires_at: null,
            promoter_id: null,
          },
          event: {
            name: "Baby Friday",
            starts_at: "2099-02-01T04:00:00.000Z",
            location: "Lima",
          },
        },
        error: null,
      },
    ],
    "process_logs.insert": [{ data: null, error: null }],
  });
}

describe("POST /api/tickets/email", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
  });

  it("retorna error cuando el proveedor responde error payload", async () => {
    const { supabase } = buildTicketEmailSupabase();
    (createClient as any).mockReturnValue(supabase);
    (sendEmail as any).mockResolvedValue({
      data: null,
      error: { message: "blocked by provider" },
    });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tickets/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: "ticket-1", email: "ana@test.com" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("blocked by provider");
  });

  it("normaliza el dominio del correo antes de enviarlo", async () => {
    const { supabase } = buildTicketEmailSupabase();
    (createClient as any).mockReturnValue(supabase);
    (sendEmail as any).mockResolvedValue({
      data: { id: "email-1" },
      error: null,
    });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tickets/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: "ticket-1",
        email: "Ana.Cliente@OUTLOOK.com",
      }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect((sendEmail as any).mock.calls[0][0].to).toBe(
      "Ana.Cliente@outlook.com",
    );
  });
});
