import { ticketQrDataUrl } from "shared/ticketQr";
import { getPublicLandingUrl } from "shared/publicUrl";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import type { TicketDetail } from "./ticketDetailTypes";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export async function getTicket(
  id: string,
): Promise<{ ticket: TicketDetail | null; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey)
    return { ticket: null, error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ticketQuery = applyNotDeleted(
    supabase
      .from("tickets")
      .select(
        "id,created_at,dni,full_name,email,phone,qr_token,event_id,code_id,promoter_id,payment_status,table_reservation_id",
      )
      .eq("id", id)
      .limit(1),
  );
  const { data, error } = await ticketQuery.maybeSingle();

  if (error || !data)
    return { ticket: null, error: error?.message || "Ticket no encontrado" };

  const [eventRes, codeRes] = await Promise.all([
    data.event_id
      ? applyNotDeleted(
          supabase
            .from("events")
            .select("id,name")
            .eq("id", data.event_id)
            .limit(1),
        ).maybeSingle()
      : Promise.resolve({ data: null }),
    data.code_id
      ? applyNotDeleted(
          supabase
            .from("codes")
            .select("id,code,type,promoter_id,table_reservation_id")
            .eq("id", data.code_id)
            .limit(1),
        ).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const codeData = codeRes.data as any;
  const promoterId = data.promoter_id || codeData?.promoter_id || null;
  const promoterRes = promoterId
    ? await applyNotDeleted(
        supabase
          .from("promoters")
          .select("code,person:persons(first_name,last_name)")
          .eq("id", promoterId)
          .limit(1),
      ).maybeSingle()
    : { data: null as any };

  const promoterData = (promoterRes as any)?.data;
  const promoterPerson = Array.isArray(promoterData?.person)
    ? promoterData.person?.[0]
    : promoterData?.person;
  const promoterName =
    [promoterPerson?.first_name, promoterPerson?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    promoterData?.code ||
    null;

  // Buscar códigos de mesa priorizando la relación directa ticket -> reserva
  let tableCodes: string[] = [];
  let tableName: string | null = null;
  let productName: string | null = null;
  let productItems: string[] | null = null;
  let reservationSaleOrigin: "table" | "ticket" | null = null;
  let ticketTypeLabel: string | null = null;
  const tableReservationId =
    (data as any).table_reservation_id ||
    codeData?.table_reservation_id ||
    null;
  if (tableReservationId) {
    const resvByIdQuery = applyNotDeleted(
      supabase
        .from("table_reservations")
        .select(
          "codes,sale_origin,ticket_type_label,table:tables(name),product:table_products(name,items)",
        )
        .eq("id", tableReservationId)
        .limit(1),
    );
    const { data: first } = await resvByIdQuery.maybeSingle();
    tableCodes = first?.codes ? (first.codes as any[]).filter(Boolean) : [];
    const tableRel = Array.isArray(first?.table)
      ? first?.table?.[0]
      : first?.table;
    const prodRel = Array.isArray(first?.product)
      ? first?.product?.[0]
      : first?.product;
    tableName = tableRel?.name || null;
    productName = prodRel?.name || null;
    productItems = prodRel?.items || null;
    reservationSaleOrigin =
      first?.sale_origin === "ticket" || first?.sale_origin === "table"
        ? first.sale_origin
        : null;
    ticketTypeLabel =
      typeof first?.ticket_type_label === "string"
        ? first.ticket_type_label
        : null;
  } else if (data.email || data.phone) {
    // Fallback legacy: registros antiguos sin table_reservation_id.
    const resvByContactQuery = applyNotDeleted(
      supabase
        .from("table_reservations")
        .select(
          "codes,status,sale_origin,ticket_type_label,table:tables(name),product:table_products(name,items)",
        )
        .or(
          [
            data.email ? `email.eq.${data.email}` : "",
            data.phone ? `phone.eq.${data.phone}` : "",
          ]
            .filter(Boolean)
            .join(","),
        )
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const { data: resv } = await resvByContactQuery;
    const first = resv?.[0];
    tableCodes = first?.codes ? (first.codes as any[]).filter(Boolean) : [];
    const tableRel = Array.isArray(first?.table)
      ? first?.table?.[0]
      : first?.table;
    const prodRel = Array.isArray(first?.product)
      ? first?.product?.[0]
      : first?.product;
    tableName = tableRel?.name || null;
    productName = prodRel?.name || null;
    productItems = prodRel?.items || null;
    reservationSaleOrigin =
      first?.sale_origin === "ticket" || first?.sale_origin === "table"
        ? first.sale_origin
        : null;
    ticketTypeLabel =
      typeof first?.ticket_type_label === "string"
        ? first.ticket_type_label
        : null;
  }

  return {
    ticket: {
      id: data.id,
      created_at: data.created_at,
      dni: data.dni ?? null,
      full_name: data.full_name ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      qr_token: data.qr_token ?? null,
      qr_image: data.qr_token ? await ticketQrDataUrl(data.qr_token) : null,
      public_ticket_url: `${getPublicLandingUrl()}/ticket/${data.id}`,
      payment_status: data.payment_status ?? null,
      event_id: data.event_id ?? null,
      code_id: data.code_id ?? null,
      event_name: eventRes.data?.name ?? null,
      code_value: codeRes.data?.code ?? null,
      code_type:
        typeof codeRes.data?.type === "string"
          ? codeRes.data.type.toLowerCase()
          : null,
      promoter_name: promoterName,
      table_codes: tableCodes,
      table_name: tableName,
      product_name: productName,
      product_items: productItems,
      sale_origin: reservationSaleOrigin,
      ticket_type_label: ticketTypeLabel,
    },
  };
}
