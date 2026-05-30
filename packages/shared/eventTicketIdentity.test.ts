import { describe, expect, it } from "vitest";
import { createSupabaseMock } from "../../tests/utils/supabaseMock";
import {
  buildEventTicketIdentityKeys,
  findActiveEventTicketConflict,
} from "./eventTicketIdentity";

describe("eventTicketIdentity", () => {
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
