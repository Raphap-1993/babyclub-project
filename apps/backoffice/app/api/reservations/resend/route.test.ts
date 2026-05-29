import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));
vi.mock("../email", () => ({
  sendApprovalEmail: vi.fn(),
  sendTicketEmail: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const { sendApprovalEmail, sendTicketEmail } = await import("../email");

describe("POST /api/reservations/resend", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.RESEND_API_KEY = "re_test_key";
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: {
        user: { id: "user-1" },
        staffId: "staff-1",
        role: "admin",
        staff: {},
      },
    });
  });

  it("rechaza el reenvío si el correo guardado en la reserva es inválido", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-1",
            full_name: "Ana Perez",
            email: "ana@test",
            phone: "999999999",
            doc_type: "dni",
            document: "12345678",
            status: "approved",
            codes: ["mesa-1"],
            event_id: "event-1",
            promoter_id: null,
            table: {
              id: "table-1",
              name: "Mesa 1",
              event_id: "event-1",
              event: {
                id: "event-1",
                name: "Evento",
                starts_at: "2099-02-01T04:00:00.000Z",
                location: "Lima",
              },
            },
            event: null,
          },
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/reservations/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "res-1" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).toContain("inválido");
    expect(sendTicketEmail).not.toHaveBeenCalled();
    expect(sendApprovalEmail).not.toHaveBeenCalled();
  });
});
