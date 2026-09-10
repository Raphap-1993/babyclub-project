import { describe, expect, it } from "vitest";
import { createSupabaseMock } from "../../tests/utils/supabaseMock";
import {
  buildEventTicketIdentityKeys,
  findActiveEventTicketConflict,
} from "./eventTicketIdentity";

describe("eventTicketIdentity", () => {
  it("permite reemplazar un general vencido no usado sólo en el flujo de nueva compra", async () => {
    const ticket = {
      id: "expired-free",
      person_id: "person-1",
      doc_type: "dni",
      document: "12345678",
      used: false,
      code: { type: "general", expires_at: "2000-01-01T00:00:00Z" },
      event: { starts_at: "2000-01-01T00:00:00Z", is_active: true },
    };
    const { supabase } = createSupabaseMock({
      "tickets.select": { data: [ticket], error: null },
    });
    const input = {
      eventId: "event-1",
      personId: "person-1",
      document: "12345678",
      docType: "dni" as const,
    };
    expect(
      await findActiveEventTicketConflict(supabase as any, {
        ...input,
        allowExpiredGeneralReplacement: true,
      }),
    ).toBeNull();
    expect(
      await findActiveEventTicketConflict(supabase as any, input),
    ).toMatchObject({ ticketId: "expired-free" });
  });

  it("un free vencido usado sigue bloqueando otra entrada para la misma persona", async () => {
    const { supabase } = createSupabaseMock({
      "tickets.select": {
        data: [
          {
            id: "used-free",
            person_id: "person-1",
            used: true,
            code: { type: "general", expires_at: "2000-01-01T00:00:00Z" },
            event: { is_active: true },
          },
        ],
        error: null,
      },
    });
    expect(
      await findActiveEventTicketConflict(supabase as any, {
        eventId: "event-1",
        personId: "person-1",
        allowExpiredGeneralReplacement: true,
      }),
    ).toMatchObject({ ticketId: "used-free" });
  });

  it("revisa todas las páginas antes de permitir reemplazo de un free vencido", async () => {
    const expired = Array.from({ length: 500 }, (_, i) => ({
      id: `expired-${i}`,
      person_id: "person-1",
      used: false,
      code: { type: "general", expires_at: "2000-01-01T00:00:00Z" },
      event: { is_active: true },
    }));
    const { supabase, calls } = createSupabaseMock({
      "tickets.select": [
        { data: expired, error: null },
        {
          data: [
            {
              id: "valid-paid",
              person_id: "person-1",
              code: { type: "courtesy" },
            },
          ],
          error: null,
        },
      ],
    });
    expect(
      await findActiveEventTicketConflict(supabase as any, {
        eventId: "event-1",
        personId: "person-1",
        allowExpiredGeneralReplacement: true,
      }),
    ).toMatchObject({ ticketId: "valid-paid" });
    expect(calls.filter((call) => call.table === "tickets")).toHaveLength(2);
  });

  it("arma llaves por documento y por nombre+contacto", () => {
    const keys = buildEventTicketIdentityKeys({
      fullName: "Álvaro  Vela del Aguila",
      email: "alvaro@example.com",
      phone: "+51 993 663 940",
      docType: "dni",
      document: "71126993",
    });

    expect(keys).toEqual([
      "document:dni:71126993",
      "name_email:ALVARO VELA DEL AGUILA:alvaro@example.com",
      "name_phone:ALVARO VELA DEL AGUILA:51993663940",
    ]);
  });

  it("detecta conflicto por nombre+email en el mismo evento aunque cambie el documento", async () => {
    const { supabase } = createSupabaseMock({
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-existing-1",
              person_id: "person-old-1",
              table_reservation_id: null,
              qr_token: "qr-old-1",
              full_name: "ALVARO VELA DEL AGUILA",
              email: "alvaro@example.com",
              phone: "993663940",
              doc_type: "dni",
              document: "99366394",
              dni: "99366394",
              code: { code: "RAVE256", type: "general" },
            },
          ],
          error: null,
        },
      ],
    });

    const conflict = await findActiveEventTicketConflict(supabase as any, {
      eventId: "event-1",
      fullName: "Alvaro Vela del Aguila",
      email: "alvaro@example.com",
      phone: "993693940",
      docType: "dni",
      document: "71126993",
    });

    expect(conflict).toMatchObject({
      ticketId: "ticket-existing-1",
      code: "RAVE256",
      codeType: "general",
      reason: "full_name_email",
    });
  });
});
