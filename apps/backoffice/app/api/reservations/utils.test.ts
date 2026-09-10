import { describe, expect, it } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";
import { EventTicketConflictError } from "shared/eventTicketIdentity";
import { createReservationCodes, createTicketForReservation } from "./utils";

describe("createTicketForReservation", () => {
  it("crea persona distinta cuando el asistente comparte contactos del comprador pero tiene otro documento", async () => {
    const { supabase, calls } = createSupabaseMock({
      "persons.select": [
        { data: null, error: null },
        { data: null, error: null },
        {
          data: { id: "person-buyer", doc_type: "dni", document: "11112222" },
          error: null,
        },
      ],
      "persons.insert": { data: { id: "person-guest" }, error: null },
      "tickets.select": {
        data: [
          {
            id: "ticket-buyer",
            person_id: "person-buyer",
            full_name: "Persona Compradora",
            doc_type: "dni",
            document: "11112222",
            email: "shared@example.test",
            phone: "999999999",
          },
        ],
        error: null,
      },
      "codes.select": {
        data: {
          id: "code-guest",
          type: "courtesy",
          table_reservation_id: "reservation-1",
        },
        error: null,
      },
      "tickets.insert": { data: { id: "ticket-guest" }, error: null },
    });
    await expect(
      createTicketForReservation(supabase as any, {
        eventId: "event-1",
        tableName: "Entrada",
        fullName: "Persona Invitada",
        docType: "dni",
        document: "33334444",
        dni: "33334444",
        email: "shared@example.test",
        phone: "999999999",
        reuseCodes: ["GUEST-CODE"],
        codeType: "courtesy",
        tableReservationId: "reservation-1",
      }),
    ).resolves.toEqual({ ticketId: "ticket-guest", code: "GUEST-CODE" });
    expect(
      calls.find((call) => call.table === "tickets" && call.op === "insert")
        ?.payload.person_id,
    ).toBe("person-guest");
    expect(
      calls
        .filter((call) => call.table === "persons" && call.op === "select")
        .some((call) =>
          call.filters?.some(
            (filter) =>
              filter.args[0] === "email" || filter.args[0] === "phone",
          ),
        ),
    ).toBe(false);
  });

  it("pide revisión si el documento pertenece a un tipo distinto sin reutilizar esa persona", async () => {
    const { supabase, calls } = createSupabaseMock({
      "persons.select": {
        data: {
          id: "person-passport",
          doc_type: "pasaporte",
          document: "33334444",
        },
        error: null,
      },
    });
    await expect(
      createTicketForReservation(supabase as any, {
        eventId: "event-1",
        tableName: "Entrada",
        fullName: "Persona Invitada",
        docType: "dni",
        document: "33334444",
      }),
    ).rejects.toThrow("tipo de documento");
    expect(calls.some((call) => call.op === "insert")).toBe(false);
  });

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

describe("createReservationCodes", () => {
  it("permite sembrar índices de unidad faltantes sin recrear toda la reserva", async () => {
    const { supabase, calls } = createSupabaseMock({
      "codes.insert": [
        {
          data: [
            { id: "code-2", code: "BC-BABY-7-002" },
            { id: "code-4", code: "BC-BABY-7-004" },
          ],
          error: null,
        },
      ],
    });

    const result = await (createReservationCodes as any)(supabase as any, {
      eventId: "event-1",
      eventPrefix: "BABY",
      tableName: "Mesa 7",
      reservationId: "res-1",
      quantity: 4,
      personIndexes: [2, 4],
    });

    expect(result).toEqual({
      codes: ["BC-BABY-7-002", "BC-BABY-7-004"],
      codeIds: ["code-2", "code-4"],
    });

    const insertCall = calls.find(
      (call) => call.table === "codes" && call.op === "insert",
    );
    expect(insertCall?.payload).toEqual([
      expect.objectContaining({
        code: "BC-BABY-7-002",
        table_reservation_id: "res-1",
        person_index: 2,
      }),
      expect.objectContaining({
        code: "BC-BABY-7-004",
        table_reservation_id: "res-1",
        person_index: 4,
      }),
    ]);
  });
});
