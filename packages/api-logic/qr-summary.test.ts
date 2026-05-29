import { describe, expect, it } from "vitest";
import { classifyQrBucket, normalizeByType } from "./qr-summary";

describe("qr-summary classification", () => {
  it("separa free, cortesías, vendidas y mesas", () => {
    expect(
      classifyQrBucket({
        codeType: "general",
        saleOrigin: null,
        ticketTableId: null,
        codeReservationId: null,
      }).bucket,
    ).toBe("free");

    expect(
      classifyQrBucket({
        codeType: "promoter_link",
        saleOrigin: null,
        ticketTableId: null,
        codeReservationId: null,
      }).bucket,
    ).toBe("free");

    expect(
      classifyQrBucket({
        codeType: "courtesy",
        saleOrigin: null,
        ticketTableId: null,
        codeReservationId: null,
      }).bucket,
    ).toBe("courtesy");

    expect(
      classifyQrBucket({
        codeType: "table",
        saleOrigin: null,
        ticketTableId: "table-1",
        codeReservationId: null,
      }).bucket,
    ).toBe("table");

    expect(
      classifyQrBucket({
        codeType: "ticket",
        saleOrigin: "ticket",
        ticketTableId: null,
        codeReservationId: null,
      }).bucket,
    ).toBe("sold");
  });

  it("normaliza claves legacy al resumen operativo", () => {
    expect(
      normalizeByType({
        general: 7,
        promoter_link: 2,
        courtesy: 3,
        promoter: 4,
        table: 5,
        sold: 6,
        desconocido: 8,
      }),
    ).toEqual({
      free: 9,
      courtesy: 7,
      sold: 14,
      table: 5,
    });
  });
});
