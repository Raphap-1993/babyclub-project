import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildEventClose,
  type EventCloseInput,
  type EventRow,
} from "./eventClose";

type PageQuery = {
  order: (column: string, options: { ascending: boolean }) => PageQuery;
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
};

export async function readReportPages<T>(query: () => PageQuery): Promise<T[]> {
  const rows: T[] = [];
  // Continue to an empty page: an API row cap can be lower than our requested range.
  for (;;) {
    const { data, error } = await query()
      .order("id", { ascending: true })
      .range(rows.length, rows.length + 499);
    if (error || !data)
      throw new Error("No se pudo completar la lectura del reporte.");
    if (!data.length) return rows;
    rows.push(...(data as T[]));
    if (rows.length > 200_000)
      throw new Error("El evento supera el límite de consulta interactiva.");
  }
}

export async function loadReportEvents(
  client: SupabaseClient,
): Promise<EventRow[]> {
  const events = await readReportPages<EventRow>(() =>
    client
      .from("events")
      .select("id,name,starts_at,closed_at")
      .is("deleted_at", null),
  );
  return events.sort((a, b) =>
    (b.starts_at || "").localeCompare(a.starts_at || ""),
  );
}

export async function loadEventClose(client: SupabaseClient, eventId: string) {
  const { data: event, error } = await client
    .from("events")
    .select("id,name,starts_at,closed_at")
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("No se pudo consultar el evento.");
  if (!event) return null;
  const generatedAt = new Date().toISOString();
  const read = <K extends keyof Omit<EventCloseInput, "event" | "promoters">>(
    table: string,
    fields: string,
  ) =>
    readReportPages<EventCloseInput[K][number]>(() =>
      client.from(table).select(fields).eq("event_id", eventId),
    );
  // Explicit fields: no attendee identities, vouchers, QR secrets or card details are returned.
  const [tickets, codes, reservations, payments, scans] = await Promise.all([
    read<"tickets">(
      "tickets",
      "id,event_id,code_id,table_reservation_id,promoter_id,used,used_at,is_active,deleted_at",
    ),
    read<"codes">(
      "codes",
      "id,event_id,type,table_reservation_id,promoter_id,deleted_at",
    ),
    read<"reservations">(
      "table_reservations",
      "id,event_id,status,sale_origin,table_id,ticket_total_amount,deleted_at",
    ),
    read<"payments">(
      "payments",
      "id,event_id,status,amount,currency_code,reservation_id,ticket_id,refunded_at",
    ),
    read<"scans">(
      "scan_logs",
      "id,event_id,ticket_id,code_id,raw_value,result,created_at",
    ),
  ]);
  const promoterIds = [
    ...new Set(
      [...tickets, ...codes]
        .map((row) => row.promoter_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const promoters: EventCloseInput["promoters"] = [];
  for (let offset = 0; offset < promoterIds.length; offset += 200) {
    const rows = await readReportPages<{
      id: string;
      code: string | null;
      person:
        | { first_name?: string; last_name?: string }
        | { first_name?: string; last_name?: string }[]
        | null;
    }>(() =>
      client
        .from("promoters")
        .select("id,code,person:persons(first_name,last_name)")
        .in("id", promoterIds.slice(offset, offset + 200)),
    );
    for (const row of rows) {
      const person = Array.isArray(row.person) ? row.person[0] : row.person;
      promoters.push({
        id: row.id,
        name:
          [person?.first_name, person?.last_name].filter(Boolean).join(" ") ||
          row.code ||
          "Promotor sin nombre",
      });
    }
  }
  return buildEventClose(
    { event, tickets, codes, reservations, payments, scans, promoters },
    generatedAt,
  );
}
