import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("../../../../../../../../backoffice/app/api/reservations/utils", () => ({
  createTicketForReservation: vi.fn(),
}));
vi.mock("../../../../../../../../backoffice/app/api/reservations/email", () => ({
  sendTicketEmail: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { createTicketForReservation } = await import(
  "../../../../../../../../backoffice/app/api/reservations/utils"
);
const { sendTicketEmail } = await import(
  "../../../../../../../../backoffice/app/api/reservations/email"
);

describe("POST /api/ticket-reservations/[id]/units/[unitId]/issue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("emite solo la unidad solicitada reutilizando su código por unidad", async () => {
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": [
        {
          data: {
            id: "res-ticket-1",
            sale_origin: "ticket",
            status: "approved",
            event_id: "event-1",
            full_name: "Comprador Principal",
            email: "buyer@test.com",
            phone: "999999999",
            doc_type: "dni",
            document: "11112222",
            promoter_id: null,
            ticket_type_label: "ALL NIGHT DUO",
            codes: ["CODE-UNIT-1", "CODE-UNIT-2", "CODE-UNIT-3"],
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: [
            {
              id: "unit-1",
              unit_index: 1,
              package_index: 1,
              person_index: 1,
              status: "issued",
              full_name: "Comprador Principal",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@test.com",
              phone: "999999999",
              ticket_id: "ticket-buyer-1",
            },
            {
              id: "unit-2",
              unit_index: 2,
              package_index: 1,
              person_index: 2,
              status: "nominated",
              full_name: "Invitada Uno",
              doc_type: "dni",
              document: "22223333",
              email: "guest1@test.com",
              phone: "988888881",
              ticket_id: null,
            },
            {
              id: "unit-3",
              unit_index: 3,
              package_index: 2,
              person_index: 1,
              status: "nominated",
              full_name: "Invitada Dos",
              doc_type: "dni",
              document: "33334444",
              email: "guest2@test.com",
              phone: "988888882",
              ticket_id: null,
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "unit-1",
              unit_index: 1,
              package_index: 1,
              person_index: 1,
              status: "issued",
              full_name: "Comprador Principal",
              doc_type: "dni",
              document: "11112222",
              email: "buyer@test.com",
              phone: "999999999",
              ticket_id: "ticket-buyer-1",
            },
            {
              id: "unit-2",
              unit_index: 2,
              package_index: 1,
              person_index: 2,
              status: "nominated",
              full_name: "Invitada Uno",
              doc_type: "dni",
              document: "22223333",
              email: "guest1@test.com",
              phone: "988888881",
              ticket_id: null,
            },
            {
              id: "unit-3",
              unit_index: 3,
              package_index: 2,
              person_index: 1,
              status: "issued",
              full_name: "Invitada Dos",
              doc_type: "dni",
              document: "33334444",
              email: "guest2@test.com",
              phone: "988888882",
              ticket_id: "ticket-unit-3",
            },
          ],
          error: null,
        },
      ],
      "codes.select": [
        {
          data: [
            { id: "code-1", code: "CODE-UNIT-1", person_index: 1 },
            { id: "code-2", code: "CODE-UNIT-2", person_index: 2 },
            { id: "code-3", code: "CODE-UNIT-3", person_index: 3 },
          ],
          error: null,
        },
      ],
      "ticket_reservation_units.update": [{ data: null, error: null }],
      "table_reservations.update": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);
    (createTicketForReservation as any).mockResolvedValue({
      ticketId: "ticket-unit-3",
      code: "CODE-UNIT-3",
    });
    (sendTicketEmail as any).mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const req = new Request(
      "http://localhost/api/ticket-reservations/res-ticket-1/units/unit-3/issue",
      { method: "POST" },
    );

    const res = await POST(req as any, {
      params: Promise.resolve({ id: "res-ticket-1", unitId: "unit-3" }),
    });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      issuedCount: 1,
    });
    expect(createTicketForReservation).toHaveBeenCalledTimes(1);
    expect(createTicketForReservation).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        fullName: "Invitada Dos",
        document: "33334444",
        reuseCodes: ["CODE-UNIT-3"],
        tableReservationId: "res-ticket-1",
      }),
    );

    const unitUpdates = calls.filter(
      (call) =>
        call.table === "ticket_reservation_units" && call.op === "update",
    );
    expect(unitUpdates).toHaveLength(1);
    expect(unitUpdates[0].payload).toMatchObject({
      full_name: "Invitada Dos",
      status: "issued",
      ticket_id: "ticket-unit-3",
    });
    expect(sendTicketEmail).toHaveBeenCalledWith({
      supabase,
      ticketId: "ticket-unit-3",
      toEmail: "guest2@test.com",
    });
  });
});
