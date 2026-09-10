import ExcelJS from "exceljs";
import type { EventCloseReport } from "./eventClose";

const moneyFormat = '"S/" #,##0.00';
const dateFormat = "yyyy-mm-dd hh:mm";
const accent = "FFA60C2F";
const white = "FFFFFFFF";

/** Browser-only export of the already displayed report; never refetches or recomputes the close. */
export async function eventCloseExcel(
  report: EventCloseReport,
): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BabyClub Access";
  workbook.created = new Date(report.generatedAt);
  workbook.modified = new Date(report.generatedAt);
  workbook.title = `Cierre de evento — ${report.event.name}`;

  function sheet(name: string, widths: number[]) {
    const value = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    value.columns = widths.map((width) => ({ width }));
    const last = widths.length;
    value.mergeCells(1, 1, 1, last);
    value.getCell("A1").value = "BABYCLUB · CIERRE DE EVENTO";
    value.getCell("A1").font = {
      name: "Calibri",
      size: 16,
      bold: true,
      color: { argb: white },
    };
    value.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: accent },
    };
    value.getRow(1).height = 32;
    value.mergeCells(2, 1, 2, last);
    value.getCell("A2").value = report.event.name;
    value.getCell("A2").font = { name: "Calibri", size: 14, bold: true };
    value.getCell("A2").alignment = { wrapText: true, vertical: "middle" };
    value.getRow(2).height = 36;
    value.mergeCells(3, 1, 3, last);
    value.getCell("A3").value =
      "Fuente: BabyClub · mismo corte del reporte visible. Reservas y pagos no se suman.";
    value.getCell("A3").font = {
      name: "Calibri",
      size: 10,
      color: { argb: "FF525252" },
    };
    value.getRow(3).height = 24;
    value.pageSetup.printTitlesRow = "1:5";
    return value;
  }

  function header(value: ExcelJS.Worksheet, labels: string[]) {
    value.getRow(5).values = labels;
    value.getRow(5).height = 30;
    value.getRow(5).eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF262626" },
      };
      cell.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: white },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  }

  const close = sheet("Cierre", [43, 24, 80]);
  header(close, ["Indicador", "Valor", "Alcance / pendiente"]);
  const add = (
    label: string,
    value: string | number | Date,
    note: string,
    format = "#,##0",
  ) => {
    const row = close.addRow([label, value, note]);
    row.height = 34;
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF262626" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (row.number % 2 === 0)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F5" },
        };
    });
    row.getCell(2).numFmt = format;
    row.getCell(2).font = { name: "Calibri", size: 11, bold: true };
  };
  const { sales, attendance, invitations, tables, quality } = report;
  add(
    "Ingresos confirmados",
    attendance.confirmed,
    "QR únicos admitidos. No equivale a personas físicas únicas.",
  );
  for (const category of attendance.categories)
    add(category.label, category.count, category.description);
  add(
    "Invitaciones con ticket emitidas",
    invitations.issued,
    "Excluye compras y tickets anulados sin ingreso.",
  );
  add(
    "Invitaciones con ticket ingresadas",
    invitations.attended,
    "Confirmación de ingreso.",
  );
  add(
    "Invitaciones sin ingreso registrado",
    invitations.withoutAdmission,
    report.event.closed_at
      ? "Evento cerrado."
      : "Evento sin cierre: no son ausencias definitivas.",
  );
  add(
    "Uso pendiente de conciliar",
    invitations.usageWithoutScan,
    "No se interpreta como ausencia.",
  );
  add(
    "Invitados con código sin ticket",
    invitations.codeOnlyAdmissions,
    "Adicionales al detalle de tickets; incluidos en asistencia.",
  );
  add(
    "Reservas de entradas aprobadas",
    sales.approvedTicketReservations,
    "Pedidos aprobados, no personas ni pagos.",
  );
  add(
    "Monto declarado en reservas",
    sales.approvedWithoutAmount > 0 &&
      sales.approvedWithoutAmount === sales.approvedTicketReservations
      ? "No disponible"
      : sales.declaredTicketAmountCents / 100,
    "Importes declarados en soles, pendientes de conciliar con caja. No sumar a pagos.",
    moneyFormat,
  );
  add(
    "Reservas sin importe",
    sales.approvedWithoutAmount,
    "Excluidas de la suma de importes.",
  );
  add(
    "Pagos confirmados",
    sales.confirmedPaymentAmountCents / 100,
    "Registrados como pagados en soles, sin reembolso. Cero aquí no demuestra recaudación cero.",
    moneyFormat,
  );
  add(
    "Cantidad de pagos confirmados",
    sales.confirmedPaymentCount,
    "Registros en soles, sin reembolso.",
  );
  add(
    "Pagos sin importe",
    sales.paymentsWithoutAmount,
    "Pendientes de conciliar.",
  );
  add(
    "Pagos con otra moneda o sin moneda",
    sales.otherCurrencyPayments,
    "Excluidos del total en soles.",
  );
  add(
    "Pagos con devolución",
    sales.refundedPaymentCount,
    "Cantidad de registros con devolución.",
  );
  add(
    "Importe original de pagos reembolsados",
    sales.refundedPaymentAmountCents / 100,
    "No acredita el importe exacto de devoluciones parciales.",
    moneyFormat,
  );
  add(
    "Reservas de mesa aprobadas",
    tables.approvedReservations,
    "Reservas, no invitados.",
  );
  add(
    "Mesas distintas reservadas",
    tables.distinctTables,
    "Mesas vinculadas a reservas aprobadas.",
  );
  add(
    "Invitados de mesa ingresados",
    tables.admittedGuests,
    "Accesos confirmados.",
  );
  for (const label of ["Cobros en puerta", "Consumo de mesas", "Ganancia neta"])
    add(
      label,
      "No disponible",
      "Falta registro conciliable; no se calcula como cero.",
    );
  add(
    "Ingresos por clasificar",
    quality.unclassifiedAdmissions,
    "No se puede distinguir gratuidad o cobro en puerta.",
  );
  add(
    "Reservas recuperadas del cierre",
    quality.archivedReservationsIncluded,
    "Todos los estados. Incluidas solo para lectura histórica.",
  );
  add(
    "Reservas eliminadas fuera del cierre",
    quality.excludedDeletedReservations,
    "Excluidas del registro de reservas del cierre.",
  );
  add(
    "Confirmaciones repetidas excluidas",
    quality.repeatedConfirmations,
    "No incrementan la asistencia.",
  );
  add(
    "Fecha del evento (UTC)",
    report.event.starts_at ? new Date(report.event.starts_at) : "Sin fecha",
    "La pantalla muestra horario de Lima (UTC−5).",
    dateFormat,
  );
  add(
    "Lectura del reporte (UTC)",
    new Date(report.generatedAt),
    "Fecha del corte exportado; no se vuelve a consultar al descargar.",
    dateFormat,
  );

  const promoters = sheet("Promotores", [38, 15, 18, 16, 23, 20]);
  header(promoters, [
    "Promotor",
    "Total ingresados",
    "Con compra",
    "Mesa",
    "Invitación / free",
    "Por revisar",
  ]);
  for (const promoter of report.promoters) {
    const row = promoters.addRow([
      promoter.name,
      promoter.confirmed,
      promoter.purchase,
      promoter.table,
      promoter.courtesy + promoter.free,
      promoter.unclassified + promoter.unknown,
    ]);
    row.height = 32;
    row.eachCell((cell, column) => {
      cell.font = { name: "Calibri", size: 11 };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: column === 1 ? "left" : "right",
      };
      if (column > 1) cell.numFmt = "#,##0";
      if (row.number % 2 === 0)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F5" },
        };
    });
  }
  if (report.promoters.length)
    promoters.autoFilter = { from: "A5", to: `F${promoters.rowCount}` };
  else
    promoters.getCell("A6").value = "Sin ingresos para atribuir a promotores.";

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
