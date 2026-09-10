import { describe, expect, it } from "vitest";
import {
  buildEventClose,
  eventCloseCsv,
  visibleAccessCategories,
  type EventCloseInput,
  type SettlementRow,
} from "./eventClose";

const closedAt = "2026-09-01T18:03:36.648Z";
const input = (): EventCloseInput => ({
  event: {
    id: "event-1",
    name: "Evento de prueba",
    starts_at: "2026-08-30T03:00:00Z",
    closed_at: closedAt,
  },
  tickets: [],
  codes: [],
  reservations: [],
  payments: [],
  scans: [],
  promoters: [],
});

describe("emisión por promotor del mismo cierre", () => {
  it("incluye QR generales en free y conserva las compras por separado aun sin asistencia", () => {
    const data = input();
    data.event.closed_at = null;
    data.promoters = [{ id: "p1", name: "Ana" }];
    data.codes = ["courtesy", "free", "general"].map((type) => ({
      id: type,
      event_id: "event-1",
      type,
      promoter_id: "p1",
    }));
    data.reservations = [
      {
        id: "purchase",
        event_id: "event-1",
        status: "approved",
        sale_origin: "ticket",
      },
    ];
    data.tickets = [
      { id: "invited", event_id: "event-1", code_id: "courtesy" },
      { id: "free", event_id: "event-1", code_id: "free" },
      { id: "general", event_id: "event-1", code_id: "general" },
      {
        id: "purchase",
        event_id: "event-1",
        code_id: "courtesy",
        table_reservation_id: "purchase",
      },
    ];
    const report = buildEventClose(data);
    expect(report.promoters).toEqual([
      expect.objectContaining({
        id: "p1",
        name: "Ana",
        issued: 4,
        confirmed: 0,
        invited: 3,
        invitationAttended: 0,
        invitationWithoutAdmission: 3,
        invitationUsageWithoutScan: 0,
      }),
    ]);
    expect(report.invitations.issued).toBe(3);
    expect(eventCloseCsv(report)).toContain('"Evento abierto"');
    expect(eventCloseCsv(report)).not.toMatch(/no.?show|ausente/i);
  });

  it("preserva la emisión con ingreso confirmado tras anulación y excluye anulados sin ingreso", () => {
    const data = input();
    data.codes = [
      { id: "c", event_id: "event-1", type: "courtesy", promoter_id: "p-code" },
    ];
    data.tickets = [
      {
        id: "admitted",
        event_id: "event-1",
        code_id: "c",
        promoter_id: "p-ticket",
        is_active: false,
        deleted_at: "2026-08-30T05:00:00Z",
      },
      { id: "cancelled", event_id: "event-1", code_id: "c", is_active: false },
      {
        id: "removed",
        event_id: "event-1",
        code_id: "c",
        deleted_at: "2026-08-01T00:00:00Z",
      },
      { id: "used", event_id: "event-1", code_id: "c", used: true },
      { id: "used-at", event_id: "event-1", code_id: "c", used_at: closedAt },
    ];
    data.scans = [
      {
        id: "s",
        event_id: "event-1",
        ticket_id: "admitted",
        raw_value: "admitted",
        result: "valid",
      },
    ];
    const report = buildEventClose(data);
    expect(report.promoters.find((row) => row.id === "p-ticket")).toMatchObject(
      {
        issued: 1,
        confirmed: 1,
        invited: 1,
        invitationAttended: 1,
        invitationWithoutAdmission: 0,
      },
    );
    expect(report.promoters.find((row) => row.id === "p-code")).toMatchObject({
      issued: 2,
      confirmed: 0,
      invited: 2,
      invitationAttended: 0,
      invitationWithoutAdmission: 0,
      invitationUsageWithoutScan: 2,
    });
    expect(report.invitations).toMatchObject({
      issued: 3,
      attended: 1,
      withoutAdmission: 0,
      usageWithoutScan: 2,
    });
  });

  it("mantiene códigos admitidos sin ticket adicionales a las invitaciones emitidas", () => {
    const data = input();
    data.codes = [
      { id: "direct", event_id: "event-1", type: "free", promoter_id: "p1" },
    ];
    data.scans = [
      {
        id: "scan",
        event_id: "event-1",
        code_id: "direct",
        raw_value: "direct",
        result: "valid",
      },
    ];
    const report = buildEventClose(data);
    expect(report.promoters[0]).toMatchObject({
      issued: 0,
      invited: 0,
      confirmed: 1,
      free: 1,
      invitationAttended: 0,
    });
    expect(report.invitations).toMatchObject({
      issued: 0,
      attended: 0,
      codeOnlyAdmissions: 1,
    });
  });
});

