import { describe, expect, it } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";
import {
  EventTicketConflictError,
} from "shared/eventTicketIdentity";
import { createTicketForReservation } from "./utils";

describe("createTicketForReservation", () => {
  it("bloquea un segundo QR del mismo evento cuando coincide nombre+correo aunque el documento cambie", async () => {
    const { supabase } = createSupabaseMock({
      "persons.select": [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      "persons.insert": [{ data: { id: "person-new-1" }, error: null }],
      "tickets.select": [
        {
          data: [
            {
              id: "ticket-existing-1",
              person_id: "person-old-1",
              qr_token: "qr-existing-1",
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

    await expect(
      createTicketForReservation(supabase as any, {
        eventId: "event-1",
        tableName: "Entrada",
        fullName: "ALVARO VELA DEL AGUILA",
        email: "alvaro@example.com",
        phone: "993693940",
        dni: "71126993",
        docType: "dni",
        document: "71126993",
        codeType: "courtesy",
      }),
    ).rejects.toBeInstanceOf(EventTicketConflictError);
  });
});
