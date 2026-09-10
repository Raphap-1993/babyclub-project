import { describe, expect, it, vi } from "vitest";
import { saveEntry, sendEntryEmail } from "./nominationActions";
import { extractUnits } from "./nominationModel";
const unit = extractUnits({
  units: [
    {
      id: "u2",
      unit_index: 2,
      status: "nominated",
      full_name: "Persona Ejemplo",
      doc_type: "dni",
      document: "00000002",
      email: "guest@example.com",
      updated_at: "v1",
    },
  ],
})[0];
const response = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

describe("guardar, obtener QR y correo independientes", () => {
  it("conserva el éxito del QR aunque el correo falle después de emitir", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true, units: [] }))
      .mockResolvedValueOnce(
        response({
          success: true,
          issuedCount: 1,
          mailDelivery: [{ unitId: "u2", ticketId: "t2", status: "failed" }],
        }),
      );
    const result = await saveEntry({
      reservationId: "r1",
      original: unit,
      unit,
      reservationStatus: "approved",
      fetchImpl: fetchMock as any,
    });
    expect(result.saved).toBe(true);
    expect(result.issueSucceeded).toBe(true);
    expect(result.mailDelivery?.status).toBe("failed");
    expect(result.error).toBeNull();
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).units[0].expected_updated_at,
    ).toBe("v1");
  });
  it("reintenta sólo correo sin PUT ni rotar el QR", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        success: true,
        issuedCount: 0,
        mailDelivery: [{ unitId: "u2", ticketId: "t2", status: "sent" }],
      }),
    );
    const issued = { ...unit, status: "issued" as const, ticket_id: "t2" };
    const result = await sendEntryEmail({
      reservationId: "r1",
      unit: issued,
      reservationStatus: "approved",
      fetchImpl: fetchMock as any,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/ticket-reservations/r1/units/u2/issue",
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(result.mailDelivery).toMatchObject({
      status: "sent",
      ticketId: "t2",
    });
  });
  it("guardar contacto de una emitida no intenta emitir ni enviar", async () => {
    const original = { ...unit, status: "issued" as const, ticket_id: "t2" };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ success: true, units: [] }));
    const result = await saveEntry({
      reservationId: "r1",
      original,
      unit: { ...original, email: "new@example.com" },
      reservationStatus: "approved",
      fetchImpl: fetchMock as any,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.saved).toBe(true);
    expect(result.issueSucceeded).toBe(false);
    expect(result.mailDelivery).toBeNull();
  });
  it("en revisión, rechazadas y usadas no envían solicitudes que la API rechazará", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("No debe llamar la API"));
    const pending = await saveEntry({
      reservationId: "r1",
      original: unit,
      unit,
      reservationStatus: "pending",
      fetchImpl: fetchMock as any,
    });
    expect(pending.saved).toBe(false);
    expect(pending.error).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await saveEntry({
      reservationId: "r1",
      original: unit,
      unit,
      reservationStatus: "rejected",
      fetchImpl: fetchMock as any,
    });
    await saveEntry({
      reservationId: "r1",
      original: { ...unit, status: "used" },
      unit,
      reservationStatus: "approved",
      fetchImpl: fetchMock as any,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("un fallo de emisión conserva el guardado para reintentar sin perder datos", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true }))
      .mockResolvedValueOnce(
        response({ success: false, error: "No disponible" }, false),
      );
    expect(
      await saveEntry({
        reservationId: "r1",
        original: unit,
        unit,
        reservationStatus: "approved",
        fetchImpl: fetchMock as any,
      }),
    ).toMatchObject({
      saved: true,
      issueSucceeded: false,
      error: "No disponible",
    });
  });
  it("HTTP200 sin resultado de correo nunca confirma envío", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ success: true, issuedCount: 0 }));
    expect(
      (
        await sendEntryEmail({
          reservationId: "r1",
          unit: { ...unit, status: "issued", ticket_id: "t2" },
          reservationStatus: "approved",
          fetchImpl: fetchMock as any,
        })
      ).mailDelivery,
    ).toBeNull();
  });
});
