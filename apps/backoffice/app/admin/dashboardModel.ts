import type { PromoterSummary } from "@repo/api-logic/promoter-summary";
import type { QRSummary } from "@repo/api-logic/qr-summary";

export type DashboardTypeKey = "general" | "table" | "courtesy" | "free" | "unknown";

export type DashboardTypeBreakdown = {
  key: DashboardTypeKey;
  label: string;
  value: number;
};

export type DashboardPromoterBreakdown = {
  promoterId: string;
  name: string;
  tickets: number;
};

export type DashboardEventModel = {
  eventId: string;
  name: string;
  date: string;
  totalQr: number;
  totalTickets: number;
  qrBreakdown: DashboardTypeBreakdown[];
  promoters: DashboardPromoterBreakdown[];
};

export type DashboardModel = {
  globalTotals: {
    totalQr: number;
    totalTickets: number;
    byType: Record<DashboardTypeKey, number>;
  };
  events: DashboardEventModel[];
};

const TYPE_LABELS: Record<DashboardTypeKey, string> = {
  general: "Entradas",
  table: "Mesas",
  courtesy: "Cortesías",
  free: "Free",
  unknown: "Sin clasificar",
};

const TYPE_ORDER: DashboardTypeKey[] = ["general", "table", "courtesy", "free", "unknown"];

const TYPE_ALIASES: Record<string, DashboardTypeKey> = {
  general: "general",
  entrada: "general",
  entradas: "general",
  ticket: "general",
  table: "table",
  mesa: "table",
  mesas: "table",
  courtesy: "courtesy",
  cortesia: "courtesy",
  cortesia_general: "courtesy",
  free: "free",
};

function normalizeTypeKey(rawKey: string): DashboardTypeKey {
  return TYPE_ALIASES[rawKey.trim().toLowerCase()] || "unknown";
}

function emptyTypeTotals(): Record<DashboardTypeKey, number> {
  return {
    general: 0,
    table: 0,
    courtesy: 0,
    free: 0,
    unknown: 0,
  };
}

function normalizeQrBreakdown(byType: Record<string, number> | undefined | null): Record<DashboardTypeKey, number> {
  const totals = emptyTypeTotals();

  Object.entries(byType || {}).forEach(([key, value]) => {
    const parsed = Number(value);
    const normalized = Number.isFinite(parsed) ? parsed : 0;
    const bucket = normalizeTypeKey(key);
    totals[bucket] += normalized;
  });

  return totals;
}

function normalizePromoters(promoters: PromoterSummary["promoters"] | undefined | null): DashboardPromoterBreakdown[] {
  if (!Array.isArray(promoters)) return [];

  return promoters
    .map((promoter) => ({
      promoterId: promoter.promoter_id,
      name: promoter.name,
      tickets: Number(promoter.tickets || 0),
    }))
    .sort((a, b) => b.tickets - a.tickets);
}

export function buildAdminDashboardModel({
  qrEvents,
  promoterEvents,
}: {
  qrEvents: QRSummary[];
  promoterEvents: PromoterSummary[];
}): DashboardModel {
  const eventMap = new Map<string, DashboardEventModel>();
  const globalTotals = emptyTypeTotals();
  let totalQr = 0;
  let totalTickets = 0;

  qrEvents.forEach((event) => {
    const normalizedByType = normalizeQrBreakdown(event.by_type);
    const qrBreakdown = TYPE_ORDER.map((key) => ({
      key,
      label: TYPE_LABELS[key],
      value: normalizedByType[key],
    }));

    TYPE_ORDER.forEach((key) => {
      globalTotals[key] += normalizedByType[key];
    });
    totalQr += Number(event.total_qr || 0);

    eventMap.set(event.event_id, {
      eventId: event.event_id,
      name: event.name,
      date: event.date,
      totalQr: Number(event.total_qr || 0),
      totalTickets: 0,
      qrBreakdown,
      promoters: [],
    });
  });

  promoterEvents.forEach((event) => {
    const existing = eventMap.get(event.event_id) || {
      eventId: event.event_id,
      name: event.name,
      date: event.date,
      totalQr: 0,
      totalTickets: 0,
      qrBreakdown: TYPE_ORDER.map((key) => ({
        key,
        label: TYPE_LABELS[key],
        value: 0,
      })),
      promoters: [],
    };

    existing.name = existing.name || event.name;
    existing.date = existing.date || event.date;
    existing.totalTickets = Number(event.total_tickets || 0);
    existing.promoters = normalizePromoters(event.promoters);

    totalTickets += Number(event.total_tickets || 0);

    eventMap.set(event.event_id, existing);
  });

  const events = Array.from(eventMap.values()).sort((a, b) => {
    const aDate = new Date(a.date).getTime();
    const bDate = new Date(b.date).getTime();
    if (Number.isFinite(aDate) && Number.isFinite(bDate)) {
      return aDate - bDate;
    }
    return a.name.localeCompare(b.name);
  });

  return {
    globalTotals: {
      totalQr,
      totalTickets,
      byType: globalTotals,
    },
    events,
  };
}
