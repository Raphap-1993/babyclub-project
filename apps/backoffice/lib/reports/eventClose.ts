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
export type SettlementRow = RelatedRow & {
  promoter_id?: string | null;
  promoter_name?: string | null;
  status?: string | null;
  currency_code?: string | null;
  cash_total_cents?: number | string | null;
  cash_units?: number | string | null;
  drink_units?: number | string | null;
  created_at?: string | null;
  settled_at?: string | null;
  is_active?: boolean | null;
};
export type EventCloseInput = {
  event: EventRow;
  tickets: TicketRow[];
  codes: CodeRow[];
  reservations: ReservationRow[];
  payments: PaymentRow[];
  scans: ScanRow[];
  promoters: { id: string; name: string }[];
  settlements?: SettlementRow[];
};

const categories = [
  {
    key: "purchase",
    label: "Con compra",
    description: "Entradas con compra aprobada o pago confirmado.",
  },
  {
    key: "table",
    label: "Invitados de mesa",
    description: "Invitados que ingresaron con una reserva de mesa.",
  },
  {
    key: "courtesy",
    label: "Cortesías / invitaciones",
    description: "Entradas de cortesía e invitaciones.",
  },
  {
    key: "free",
    label: "Entrada free",
    description:
      "Entradas free del evento, incluidos los QR generales. Cobros en puerta por separado.",
  },
  {
    key: "unknown",
    label: "Sin tipo de entrada",
    description: "Accesos cuyo tipo de entrada no está registrado.",
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

function quantity(value: number | string | null | undefined): number {
  const count = Number(value);
  return Number.isFinite(count) &&
    count >= 0 &&
    count <= Number.MAX_SAFE_INTEGER
    ? count
    : 0;
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
    // General is the event's free entry type, not evidence of a zero door payment.
    // Purchase/table relations above take precedence over the issuing QR type.
    if (["free", "general"].includes(status(code?.type))) return "free";
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
    unknown: 0,
  };
  const promoterRows = new Map<
    string,
    {
      id: string;
      name: string;
      issued: number;
      invited: number;
      invitationAttended: number;
      invitationWithoutAdmission: number;
      invitationUsageWithoutScan: number;
      confirmed: number;
      purchase: number;
      table: number;
      courtesy: number;
      free: number;
      unknown: number;
    }
  >();
  function promoterRow(ticket?: TicketRow, code?: CodeRow) {
    const promoterId = ticket?.promoter_id || code?.promoter_id || "unassigned";
    if (!promoterRows.has(promoterId))
      promoterRows.set(promoterId, {
        id: promoterId,
        name:
          promoterId === "unassigned"
            ? "Sin promotor asignado"
            : promoters.get(promoterId)?.name || "Promotor sin nombre",
        issued: 0,
        invited: 0,
        invitationAttended: 0,
        invitationWithoutAdmission: 0,
        invitationUsageWithoutScan: 0,
        confirmed: 0,
        purchase: 0,
        table: 0,
        courtesy: 0,
        free: 0,
        unknown: 0,
      });
    return promoterRows.get(promoterId)!;
  }
  let generalAdmissionsWithoutPayment = 0;
  for (const scan of admissions.values()) {
    const ticket = scan.ticket_id ? tickets.get(scan.ticket_id) : undefined;
    const code = codes.get(ticket?.code_id || scan.code_id || "");
    const category = classify(ticket, code);
    counts[category]++;
    if (category === "free" && status(code?.type) === "general")
      generalAdmissionsWithoutPayment++;
    const row = promoterRow(ticket, code);
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
    const code = codes.get(ticket.code_id || "");
    const row = promoterRow(ticket, code);
    row.issued++;
    const category = classify(ticket, code);
    if (category !== "courtesy" && category !== "free") continue;
    invitations.issued++;
    row.invited++;
    if (admitted) {
      invitations.attended++;
      row.invitationAttended++;
    } else if (ticket.used || ticket.used_at) {
      invitations.usageWithoutScan++;
      row.invitationUsageWithoutScan++;
    } else {
      invitations.withoutAdmission++;
      row.invitationWithoutAdmission++;
    }
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
  const settlementRecords = forEvent(input.settlements ?? [])
    .filter((row) => !row.deleted_at && row.is_active !== false)
    .map((row) => ({
      id: row.id,
      promoterId: row.promoter_id || null,
      promoterName:
        row.promoter_name?.trim() ||
        promoters.get(row.promoter_id || "")?.name ||
        "Promotor sin nombre",
      status: status(row.status),
      currencyCode: status(row.currency_code).toUpperCase() || null,
      cashTotalCents: amount(row.cash_total_cents) ?? 0,
      cashUnits: amount(row.cash_units) ?? 0,
      drinkUnits: quantity(row.drink_units),
      createdAt: row.created_at || null,
      settledAt: row.settled_at || null,
    }));
  const settlementTotal = (statuses: string[]) =>
    sum(
      settlementRecords
        .filter(
          (row) => row.currencyCode === "PEN" && statuses.includes(row.status),
        )
        .map((row) => row.cashTotalCents),
    );
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
    settlements: {
      records: settlementRecords,
      count: settlementRecords.length,
      pendingCents: settlementTotal(["draft", "pending"]),
      settledCents: settlementTotal(["paid", "delivered", "closed"]),
      voidCents: settlementTotal(["void"]),
      otherCurrencyCount: settlementRecords.filter(
        (row) => row.currencyCode !== "PEN",
      ).length,
    },
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
      unclassifiedAdmissions: counts.unknown,
      // Preserve the evidence gap for historical cash reconciliation independently of entry type.
      generalAdmissionsWithoutPayment,
      repeatedConfirmations: confirmedScans.length - admissions.size,
    },
  };
}
export type EventCloseReport = ReturnType<typeof buildEventClose>;