describe("liquidaciones del evento", () => {
  const settlement = (
    id: string,
    overrides: Partial<SettlementRow> = {},
  ): SettlementRow => ({
    id,
    event_id: "event-1",
    promoter_id: "p1",
    promoter_name: "Nombre al liquidar",
    status: "pending",
    currency_code: "PEN",
    cash_total_cents: 1000,
    cash_units: 2,
    drink_units: 3,
    created_at: "2026-08-30T03:00:00Z",
    settled_at: null,
    ...overrides,
  });

  it("conserva tragos fraccionarios sin redondear en el modelo y CSV", () => {
    const data = input();
    data.settlements = [settlement("fractional", { drink_units: "1.5" })];
    const report = buildEventClose(data);
    expect(report.settlements.records[0].drinkUnits).toBe(1.5);
    expect(eventCloseCsv(report)).toContain('"1.5","Tragos"');
  });

  it("suma sólo PEN por estado, mantiene las otras monedas y filtra bajas y otros eventos", () => {
    const data = input();
    data.settlements = [
      ...[
        "draft",
        "pending",
        "paid",
        "delivered",
        "closed",
        "void",
        "review",
      ].map((status) => settlement(status, { status })),
      settlement("usd", { currency_code: "USD", cash_total_cents: 9000 }),
      settlement("missing-currency", { currency_code: null }),
      settlement("other-event", { event_id: "event-2" }),
      settlement("deleted", { deleted_at: closedAt }),
      settlement("inactive", { is_active: false }),
    ];
    data.settlements.push(data.settlements[0]);
    const report = buildEventClose(data);
    expect(report.settlements).toMatchObject({
      count: 9,
      pendingCents: 2000,
      settledCents: 3000,
      voidCents: 1000,
      otherCurrencyCount: 2,
    });
    expect(report.settlements.records).toHaveLength(9);
    expect(
      report.settlements.records.find((row) => row.id === "usd"),
    ).toMatchObject({ currencyCode: "USD", cashTotalCents: 9000 });
    expect(report.sales.profitCents).toBeNull();
  });

  it("usa el nombre guardado y sólo recurre al promotor actual cuando no hay nombre", () => {
    const data = input();
    data.promoters = [{ id: "p1", name: "Nombre actual" }];
    data.settlements = [
      settlement("snapshot"),
      settlement("current", {
        promoter_name: "  ",
        status: " PAID ",
        currency_code: " pen ",
        settled_at: closedAt,
      }),
    ];
    const report = buildEventClose(data);
    expect(
      report.settlements.records.find((row) => row.id === "snapshot")
        ?.promoterName,
    ).toBe("Nombre al liquidar");
    expect(
      report.settlements.records.find((row) => row.id === "current"),
    ).toMatchObject({
      promoterName: "Nombre actual",
      status: "paid",
      currencyCode: "PEN",
      settledAt: closedAt,
      cashUnits: 2,
      drinkUnits: 3,
    });
    expect(buildEventClose(input()).settlements).toMatchObject({
      records: [],
      count: 0,
      pendingCents: 0,
      settledCents: 0,
    });
  });

  it("exporta métricas de promotor y liquidaciones del mismo snapshot como texto seguro", () => {
    const data = input();
    data.promoters = [{ id: "p1", name: "=SUM(1)" }];
    data.tickets = [{ id: "ticket", event_id: "event-1", promoter_id: "p1" }];
    data.settlements = [
      settlement("s1", { promoter_name: "+CMD(1)", cash_total_cents: 12345 }),
    ];
    const csv = eventCloseCsv(buildEventClose(data));
    expect(csv).toContain(
      '"Promotores","\'=SUM(1)","1","Entradas personales emitidas"',
    );
    expect(csv).toContain('"Liquidaciones","Pendiente en soles","123.45"');
    expect(csv).toContain("'+CMD(1)");
    expect(csv).toContain('"Unidades en efectivo"');
    expect(csv).toContain('"Tragos"');
  });
});

