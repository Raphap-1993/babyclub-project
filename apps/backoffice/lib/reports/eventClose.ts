export type EventRow = {
  id: string;
  name: string;
  starts_at: string | null;
  closed_at: string | null;
};
type RelatedRow = { id: string; event_id: string; deleted_at?: string | null };
export type TicketRow = RelatedRow & {
  code_id?: string | null;
  table_reservation_id?: string | null;
  promoter_id?: string | null;
  used?: boolean;
  used_at?: string | null;
  is_active?: boolean;
};
export type CodeRow = RelatedRow & {
  type?: string | null;
  table_reservation_id?: string | null;
  promoter_id?: string | null;
};
export type ReservationRow = RelatedRow & {
  status?: string | null;
  sale_origin?: string | null;
  table_id?: string | null;
  ticket_total_amount?: number | string | null;
};
export type PaymentRow = RelatedRow & {
  status?: string | null;
  amount?: number | string | null;
  currency_code?: string | null;
  reservation_id?: string | null;
  ticket_id?: string | null;
  refunded_at?: string | null;
};
export type ScanRow = RelatedRow & {
  ticket_id?: string | null;
  code_id?: string | null;
  raw_value?: string | null;
  result?: string | null;
  created_at?: string | null;
};
export type EventCloseInput = {
  event: EventRow;
  tickets: TicketRow[];
  codes: CodeRow[];
  reservations: ReservationRow[];
  payments: PaymentRow[];
  scans: ScanRow[];
  promoters: { id: string; name: string }[];
};

const categories = [
  {
    key: "purchase",
    label: "Con compra registrada",
    description: "Compra aprobada o pago confirmado asociado al acceso.",
  },
  {
    key: "table",
    label: "Invitados de mesa",
    description:
      "Accesos vinculados a una mesa; no equivalen a mesas vendidas.",
  },
  {
    key: "courtesy",
    label: "Cortesías / invitaciones",
    description: "QR de cortesía sin una compra asociada.",
  },
  {
    key: "free",
    label: "Free explícito",
    description: "Accesos registrados expresamente como gratuitos.",
  },
  {
    key: "unclassified",
    label: "General por clasificar",
    description: "El QR general no indica si hubo gratuidad o cobro en puerta.",
  },
  {
    key: "unknown",
    label: "Otros por revisar",
    description: "Falta evidencia suficiente para clasificar el acceso.",
  },
] as const;
export type AccessCategory = (typeof categories)[number]["key"];
const status = (value?: string | null) => (value || "").trim().toLowerCase();
const byId = <T extends { id: string }>(rows: T[]) =>
  new Map(rows.map((row) => [row.id, row]));
const unique = <T extends { id: string }>(rows: T[]) => [
  ...byId(rows).values(),
];

/** Closing legacy events soft-deleted their reservations at the exact close timestamp. */
export function isHistoricalRow(
  row: { deleted_at?: string | null },
  event: EventRow,
): boolean {
  if (!row.deleted_at) return true;
  return Boolean(
    event.closed_at &&
      Number.isFinite(Date.parse(row.deleted_at)) &&
      Date.parse(row.deleted_at) === Date.parse(event.closed_at),
  );
}

