import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("POST /api/admin/reservations/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("rechaza la eliminación cuando no se confirma con 'eliminar'", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { role: "admin", staffId: "staff-1" } });
    const { POST } = await import("./route");

    const req = {
      json: async () => ({ id: "res-1", confirmation: "cancelar" }),
    } as any;

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("Confirmación inválida");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("archiva la reserva y desactiva códigos/tickets vinculados", async () => {
    (requireStaffRole as any).mockResolvedValue({ ok: true, context: { role: "admin", staffId: "staff-1" } });

    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-1",
            codes: ["LEG-01"],
            ticket_id: "ticket-main-1",
          },
          error: null,
        },
      ],
      "codes.select": [
        {
          data: [{ id: "code-1", code: "LEG-01" }],
          error: null,
        },
        {
          data: [{ id: "code-2", code: "LEG-02" }],
          error: null,
        },
      ],
      "codes.update": [{ data: null, error: null }],
      "tickets.select": [
        {
          data: [{ id: "ticket-2" }],
          error: null,
        },
        {
          data: [{ id: "ticket-3" }],
          error: null,
        },
      ],
      "tickets.update": [{ data: null, error: null }],
      "table_reservations.update": [{ data: null, error: null }],
    });

    (createClient as any).mockReturnValue(supabase);

    const { POST } = await import("./route");
    const req = {
      json: async () => ({ id: "res-1", confirmation: "eliminar" }),
    } as any;

    const res = await POST(req);
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.archived).toBe(true);
    expect(payload.deactivated_codes).toBe(2);
    expect(payload.deactivated_tickets).toBe(3);

    const codesUpdateCall = calls.find((call) => call.table === "codes" && call.op === "update");
    expect(codesUpdateCall?.payload).toEqual({ is_active: false });

    const ticketsUpdateCall = calls.find((call) => call.table === "tickets" && call.op === "update");
    expect(ticketsUpdateCall?.payload).toEqual({ is_active: false });

    const reservationUpdateCall = calls
      .filter((call) => call.table === "table_reservations" && call.op === "update")
      .at(0);

    expect(reservationUpdateCall?.payload?.is_active).toBe(false);
    expect(typeof reservationUpdateCall?.payload?.deleted_at).toBe("string");

    const hasIdFilter = reservationUpdateCall?.filters?.some(
      (filter) => filter.type === "eq" && filter.args[0] === "id" && filter.args[1] === "res-1"
    );
    const hasNotDeletedFilter = reservationUpdateCall?.filters?.some(
      (filter) => filter.type === "is" && filter.args[0] === "deleted_at" && filter.args[1] === null
    );

    expect(hasIdFilter).toBe(true);
    expect(hasNotDeletedFilter).toBe(true);
  });
});