describe("cierre por evidencia", () => {
  it("reconoce mesas históricas sin sale_origin y explica invitaciones sin ticket", () => {
    const data = input();
    data.reservations = [
      {
        id: "r-table",
        event_id: "event-1",
        status: "approved",
        table_id: "table-1",
        sale_origin: null,
      },
    ];
    data.codes = ["c-table", "c-direct"].map((id) => ({
      id,
      event_id: "event-1",
      type: "courtesy",
    }));
    data.tickets = [
      {
        id: "t-table",
        event_id: "event-1",
        code_id: "c-table",
        table_reservation_id: "r-table",
      },
    ];
    data.scans = [
      {
        id: "s-table",
        event_id: "event-1",
        ticket_id: "t-table",
        raw_value: "t-table",
        result: "valid",
      },
      {
        id: "s-direct",
        event_id: "event-1",
        code_id: "c-direct",
        raw_value: "c-direct",
        result: "valid",
      },
    ];
    const report = buildEventClose(data);
    expect(report.tables).toMatchObject({
      approvedReservations: 1,
      admittedGuests: 1,
    });
    expect(report.invitations.codeOnlyAdmissions).toBe(1);
    expect(
      report.invitations.attended + report.invitations.codeOnlyAdmissions,
    ).toBe(1);
  });
  it("no marca como ausente una invitación anulada antes del cierre", () => {
    const data = input();
    data.codes = [{ id: "c-1", event_id: "event-1", type: "courtesy" }];
    data.tickets = [
      { id: "t-1", event_id: "event-1", code_id: "c-1", is_active: false },
    ];
    expect(buildEventClose(data).invitations.withoutAdmission).toBe(0);
  });
  it("recupera compras archivadas al cierre y no cuenta una compra emitida como cortesía dos veces", () => {
    const data = input();
    data.reservations = [
      {
        id: "r-1",
        event_id: "event-1",
        status: "approved",
        sale_origin: "ticket",
        deleted_at: closedAt,
        ticket_total_amount: 50,
      },
      {
        id: "r-deleted",
        event_id: "event-1",
        status: "approved",
        sale_origin: "ticket",
        deleted_at: "2026-08-01T00:00:00Z",
        ticket_total_amount: 999,
      },
    ];
    data.codes = [{ id: "c-1", event_id: "event-1", type: "courtesy" }];
    data.tickets = ["t-1", "t-2"].map((id) => ({
      id,
      event_id: "event-1",
      code_id: "c-1",
      table_reservation_id: "r-1",
    }));
    data.scans = [
      {
        id: "s-0",
        event_id: "event-1",
        ticket_id: "t-1",
        raw_value: "precheck",
        result: "valid",
      },
      ...["t-1", "t-1", "t-2"].map((id, i) => ({
        id: `s-${i + 1}`,
        event_id: "event-1",
        ticket_id: id,
        raw_value: id,
        result: "valid",
        created_at: `2026-08-30T04:0${i}:00Z`,
      })),
    ];
    const report = buildEventClose(data);
    expect(report.attendance.confirmed).toBe(2);
    expect(
      report.attendance.categories.find((row) => row.key === "purchase")?.count,
    ).toBe(2);
    expect(
      report.attendance.categories.find((row) => row.key === "courtesy")?.count,
    ).toBe(0);
    expect(report.sales.approvedTicketReservations).toBe(1);
    expect(report.sales.declaredTicketAmountCents).toBe(5000);
    expect(report.quality.archivedReservationsIncluded).toBe(1);
    expect(report.attendance.firstAt).toBe("2026-08-30T04:00:00Z");
  });

  it("agrupa el QR general como tipo free sin inventar un cobro y conserva códigos sin ticket", () => {
    const data = input();
    data.codes = [{ id: "c-1", event_id: "event-1", type: "general" }];
    data.scans = [
      {
        id: "s-1",
        event_id: "event-1",
        code_id: "c-1",
        raw_value: "c-1",
        result: "valid",
      },
    ];
    const report = buildEventClose(data);
    expect(report.attendance.confirmed).toBe(1);
    expect(report.attendance.codeOnly).toBe(1);
    expect(
      report.attendance.categories.find((row) => row.key === "free")?.count,
    ).toBe(1);
    expect(report.quality.generalAdmissionsWithoutPayment).toBe(1);
    expect(report.invitations.codeOnlyAdmissions).toBe(1);
    expect(report.sales.doorAmountCents).toBeNull();
    expect(report.sales.profitCents).toBeNull();
  });

  it("mantiene importes desconocidos, monedas y reembolsos separados; pagos no se multiplican por entradas", () => {
    const data = input();
    data.reservations = [
      {
        id: "r-1",
        event_id: "event-1",
        status: "approved",
        sale_origin: "ticket",
        ticket_total_amount: 50,
      },
      {
        id: "r-2",
        event_id: "event-1",
        status: "approved",
        sale_origin: "ticket",
        ticket_total_amount: null,
      },
    ];
    data.payments = [
      {
        id: "p-1",
        event_id: "event-1",
        status: "paid",
        amount: 5000,
        currency_code: "PEN",
        reservation_id: "r-1",
      },
      {
        id: "p-2",
        event_id: "event-1",
        status: "pending",
        amount: 7000,
        currency_code: "PEN",
      },
      {
        id: "p-3",
        event_id: "event-1",
        status: "paid",
        amount: 1000,
        currency_code: "USD",
      },
      {
        id: "p-4",
        event_id: "event-1",
        status: "refunded",
        amount: 2500,
        currency_code: "PEN",
        refunded_at: closedAt,
      },
    ];
    const report = buildEventClose(data);
    expect(report.sales.confirmedPaymentAmountCents).toBe(5000);
    expect(report.sales.approvedWithoutAmount).toBe(1);
    expect(report.sales.otherCurrencyPayments).toBe(1);
    expect(report.sales.refundedPaymentAmountCents).toBe(2500);
    expect(report.sales.declaredTicketAmountCents).toBe(5000);
  });

  it("no marca como ausente al que asistió o tiene un uso sin escaneo conciliado", () => {
    const data = input();
    data.codes = [{ id: "c-1", event_id: "event-1", type: "courtesy" }];
    data.tickets = [
      { id: "t-1", event_id: "event-1", code_id: "c-1" },
      { id: "t-2", event_id: "event-1", code_id: "c-1", used: true },
      { id: "t-3", event_id: "event-1", code_id: "c-1" },
    ];
    data.scans = [
      {
        id: "s-1",
        event_id: "event-1",
        ticket_id: "t-1",
        raw_value: "t-1",
        result: "valid",
      },
    ];
    const report = buildEventClose(data);
    expect(report.invitations).toMatchObject({
      issued: 3,
      attended: 1,
      withoutAdmission: 1,
      usageWithoutScan: 1,
    });
  });

  it("excluye relaciones de otro evento y exporta el mismo resultado con protección de fórmulas", () => {
    const data = input();
    data.event.name = "=HYPERLINK(1)";
    data.scans = [
      {
        id: "other",
        event_id: "other",
        ticket_id: "t-1",
        raw_value: "t-1",
        result: "valid",
      },
    ];
    const report = buildEventClose(data);
    expect(report.attendance.confirmed).toBe(0);
    const csv = eventCloseCsv(report);
    expect(csv).toContain("' =HYPERLINK(1)".replace("' ", "'"));
    expect(csv).toContain("No disponible");
  });
});

