import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildEventClose, type EventCloseReport } from "./eventClose";
import { eventCloseExcel } from "./eventCloseExcel";

function report(): EventCloseReport {
  const value = buildEventClose(
    {
      event: {
        id: "event",
        name: "Fiesta de prueba",
        starts_at: "2026-08-30T03:00:00Z",
        closed_at: "2026-09-01T18:00:00Z",
      },
      tickets: [],
      codes: [],
      scans: [],
      payments: [],
      promoters: [],
      settlements: [
        {
          id: "s1",
          event_id: "event",
          promoter_name: "+SUM(1)",
          status: "pending",
          currency_code: "PEN",
          cash_total_cents: 12345,
          cash_units: 4,
          drink_units: 2,
        },
        {
          id: "s2",
          event_id: "event",
          promoter_name: "Otro promotor",
          status: "paid",
          currency_code: "USD",
          cash_total_cents: 99900,
          cash_units: 1,
          drink_units: 0,
        },
      ],
      reservations: [
        {
          id: "r1",
          event_id: "event",
          status: "approved",
          sale_origin: "ticket",
          ticket_total_amount: 755,
        },
      ],
    },
    "2026-09-10T15:00:00Z",
  );
  value.promoters = [
    {
      id: "p1",
      name: '=HYPERLINK("https://example.com")',
      confirmed: 25,
      purchase: 10,
      table: 2,
      courtesy: 3,
      free: 4,
      unclassified: 5,
      unknown: 1,
      issued: 45,
      invited: 17,
      invitationAttended: 7,
      invitationWithoutAdmission: 8,
      invitationUsageWithoutScan: 2,
    },
  ];
  return value;
}

async function read(value: EventCloseReport) {
  const bytes = await eventCloseExcel(value);
  expect(Array.from(bytes.slice(0, 2))).toEqual([80, 75]); // A real OOXML ZIP, not renamed CSV.
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer);
  return workbook;
}

describe("descarga Excel del cierre visible", () => {
  it("produce hojas de cierre y promotores con importes numéricos y formatos de Excel", async () => {
    const source = report();
    const workbook = await read(source);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Cierre",
      "Promotores",
      "Liquidaciones",
    ]);
    const close = workbook.getWorksheet("Cierre")!;
    const amountRow = close
      .getRows(1, close.rowCount)!
      .find((row) => row.getCell(1).value === "Valor de reservas aprobadas")!;
    expect(amountRow.getCell(2).value).toBe(755);
    expect(amountRow.getCell(2).numFmt).toContain('"S/"');
    expect(close.getCell("A2").value).toBe(source.event.name);
    const dates = close
      .getRows(1, close.rowCount)!
      .filter((row) => row.getCell(2).value instanceof Date);
    expect(
      dates.map((row) => (row.getCell(2).value as Date).toISOString()),
    ).toContain(new Date(source.generatedAt).toISOString());
    expect(workbook.getWorksheet("Promotores")!.autoFilter).toBeTruthy();
  });
  it("conserva nombres como texto, sin convertirlos en fórmulas ni enlaces", async () => {
    const workbook = await read(report());
    const sheet = workbook.getWorksheet("Promotores")!;
    const cell = sheet.getCell("A6");
    expect(cell.value).toBe('=HYPERLINK("https://example.com")');
    expect(cell.type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("B6").value).toBe(25);
    expect(sheet.getCell("E6").value).toBe(7);
    expect(sheet.getCell("F6").value).toBe(6);
    expect(sheet.getCell("G6").value).toBe(45);
    expect(sheet.getCell("H6").value).toBe(17);
    expect(sheet.getCell("I6").value).toBe(7);
    expect(sheet.getCell("J6").value).toBe(8);
    expect(sheet.getCell("K6").value).toBe(2);
  });
  it("exporta liquidaciones, unidades y total PEN sin convertir nombres en fórmulas o dólares en soles", async () => {
    const workbook = await read(report());
    const sheet = workbook.getWorksheet("Liquidaciones")!;
    expect(sheet).toBeDefined();
    expect(sheet.getCell("A6").value).toBe("+SUM(1)");
    expect(sheet.getCell("A6").type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("C6").value).toBe("PEN");
    expect(sheet.getCell("D6").value).toBe(123.45);
    expect(sheet.getCell("D6").numFmt).toContain('"S/"');
    expect(sheet.getCell("E6").value).toBe(4);
    expect(sheet.getCell("F6").value).toBe(2);
    expect(sheet.getCell("C7").value).toBe("USD");
    expect(sheet.getCell("D7").value).toBe(999);
    expect(sheet.getCell("D7").numFmt).not.toContain("S/");
    const close = workbook.getWorksheet("Cierre")!;
    const value = (label: string) =>
      close
        .getRows(1, close.rowCount)!
        .find((row) => row.getCell(1).value === label)!
        .getCell(2).value;
    expect(value("Liquidaciones pendientes en soles")).toBe(123.45);
    expect(value("Liquidaciones pagadas en soles")).toBe(0);
    expect(value("Liquidaciones en otra moneda o sin moneda")).toBe(1);
  });
  it("no convierte la falta de importes o de utilidad en un cero", async () => {
    const source = report();
    source.sales.approvedWithoutAmount = 1;
    source.sales.declaredTicketAmountCents = 0;
    const sheet = (await read(source)).getWorksheet("Cierre")!;
    const value = (label: string) =>
      sheet
        .getRows(1, sheet.rowCount)!
        .find((row) => row.getCell(1).value === label)!
        .getCell(2).value;
    expect(value("Valor de reservas aprobadas")).toBe("No disponible");
    expect(value("Ganancia neta")).toBe("No disponible");
    expect(value("Pagos registrados en soles")).toBe(0);
  });

  it("muestra la cantidad fraccionaria de tragos en Excel", async () => {
    const source = report();
    source.settlements.records[0].drinkUnits = 1.5;
    const sheet = (await read(source)).getWorksheet("Liquidaciones")!;
    expect(sheet.getCell("F6").value).toBe(1.5);
    expect(sheet.getCell("F6").numFmt).toBe("#,##0.##");
  });
});
