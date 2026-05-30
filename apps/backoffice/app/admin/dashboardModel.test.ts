import { describe, expect, it } from "vitest";
import type { QRSummary } from "@repo/api-logic/qr-summary";
import { buildAdminDashboardModel } from "./dashboardModel";

const qrEvents: QRSummary[] = [
  {
    event_id: "evt-1",
    name: "Babyrave Enero",
    date: "2026-01-15T22:00:00.000Z",
    total_qr: 120,
    by_type: { entrada: 100, mesa: 15, cortesia: 5 },
  },
  {
    event_id: "evt-2",
    name: "Babyrave Febrero",
    date: "2026-02-10T22:00:00.000Z",
    total_qr: 80,
    by_type: { sold: 57, table: 18, promoter_link: 2, general: 3 },
  },
];

const promoterEvents = [
  {
    event_id: "evt-1",
    name: "Babyrave Enero",
    date: "2026-01-15T22:00:00.000Z",
    total_tickets: 150,
    promoters: [
      { promoter_id: "p-1", name: "Ana", tickets: 90 },
      { promoter_id: "direct", name: "Invitacion directa", tickets: 60 },
    ],
  },
  {
    event_id: "evt-2",
    name: "Babyrave Febrero",
    date: "2026-02-10T22:00:00.000Z",
    total_tickets: 80,
    promoters: [{ promoter_id: "p-2", name: "Luis", tickets: 80 }],
  },
];

describe("buildAdminDashboardModel", () => {
  it("normaliza tipos y arma un resumen mixto por evento", () => {
    const model = buildAdminDashboardModel({ qrEvents, promoterEvents });

    expect(model.globalTotals.totalQr).toBe(200);
    expect(model.globalTotals.totalTickets).toBe(230);
    expect(model.globalTotals.byType.general).toBe(157);
    expect(model.globalTotals.byType.table).toBe(33);
    expect(model.globalTotals.byType.courtesy).toBe(7);
    expect(model.globalTotals.byType.free).toBe(3);

    expect(model.events).toHaveLength(2);
    expect(model.events[0].name).toBe("Babyrave Enero");
    expect(model.events[0].qrBreakdown).toEqual([
      { key: "general", label: "Entradas", value: 100 },
      { key: "table", label: "Mesas", value: 15 },
      { key: "courtesy", label: "Cortesías", value: 5 },
      { key: "free", label: "Free", value: 0 },
    ]);
    expect(model.events[0].promoters[0]).toEqual({ promoterId: "p-1", name: "Ana", tickets: 90 });
    expect(model.events[0].promoters[1]).toEqual({ promoterId: "direct", name: "Invitacion directa", tickets: 60 });
  });
});