function amount(
  value: number | string | null | undefined,
  multiplier = 1,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  const cents = Math.round(number * multiplier);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function buildEventClose(
  input: EventCloseInput,
  generatedAt = new Date().toISOString(),
) {
  const { event } = input;
  const forEvent = <T extends RelatedRow>(rows: T[]) =>
    unique(rows.filter((row) => row.event_id === event.id));
  // Keep original relations for confirmed admissions, including subsequently deactivated QR.
  const tickets = byId(forEvent(input.tickets));
  const codes = byId(forEvent(input.codes));
  const reservations = forEvent(input.reservations).filter((row) =>
    isHistoricalRow(row, event),
  );
  const reservationMap = byId(reservations);
  const approved = reservations.filter(
    (row) => status(row.status) === "approved",
  );
  const ticketReservations = approved.filter(
    (row) => status(row.sale_origin) === "ticket",
  );
  const tableReservations = approved.filter(
    (row) =>
      status(row.sale_origin) === "table" ||
      (row.table_id && status(row.sale_origin) !== "ticket"),
  );
  const payments = forEvent(input.payments).filter((row) => !row.deleted_at);
  const paid = payments.filter(
    (row) => status(row.status) === "paid" && !row.refunded_at,
  );
  const paidTickets = new Set(paid.map((row) => row.ticket_id).filter(Boolean));
  const paidReservations = new Set(
    paid.map((row) => row.reservation_id).filter(Boolean),
  );
  const promoters = byId(input.promoters);

  function classify(ticket?: TicketRow, code?: CodeRow): AccessCategory {
    const reservationId =
      ticket?.table_reservation_id || code?.table_reservation_id;
    const reservation = reservationId
      ? reservationMap.get(reservationId)
      : undefined;
    const origin = status(reservation?.sale_origin);
    if (
      origin === "table" ||
      (reservation?.table_id && origin !== "ticket") ||
      status(code?.type) === "table"
    )
      return "table";
    if (
      (ticket && paidTickets.has(ticket.id)) ||
      (reservationId && paidReservations.has(reservationId))
    )
      return "purchase";
    if (origin === "ticket")
      return status(reservation?.status) === "approved"
        ? "purchase"
        : "unknown";
    // A removed/unavailable reservation must never turn a purchase into a free invitation.
    if (reservationId) return "unknown";
    if (status(code?.type) === "courtesy") return "courtesy";
    if (status(code?.type) === "free") return "free";
    if (["general", "promoter_link"].includes(status(code?.type)))
      return "unclassified";
    return "unknown";
  }

  const confirmedScans = forEvent(input.scans)
    .filter(
      (row) =>
        status(row.result) === "valid" &&
        !row.deleted_at &&
        Boolean(row.raw_value) &&
        (row.raw_value === row.ticket_id || row.raw_value === row.code_id),
    )
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  const admissions = new Map<string, ScanRow>();
  for (const scan of confirmedScans) {
    const key = scan.ticket_id
      ? `ticket:${scan.ticket_id}`
      : `code:${scan.code_id}`;
    if (!admissions.has(key)) admissions.set(key, scan);
  }
  const counts: Record<AccessCategory, number> = {
    purchase: 0,
    table: 0,
    courtesy: 0,
    free: 0,
    unclassified: 0,
    unknown: 0,
  };
  const promoterRows = new Map<
    string,
    {
      id: string;
      name: string;
      confirmed: number;
      purchase: number;
      table: number;
      courtesy: number;
      free: number;
      unclassified: number;
      unknown: number;
    }
  >();
  for (const scan of admissions.values()) {
    const ticket = scan.ticket_id ? tickets.get(scan.ticket_id) : undefined;
    const code = codes.get(ticket?.code_id || scan.code_id || "");
    const category = classify(ticket, code);
    counts[category]++;
    const promoterId = ticket?.promoter_id || code?.promoter_id || "unassigned";
    if (!promoterRows.has(promoterId))
      promoterRows.set(promoterId, {
        id: promoterId,
        name:
          promoterId === "unassigned"
            ? "Sin promotor asignado"
            : promoters.get(promoterId)?.name || "Promotor sin nombre",
        confirmed: 0,
        purchase: 0,
        table: 0,
        courtesy: 0,
        free: 0,
        unclassified: 0,
        unknown: 0,
      });
    const row = promoterRows.get(promoterId)!;
    row.confirmed++;
    row[category]++;
  }

  const invitations = {
    issued: 0,
    attended: 0,
    withoutAdmission: 0,
    usageWithoutScan: 0,
    codeOnlyAdmissions: [...admissions.values()].filter((scan) => {
      if (scan.ticket_id) return false;
      const category = classify(undefined, codes.get(scan.code_id || ""));
      return category === "courtesy" || category === "free";
    }).length,
  };
  for (const ticket of tickets.values()) {
    const admitted = admissions.has(`ticket:${ticket.id}`);
    // A later cancellation cannot erase a confirmed admission; unused cancelled tickets are not absences.
    if (
      !admitted &&
      (!isHistoricalRow(ticket, event) || ticket.is_active === false)
    )
      continue;
    const category = classify(ticket, codes.get(ticket.code_id || ""));
    if (category !== "courtesy" && category !== "free") continue;
    invitations.issued++;
    if (admitted) invitations.attended++;
    else if (ticket.used || ticket.used_at) invitations.usageWithoutScan++;
    else invitations.withoutAdmission++;
  }
  const declaredAmounts = ticketReservations.map((row) =>
    amount(row.ticket_total_amount, 100),
  );
  const penPayments = paid.filter((row) => status(row.currency_code) === "pen");
  const refunds = payments.filter(
    (row) => status(row.status) === "refunded" || row.refunded_at,
  );
  const sum = (values: (number | null)[]) =>
    values.reduce<number>((total, value) => total + (value ?? 0), 0);
  const dates = [...admissions.values()]
    .map((scan) => scan.created_at)
    .filter((date): date is string =>
      Boolean(date && Number.isFinite(Date.parse(date))),
    )
    .sort();

  return {
    version: 1 as const,
    event,
    generatedAt,
    attendance: {
      confirmed: admissions.size,
      codeOnly: [...admissions.values()].filter((scan) => !scan.ticket_id)
        .length,
      firstAt: dates[0] || null,
      lastAt: dates.at(-1) || null,
      categories: categories.map((category) => ({
        ...category,
        count: counts[category.key],
      })),
    },
    invitations,
    sales: {
      approvedTicketReservations: ticketReservations.length,
      declaredTicketAmountCents: sum(declaredAmounts),
      approvedWithoutAmount: declaredAmounts.filter((value) => value === null)
        .length,
      confirmedPaymentCount: penPayments.length,
      confirmedPaymentAmountCents: sum(
        penPayments.map((row) => amount(row.amount)),
      ),
      paymentsWithoutAmount: penPayments.filter(
        (row) => amount(row.amount) === null,
      ).length,
      otherCurrencyPayments: paid.length - penPayments.length,
      refundedPaymentCount: refunds.length,
      refundedPaymentAmountCents: sum(
        refunds
          .filter((row) => status(row.currency_code) === "pen")
          .map((row) => amount(row.amount)),
      ),
      doorAmountCents: null,
      tableConsumptionCents: null,
      profitCents: null,
    },
    tables: {
      approvedReservations: tableReservations.length,
      distinctTables: new Set(
        tableReservations.map((row) => row.table_id).filter(Boolean),
      ).size,
      admittedGuests: counts.table,
    },
    promoters: [...promoterRows.values()].sort(
      (a, b) => b.confirmed - a.confirmed || a.name.localeCompare(b.name),
    ),
    quality: {
      archivedReservationsIncluded: reservations.filter((row) => row.deleted_at)
        .length,
      excludedDeletedReservations:
        forEvent(input.reservations).length - reservations.length,
      unclassifiedAdmissions: counts.unclassified + counts.unknown,
      repeatedConfirmations: confirmedScans.length - admissions.size,
    },
  };
}
export type EventCloseReport = ReturnType<typeof buildEventClose>;

export const formatPen = (cents: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    cents / 100,
  );
export function formatLima(date: string | null, time = false): string {
  if (!date || !Number.isFinite(Date.parse(date))) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(new Date(date));
}

/** Export the already displayed snapshot, not a second query with possibly different filters. */
export function eventCloseCsv(report: EventCloseReport): string {
  const rows: (string | number)[][] = [
    ["Evento", "Sección", "Indicador", "Valor", "Unidad / alcance"],
    [report.event.name, "Corte", "Generado", report.generatedAt, "UTC"],
    [
      report.event.name,
      "Asistencia",
      "Ingresos confirmados",
      report.attendance.confirmed,
      "QR únicos, no intentos de escaneo",
    ],
    ...report.attendance.categories.map((row) => [
      report.event.name,
      "Asistencia",
      row.label,
      row.count,
      row.description,
    ]),
    [
      report.event.name,
      "Invitaciones",
      "Emitidas",
      report.invitations.issued,
      "Cortesías y free explícitos",
    ],
    [
      report.event.name,
      "Invitaciones",
      "Ingresaron",
      report.invitations.attended,
      "Confirmación de ingreso",
    ],
    [
      report.event.name,
      "Invitaciones",
      "Sin ingreso registrado",
      report.invitations.withoutAdmission,
      report.event.closed_at ? "Evento cerrado" : "Evento aún sin cierre",
    ],
    [
      report.event.name,
      "Invitaciones",
      "Uso pendiente de conciliar",
      report.invitations.usageWithoutScan,
      "No se marca como ausente",
    ],
    [
      report.event.name,
      "Ingresos",
      "Reservas de entradas aprobadas",
      report.sales.approvedTicketReservations,
      "Pedidos, no personas",
    ],
    [
      report.event.name,
      "Ingresos",
      "Monto declarado en reservas",
      report.sales.approvedWithoutAmount > 0 &&
      report.sales.approvedWithoutAmount ===
        report.sales.approvedTicketReservations
        ? "No disponible"
        : report.sales.declaredTicketAmountCents / 100,
      "PEN; no sumar a pagos ni interpretar como caja",
    ],
    [
      report.event.name,
      "Ingresos",
      "Reservas sin importe",
      report.sales.approvedWithoutAmount,
      "Pendientes de conciliar",
    ],
    [
      report.event.name,
      "Ingresos",
      "Pagos confirmados",
      report.sales.confirmedPaymentAmountCents / 100,
      "PEN; registrados como paid, sin reembolso",
    ],
    [
      report.event.name,
      "Ingresos",
      "Pagos sin importe",
      report.sales.paymentsWithoutAmount,
      "Pendientes de conciliar",
    ],
    [
      report.event.name,
      "Ingresos",
      "Pagos en otra moneda o sin moneda",
      report.sales.otherCurrencyPayments,
      "Excluidos del total PEN",
    ],
    [
      report.event.name,
      "Ingresos",
      "Importe original de pagos reembolsados",
      report.sales.refundedPaymentAmountCents / 100,
      "PEN; no acredita importe exacto de devolución parcial",
    ],
    [
      report.event.name,
      "Mesas",
      "Reservas aprobadas",
      report.tables.approvedReservations,
      "Reservas",
    ],
    [
      report.event.name,
      "Mesas",
      "Invitados ingresados",
      report.tables.admittedGuests,
      "Accesos",
    ],
    ...["Cobros en puerta", "Consumo de mesas", "Ganancia neta"].map(
      (label) => [
        report.event.name,
        "Pendiente",
        label,
        "No disponible",
        "Falta registro conciliable",
      ],
    ),
    [
      report.event.name,
      "Invitaciones",
      "Ingresos con código sin ticket",
      report.invitations.codeOnlyAdmissions,
      "Adicionales a los tickets invitados; incluidos en asistencia",
    ],
    ...report.promoters.map((row) => [
      report.event.name,
      "Promotores",
      row.name,
      row.confirmed,
      "Ingresos confirmados",
    ]),
    [
      report.event.name,
      "Calidad",
      "Reservas recuperadas del cierre",
      report.quality.archivedReservationsIncluded,
      "Solo lectura histórica",
    ],
  ];
  const escape = (value: string | number) => {
    let text = String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n");
}
