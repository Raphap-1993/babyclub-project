import ExcelJS from "exceljs";
import { settlementStatusLabel, type EventCloseReport } from "./eventClose";

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
      "BabyClub · Reservas y pagos presentados por separado. Importes en soles.";
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
  header(close, ["Indicador", "Valor", "Detalle"]);
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
  const { sales, attendance, invitations, tables, quality, settlements } =
    report;
  add(
    "Accesos confirmados",
    attendance.confirmed,
    "Entradas validadas en puerta; cada entrada cuenta una vez.",
  );
  for (const category of attendance.categories)
    add(category.label, category.count, category.description);
  add(
    "Invitaciones con ticket emitidas",
    invitations.issued,
    "Entradas de cortesía y free vigentes o con asistencia registrada.",
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
      : "Evento abierto; asistencia en curso.",
  );
  add(
    "Usadas sin confirmación de ingreso",
    invitations.usageWithoutScan,
    "Uso registrado; ingreso sin confirmar.",
  );
  add(
    "Invitados con código sin ticket",
    invitations.codeOnlyAdmissions,
    "Incluidos en la asistencia total.",
  );
  add(
    "Reservas de entradas aprobadas",
    sales.approvedTicketReservations,
    "Cantidad de reservas de entradas aprobadas.",
  );
  add(
    "Valor de reservas aprobadas",
    sales.approvedWithoutAmount > 0 &&
      sales.approvedWithoutAmount === sales.approvedTicketReservations
      ? "No disponible"
      : sales.declaredTicketAmountCents / 100,
    "Valor de las entradas aprobadas, separado de los pagos registrados.",
    moneyFormat,
  );
  add(
    "Reservas sin importe",
    sales.approvedWithoutAmount,
    "Importe pendiente de registrar.",
  );
  add(
    "Pagos registrados en soles",
    sales.confirmedPaymentAmountCents / 100,
    "Pagos confirmados sin devoluciones.",
    moneyFormat,
  );
  add(
    "Cantidad de pagos registrados",
    sales.confirmedPaymentCount,
    "Registros en soles, sin reembolso.",
  );
  add(
    "Pagos sin importe",
    sales.paymentsWithoutAmount,
    "Importe pendiente de registrar.",
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
    "Importe original de los pagos con devolución",
    sales.refundedPaymentAmountCents / 100,
    "Importe original de los pagos con devolución; devoluciones parciales no desglosadas.",
    moneyFormat,
  );
  add(
    "Reservas de mesa aprobadas",
    tables.approvedReservations,
    "Cantidad de reservas aprobadas.",
  );
  add(
    "Mesas reservadas",
    tables.distinctTables,
    "Mesas vinculadas a reservas aprobadas.",
  );
  add(
    "Invitados de mesa ingresados",
    tables.admittedGuests,
    "Accesos confirmados.",
  );
  for (const label of ["Cobros en puerta", "Consumo de mesas", "Ganancia neta"])
    add(label, "No disponible", "Sin registro en este reporte.");
  add(
    "Accesos sin modalidad indicada",
    quality.unclassifiedAdmissions,
    "Incluye QR generales y otros accesos sin indicación de pago o gratuidad.",
  );
  add(
    "Reservas del historial de cierre",
    quality.archivedReservationsIncluded,
    "Historial del evento; todos los estados.",
  );
  add(
    "Reservas retiradas del historial",
    quality.excludedDeletedReservations,
    "Excluidas del registro de reservas del cierre.",
  );
  add(
    "Validaciones repetidas",
    quality.repeatedConfirmations,
    "Cada entrada cuenta una vez en la asistencia.",
  );
  add("Cantidad de liquidaciones", settlements.count, "Registros del evento.");
  add(
    "Liquidaciones pendientes en soles",
    settlements.pendingCents / 100,
    "Borradores y pendientes.",
    moneyFormat,
  );
  add(
    "Liquidaciones pagadas en soles",
    settlements.settledCents / 100,
    "Pagadas, entregadas y cerradas.",
    moneyFormat,
  );
  add(
    "Liquidaciones anuladas en soles",
    settlements.voidCents / 100,
    "Importes anulados.",
    moneyFormat,
  );
  add(
    "Liquidaciones en otra moneda o sin moneda",
    settlements.otherCurrencyCount,
    "Fuera de los totales en soles.",
  );
  add(
    "Fecha del evento (UTC)",
    report.event.starts_at ? new Date(report.event.starts_at) : "Sin fecha",
    "La pantalla muestra horario de Lima (UTC−5).",
    dateFormat,
  );
  add(
    "Actualización del reporte (UTC)",
    new Date(report.generatedAt),
    "Fecha de actualización de los datos exportados.",
    dateFormat,
  );

  const promoters = sheet(
    "Promotores",
    [38, 15, 18, 16, 23, 20, 18, 18, 18, 20, 25],
  );
  promoters.getCell("A3").value = report.event.closed_at
    ? "BabyClub · Entradas emitidas, invitaciones y accesos confirmados. Evento cerrado."
    : "BabyClub · Entradas emitidas, invitaciones y accesos confirmados. Evento abierto; asistencia en curso.";
  header(promoters, [
    "Promotor",
    "Total ingresados",
    "Con compra",
    "Mesa",
    "Invitación / free",
    "Sin modalidad",
    "Entradas personales emitidas",
    "Invitaciones personales emitidas",
    "Invitaciones personales con ingreso",
    "Invitaciones personales sin ingreso",
    "Invitaciones personales usadas sin confirmación de ingreso",
  ]);
  promoters.getRow(5).height = 60;
  for (const promoter of report.promoters) {
    const row = promoters.addRow([
      promoter.name,
      promoter.confirmed,
      promoter.purchase,
      promoter.table,
      promoter.courtesy + promoter.free,
      promoter.unclassified + promoter.unknown,
      promoter.issued,
      promoter.invited,
      promoter.invitationAttended,
      promoter.invitationWithoutAdmission,
      promoter.invitationUsageWithoutScan,
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
    promoters.autoFilter = { from: "A5", to: `K${promoters.rowCount}` };
  else
    promoters.getCell("A6").value =
      "Sin entradas ni accesos registrados por promotor.";

  const settlementSheet = sheet(
    "Liquidaciones",
    [38, 17, 14, 20, 20, 14, 24, 24, 38],
  );
  settlementSheet.getCell("A3").value =
    "BabyClub · Cada importe conserva su moneda. Los totales del cierre incluyen soles.";
  header(settlementSheet, [
    "Promotor",
    "Estado",
    "Moneda",
    "Importe",
    "Unidades en efectivo",
    "Tragos",
    "Creada (UTC)",
    "Liquidada (UTC)",
    "Identificador",
  ]);
  const exportDate = (value: string | null) =>
    value && Number.isFinite(Date.parse(value)) ? new Date(value) : "Sin fecha";
  for (const settlement of settlements.records) {
    const row = settlementSheet.addRow([
      settlement.promoterName,
      settlementStatusLabel(settlement.status),
      settlement.currencyCode || "Sin moneda",
      settlement.cashTotalCents / 100,
      settlement.cashUnits,
      settlement.drinkUnits,
      exportDate(settlement.createdAt),
      exportDate(settlement.settledAt),
      settlement.id,
    ]);
    row.height = 32;
    row.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11 };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (row.number % 2 === 0)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F5" },
        };
    });
    row.getCell(4).numFmt =
      settlement.currencyCode === "PEN" ? moneyFormat : "#,##0.00";
    row.getCell(5).numFmt = "#,##0";
    row.getCell(6).numFmt = "#,##0.##";
    row.getCell(7).numFmt = dateFormat;
    row.getCell(8).numFmt = dateFormat;
  }
  if (settlements.records.length)
    settlementSheet.autoFilter = {
      from: "A5",
      to: `I${settlementSheet.rowCount}`,
    };
  else
    settlementSheet.getCell("A6").value =
      "Sin liquidaciones registradas para este evento.";

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
