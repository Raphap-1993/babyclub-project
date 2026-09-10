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
    ]);
    const close = workbook.getWorksheet("Cierre")!;
    const amountRow = close
      .getRows(1, close.rowCount)!
      .find((row) => row.getCell(1).value === "Monto declarado en reservas")!;
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
    expect(value("Monto declarado en reservas")).toBe("No disponible");
    expect(value("Ganancia neta")).toBe("No disponible");
    expect(value("Pagos confirmados")).toBe(0);
  });
});
