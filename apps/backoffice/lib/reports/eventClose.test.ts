import { describe, expect, it } from "vitest";
import {
  buildEventClose,
  eventCloseCsv,
  type EventCloseInput,
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

  it("no inventa gratuidad ni pago en puerta para un QR general, y conserva códigos sin ticket", () => {
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
      report.attendance.categories.find((row) => row.key === "unclassified")
        ?.count,
    ).toBe(1);
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
