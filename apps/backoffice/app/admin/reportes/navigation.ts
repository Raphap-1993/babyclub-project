export const reportViews = [
  { key: "summary", label: "Resumen" },
  { key: "attendance", label: "Asistencia" },
  { key: "income", label: "Ingresos" },
  { key: "tables", label: "Mesas" },
  { key: "promoters", label: "Promotores" },
  { key: "settlements", label: "Liquidaciones" },
  { key: "quality", label: "Detalle" },
] as const;
export type ReportView = (typeof reportViews)[number]["key"];
export type ReportSearchParams = Record<string, string | string[] | undefined>;

const legacyViews: Record<string, ReportView> = {
  event_sales: "income",
  event_attendance: "attendance",
  free_qr_no_show: "attendance",
  promoter_performance: "promoters",
  promoter_settlement: "settlements",
  promoter_no_show: "promoters",
  table_reservations: "tables",
  settlements: "settlements",
};

export function reportView(
  params: Pick<URLSearchParams, "get">,
  fallback: ReportView = "summary",
): ReportView {
  const tab = params.get("tab");
  if (reportViews.some((view) => view.key === tab)) return tab as ReportView;
  return legacyViews[params.get("report") || ""] || fallback;
}

/** Preserve old route keys for bookmarked reports, while selecting the unified view. */
export function legacyReportHref(
  params: ReportSearchParams = {},
  fallback: ReportView = "summary",
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  query.set("tab", reportView(query, fallback));
  return `/admin/reportes?${query.toString()}`;
}

export function reportSelectionQuery(
  current: string,
  changes: {
    eventId?: string;
    view?: ReportView;
    promoterId?: string;
    promoterPage?: number;
    settlementPage?: number;
  },
): string {
  const query = new URLSearchParams(current);
  if (changes.eventId !== undefined) {
    query.set("event_id", changes.eventId);
    query.delete("promoter_page");
    query.delete("settlement_page");
  }
  if (changes.view !== undefined) query.set("tab", changes.view);
  if (changes.promoterId !== undefined) {
    if (changes.promoterId) query.set("promoter_id", changes.promoterId);
    else query.delete("promoter_id");
    query.delete("promoter_page");
    query.delete("settlement_page");
  }
  for (const [key, value] of [
    ["promoter_page", changes.promoterPage],
    ["settlement_page", changes.settlementPage],
  ] as const) {
    if (value === undefined) continue;
    if (value > 0) query.set(key, String(value + 1));
    else query.delete(key);
  }
  return query.toString();
}

export function reportPage(value: string | null): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed - 1 : 0;
}