describe("tipos de acceso consolidados", () => {
  it("une general y free con prioridad para compras y mesas, sin modificar fuentes ni importes", () => {
    const data = input();
    data.codes = ["general", "free", "courtesy", "promoter_link"].map(
      (type) => ({
        id: type,
        event_id: "event-1",
        type,
        promoter_id: "p1",
      }),
    );
    data.reservations = [
      {
        id: "purchase",
        event_id: "event-1",
        status: "approved",
        sale_origin: "ticket",
        ticket_total_amount: 125,
      },
      {
        id: "table",
        event_id: "event-1",
        status: "approved",
        sale_origin: "table",
        table_id: "table-1",
      },
    ];
    data.tickets = [
      { id: "general-1", event_id: "event-1", code_id: "general" },
      { id: "general-2", event_id: "event-1", code_id: "general" },
      { id: "explicit-free", event_id: "event-1", code_id: "free" },
      { id: "invitation", event_id: "event-1", code_id: "courtesy" },
      { id: "paid", event_id: "event-1", code_id: "general" },
      {
        id: "reserved",
        event_id: "event-1",
        code_id: "general",
        table_reservation_id: "purchase",
      },
      {
        id: "table",
        event_id: "event-1",
        code_id: "general",
        table_reservation_id: "table",
      },
      {
        id: "missing-relation",
        event_id: "event-1",
        code_id: "general",
        table_reservation_id: "missing",
      },
      { id: "purchase-link", event_id: "event-1", code_id: "promoter_link" },
    ];
    data.payments = [
      {
        id: "payment",
        event_id: "event-1",
        ticket_id: "paid",
        status: "paid",
        currency_code: "PEN",
        amount: 2500,
      },
    ];
    data.scans = data.tickets.map((ticket) => ({
      id: ticket.id,
      event_id: "event-1",
      ticket_id: ticket.id,
      raw_value: ticket.id,
      result: "valid",
    }));
    data.scans.push({ ...data.scans[0], id: "repeat" });
    const original = JSON.stringify(data);
    const report = buildEventClose(data);
    expect(report.attendance.confirmed).toBe(9);
    expect(
      Object.fromEntries(
        report.attendance.categories.map((row) => [row.key, row.count]),
      ),
    ).toEqual({
      purchase: 2,
      table: 1,
      courtesy: 1,
      free: 3,
      unknown: 2,
    });
    expect(report.promoters[0]).toMatchObject({
      confirmed: 9,
      purchase: 2,
      table: 1,
      courtesy: 1,
      free: 3,
      unknown: 2,
      invited: 4,
      invitationAttended: 4,
    });
    expect(report.invitations).toMatchObject({
      issued: 4,
      attended: 4,
      withoutAdmission: 0,
    });
    expect(report.sales).toMatchObject({
      declaredTicketAmountCents: 12500,
      confirmedPaymentAmountCents: 2500,
      doorAmountCents: null,
      profitCents: null,
    });
    expect(report.quality).toMatchObject({
      unclassifiedAdmissions: 2,
      generalAdmissionsWithoutPayment: 2,
      repeatedConfirmations: 1,
    });
    expect(JSON.stringify(data)).toBe(original);
    expect(
      visibleAccessCategories(report).reduce((sum, row) => sum + row.count, 0),
    ).toBe(9);
    expect(eventCloseCsv(report)).toContain('"Asistencia","Entrada free","3"');
    expect(eventCloseCsv(report)).not.toContain('"QR general"');
  });

  it("omite categorías vacías en la vista y el CSV, conservando los accesos sin tipo cuando existen", () => {
    const data = input();
    data.codes = [{ id: "g", event_id: "event-1", type: "general" }];
    data.tickets = [{ id: "t", event_id: "event-1", code_id: "g" }];
    data.scans = [
      {
        id: "s",
        event_id: "event-1",
        ticket_id: "t",
        raw_value: "t",
        result: "valid",
      },
    ];
    const report = buildEventClose(data);
    expect(
      visibleAccessCategories(report).map((row) => [row.label, row.count]),
    ).toEqual([["Entrada free", 1]]);
    const csv = eventCloseCsv(report);
    expect(csv).not.toMatch(
      /"Otros accesos"|"Sin tipo de entrada"|"QR general"/,
    );
    expect(visibleAccessCategories(buildEventClose(input()))).toEqual([]);
    data.scans.push({
      id: "missing",
      event_id: "event-1",
      ticket_id: "missing",
      raw_value: "missing",
      result: "valid",
    });
    const withUnknown = buildEventClose(data);
    expect(
      visibleAccessCategories(withUnknown).map((row) => row.count),
    ).toEqual([1, 1]);
    expect(eventCloseCsv(withUnknown)).toContain('"Sin tipo de entrada","1"');
  });
});
