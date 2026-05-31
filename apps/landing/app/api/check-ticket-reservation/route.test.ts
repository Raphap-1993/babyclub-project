import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");

describe("GET /api/check-ticket-reservation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("expone conflicto cuando el documento ya tiene un QR activo en el evento", async () => {
    const { supabase } = createSupabaseMock({
      "table_reservations.select": [{ data: [], error: null }],
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-existing-1",
              person_id: "person-existing-1",
              table_reservation_id: null,
              qr_token: "qr-existing-1",
              full_name: "Phil Chota Ibaran",
              email: "francistc2001@gmail.com",
              phone: "987654321",
              doc_type: "dni",
              document: "12345678",
              dni: "12345678",
              code: { code: "GENERAL-1", type: "general" },
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { GET } = await import("./route");
    const req = {
      nextUrl: new URL(
        "http://localhost/api/check-ticket-reservation?event_id=event-1&doc_type=dni&document=12345678&full_name=Phil%20Chota%20Ibaran&email=francistc2001%40gmail.com&phone=987654321",
      ),
    };

    const res = await GET(req as any);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.has_active_ticket).toBe(true);
    expect(payload.conflict).toMatchObject({
      ticketId: "ticket-existing-1",
      reason: "document",
    });
    expect(String(payload.conflict_message || "")).toContain(
      "ya tiene un QR activo para este evento",
    );
  });
});
