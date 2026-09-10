import { describe, expect, it } from "vitest";
import {
  extractUnits,
  nominationReducer,
  entryPresentation,
  countReadyEntries,
  normalizeReservationSummary,
  formatEventDate,
} from "./nominationModel";

const payload = {
  reservation: {
    id: "r1",
    status: "approved",
    email: "buyer@example.com",
    event: { name: "Evento ejemplo", starts_at: "2026-09-19T03:00:00Z" },
  },
  units: [
    {
      id: "u1",
      unit_index: 1,
      status: "issued",
      full_name: "Alex Ejemplo",
      document: "00000001",
      ticket_id: "t1",
    },
    { id: "u2", unit_index: 2, status: "pending_nomination" },
    { id: "u3", unit_index: 3, status: "pending_nomination" },
  ],
};

describe("Mis entradas: borradores independientes", () => {
  it("guardar A y refrescar del servidor conserva lo escrito en B", () => {
    let state = { units: extractUnits(payload), drafts: {} };
    state = nominationReducer(state, {
      type: "edit",
      id: "u3",
      patch: { full_name: "Borrador B", document: "00000003" },
    });
    state = nominationReducer(state, {
      type: "edit",
      id: "u2",
      patch: { full_name: "Persona A", document: "00000002" },
    });
    state = nominationReducer(state, {
      type: "saved",
      id: "u2",
      submitted: { full_name: "Persona A", document: "00000002" },
    });
    state = nominationReducer(state, {
      type: "loaded",
      units: extractUnits({
        units: payload.units.map((u) =>
          u.id === "u2"
            ? {
                ...u,
                status: "issued",
                full_name: "Persona A",
                ticket_id: "t2",
              }
            : u,
        ),
      }),
    });
    expect(state.drafts).toEqual({
      u3: { full_name: "Borrador B", document: "00000003" },
    });
    expect(state.units.find((u) => u.id === "u2")?.ticket_id).toBe("t2");
  });
  it("conserva la versión desde la que se comenzó a editar frente a recargas", () => {
    let state = {
      units: extractUnits({
        units: [{ ...payload.units[0], updated_at: "v1" }],
      }),
      drafts: {},
    };
    state = nominationReducer(state, {
      type: "edit",
      id: "u1",
      patch: { full_name: "Nuevo titular" },
    });
    state = nominationReducer(state, {
      type: "loaded",
      units: extractUnits({
        units: [{ ...payload.units[0], updated_at: "v2" }],
      }),
    });
    expect(state.drafts).toMatchObject({
      u1: { full_name: "Nuevo titular", updated_at: "v1" },
    });
  });
  it("descartar una edición recupera el servidor sin borrar el borrador de otra entrada", () => {
    const state = {
      units: extractUnits(payload),
      drafts: { u2: { full_name: "Cambio A" }, u3: { full_name: "Cambio B" } },
    };
    expect(
      nominationReducer(state, { type: "discard", id: "u2" }).drafts,
    ).toEqual({ u3: { full_name: "Cambio B" } });
  });
  it("una respuesta anterior no borra cambios más nuevos de la misma persona", () => {
    const state = {
      units: extractUnits(payload),
      drafts: { u2: { full_name: "Nombre nuevo" } },
    };
    expect(
      nominationReducer(state, {
        type: "saved",
        id: "u2",
        submitted: { full_name: "Nombre enviado" },
      }).drafts.u2.full_name,
    ).toBe("Nombre nuevo");
  });
});

describe("Mis entradas: estados reales", () => {
  it.each([
    ["used", "Entrada utilizada"],
    ["expired", "Entrada vencida"],
    ["inactive", "Entrada no disponible"],
  ])(
    "el estado efectivo %s prevalece sobre una unidad emitida",
    (status, label) => {
      const units = extractUnits({
        units: [
          {
            ...payload.units[0],
            access_status: status,
            access_reason: "test",
            expired_at: "2026-09-19T03:00:00Z",
          },
        ],
      });
      expect(entryPresentation(units[0], "approved")).toMatchObject({
        label,
        ready: false,
        canEdit: false,
        canIssue: false,
        terminal: true,
      });
      expect(units[0].expired_at).toBe("2026-09-19T03:00:00Z");
      expect(countReadyEntries(units, "approved")).toBe(0);
    },
  );
  it("una entrada con estado efectivo pendiente no promete QR ni emisión", () => {
    const unit = extractUnits({
      units: [{ ...payload.units[0], access_status: "pending" }],
    })[0];
    expect(entryPresentation(unit, "approved")).toMatchObject({
      label: "QR pendiente de confirmación",
      ready: false,
      canEdit: false,
      canIssue: false,
    });
  });
  it("una unidad sin ticket permite nominar y emitir aunque su acceso siga pendiente", () => {
    const unit = extractUnits({
      units: [
        {
          ...payload.units[1],
          access_status: "pending",
          access_reason: "nomination_required",
        },
      ],
    })[0];
    expect(entryPresentation(unit, "approved")).toMatchObject({
      canEdit: true,
      canIssue: true,
      ready: false,
    });
  });
  it("mantiene usadas y anuladas en la lista y fuera del total disponible", () => {
    const units = extractUnits({
      units: [
        payload.units[0],
        { id: "used", status: "used", ticket_id: "t2" },
        { id: "cancel", status: "cancelled", ticket_id: "t3" },
      ],
    });
    expect(units).toHaveLength(3);
    expect(countReadyEntries(units, "approved")).toBe(1);
    expect(entryPresentation(units[1], "approved")).toMatchObject({
      label: "Entrada utilizada",
      canEdit: false,
      canIssue: false,
      ready: false,
    });
    expect(entryPresentation(units[2], "approved")).toMatchObject({
      label: "Entrada anulada",
      canEdit: false,
      canIssue: false,
      ready: false,
    });
  });
  it.each(["rejected", "cancelled", "unknown"])(
    "no promete emisión para compra %s",
    (status) => {
      expect(entryPresentation(extractUnits(payload)[0], status)).toMatchObject(
        { ready: false, canEdit: false, canIssue: false },
      );
      expect(countReadyEntries(extractUnits(payload), status)).toBe(0);
    },
  );
  it("espera la aprobación del pago antes de permitir guardar o emitir", () => {
    expect(
      entryPresentation(extractUnits(payload)[1], "pending"),
    ).toMatchObject({
      label: "Pago en revisión",
      canEdit: false,
      canIssue: false,
      ready: false,
    });
  });
  it("una unidad sin estado no se presenta como nominación pendiente", () => {
    expect(
      entryPresentation(
        extractUnits({ units: [{ id: "unknown" }] })[0],
        "approved",
      ),
    ).toMatchObject({
      canEdit: false,
      canIssue: false,
      label: "Estado por confirmar",
    });
  });
  it("fecha Lima y campos ausentes no se convierten en cantidad cero", () => {
    expect(formatEventDate("2026-09-19T03:00:00Z")).toContain("18");
    expect(
      normalizeReservationSummary(payload, "r1").total_ticket_units,
    ).toBeNull();
  });
});