/** One visibility rule for the chart, CSV and Excel; never drops nonzero unknown admissions. */
export const visibleAccessCategories = (report: EventCloseReport) =>
  report.attendance.categories.filter((category) => category.count > 0);

export const settlementStatusLabel = (value: string): string =>
  ({
    draft: "Borrador",
    pending: "Pendiente",
    paid: "Pagada",
    delivered: "Entregada",
    closed: "Cerrada",
    void: "Anulada",
  })[value] || (value ? "Otro estado" : "Sin estado");

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
    ["Evento", "Sección", "Indicador", "Valor", "Detalle"],
    [report.event.name, "Corte", "Generado", report.generatedAt, "UTC"],
    [
      report.event.name,
      "Asistencia",
      "Accesos confirmados",
      report.attendance.confirmed,
      "Entradas validadas en puerta",
    ],
    ...visibleAccessCategories(report).map((row) => [
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
      "Cortesías y entradas free",
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
      report.event.closed_at ? "Evento cerrado" : "Evento abierto",
    ],
    [
      report.event.name,
      "Invitaciones",
      "Usadas sin confirmación de ingreso",
      report.invitations.usageWithoutScan,
      "Uso registrado; ingreso sin confirmar",
    ],
    [
      report.event.name,
      "Ingresos",
      "Reservas de entradas aprobadas",
      report.sales.approvedTicketReservations,
      "Reservas de entradas aprobadas",
    ],
    [
      report.event.name,
      "Ingresos",
      "Valor de reservas aprobadas",
      report.sales.approvedWithoutAmount > 0 &&
      report.sales.approvedWithoutAmount ===
        report.sales.approvedTicketReservations
        ? "No disponible"
        : report.sales.declaredTicketAmountCents / 100,
      "Soles; valor de las entradas aprobadas, separado de los pagos",
    ],
    [
      report.event.name,
      "Ingresos",
      "Reservas sin importe",
      report.sales.approvedWithoutAmount,
      "Importe pendiente de registrar",
    ],
    [
      report.event.name,
      "Ingresos",
      "Pagos registrados en soles",
      report.sales.confirmedPaymentAmountCents / 100,
      "Soles; pagos confirmados sin devoluciones",
    ],
    [
      report.event.name,
      "Ingresos",
      "Pagos sin importe",
      report.sales.paymentsWithoutAmount,
      "Importe pendiente de registrar",
    ],
    [
      report.event.name,
      "Ingresos",
      "Pagos en otra moneda o sin moneda",
      report.sales.otherCurrencyPayments,
      "Fuera del total en soles",
    ],
    [
      report.event.name,
      "Ingresos",
      "Importe original de los pagos con devolución",
      report.sales.refundedPaymentAmountCents / 100,
      "Soles; importe original de los pagos con devolución, sin desglose de devoluciones parciales",
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
        "Resumen financiero",
        label,
        "No disponible",
        "Sin registro en este reporte",
      ],
    ),
    [
      report.event.name,
      "Invitaciones",
      "Ingresos con código sin ticket",
      report.invitations.codeOnlyAdmissions,
      "Incluidos en la asistencia total",
    ],
    ...report.promoters.flatMap((row) =>
      [
        ["Accesos confirmados", row.confirmed],
        ...visibleAccessCategories(report).map((category) => [
          category.label,
          row[category.key],
        ]),
        ["Entradas personales emitidas", row.issued],
        ["Invitaciones personales emitidas", row.invited],
        ["Invitaciones personales con ingreso", row.invitationAttended],
        ["Invitaciones personales sin ingreso", row.invitationWithoutAdmission],
        [
          "Invitaciones personales usadas sin confirmación de ingreso",
          row.invitationUsageWithoutScan,
        ],
      ].map(([label, value]) => [
        report.event.name,
        "Promotores",
        row.name,
        value,
        label,
      ]),
    ),
    ...[
      [
        "Cantidad de liquidaciones",
        report.settlements.count,
        "Registros del evento",
      ],
      [
        "Pendiente en soles",
        report.settlements.pendingCents / 100,
        "PEN; borradores y pendientes",
      ],
      [
        "Pagado en soles",
        report.settlements.settledCents / 100,
        "PEN; pagadas, entregadas y cerradas",
      ],
      ["Anulado en soles", report.settlements.voidCents / 100, "PEN; anuladas"],
      [
        "Otra moneda o sin moneda",
        report.settlements.otherCurrencyCount,
        "Fuera de los totales en soles",
      ],
    ].map(([label, value, note]) => [
      report.event.name,
      "Liquidaciones",
      label,
      value,
      note,
    ]),
    ...report.settlements.records.flatMap((row) =>
      [
        ["Identificador", row.id],
        ["Estado", settlementStatusLabel(row.status)],
        ["Moneda", row.currencyCode || "Sin moneda"],
        [
          `Importe en ${row.currencyCode || "moneda sin indicar"}`,
          row.cashTotalCents / 100,
        ],
        ["Unidades en efectivo", row.cashUnits],
        ["Tragos", row.drinkUnits],
        ["Creada (UTC)", row.createdAt || "Sin fecha"],
        ["Liquidada (UTC)", row.settledAt || "Sin fecha"],
      ].map(([label, value]) => [
        report.event.name,
        "Detalle de liquidación",
        row.promoterName,
        value,
        label,
      ]),
    ),
    [
      report.event.name,
      "Detalle del cierre",
      "Reservas del historial de cierre",
      report.quality.archivedReservationsIncluded,
      "Historial del evento; todos los estados",
    ],
  ];
  const escape = (value: string | number) => {
    let text = String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n");
}
