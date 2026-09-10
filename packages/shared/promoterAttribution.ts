import { evaluateEventSales } from "./eventSales";

export class PurchaseAttributionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function isPromoterId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
function optionalText(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.trim())
    throw new PurchaseAttributionError("Referencia de promotor inválida");
  return value.trim();
}
export async function readActivePromoter(supabase: any, id: string) {
  if (!isPromoterId(id))
    throw new PurchaseAttributionError("Referencia de promotor inválida");
  const { data, error } = await supabase
    .from("promoters")
    .select("id,is_active,deleted_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error)
    throw new PurchaseAttributionError(
      "No pudimos verificar el promotor. Intenta nuevamente.",
      503,
    );
  if (!data || data.deleted_at || data.is_active === false)
    throw new PurchaseAttributionError(
      "El enlace del promotor no está disponible",
      404,
    );
  return data;
}
export type PurchaseAttribution = {
  promoterId: string | null;
  promoterLinkCodeId: string | null;
  promoterLinkCode: string | null;
};

// Invoke only from validated purchase POSTs. GET callers use readActivePromoter.
export async function resolvePurchaseAttribution(
  supabase: any,
  eventId: string | null,
  body: Record<string, unknown>,
): Promise<PurchaseAttribution> {
  const ref = optionalText(body, "promoter_ref")?.toLowerCase() || null;
  const suppliedPromoter =
    optionalText(body, "promoter_id")?.toLowerCase() || null;
  const suppliedId = optionalText(body, "promoter_link_code_id");
  const suppliedCode = optionalText(body, "promoter_link_code");
  const empty = {
    promoterId: null,
    promoterLinkCodeId: null,
    promoterLinkCode: null,
  };
  if (!ref && !suppliedPromoter && !suppliedId && !suppliedCode) return empty;
  if (!eventId || !isPromoterId(eventId))
    throw new PurchaseAttributionError("Selecciona un evento válido");
  if (ref && suppliedPromoter && ref !== suppliedPromoter)
    throw new PurchaseAttributionError("El promotor no coincide con el enlace");
  if (suppliedId && !isPromoterId(suppliedId))
    throw new PurchaseAttributionError("Enlace de promotor inválido");

  let link: any = null;
  if (suppliedId || suppliedCode) {
    let query = supabase
      .from("codes")
      .select(
        "id,code,type,event_id,promoter_id,is_active,deleted_at,expires_at,max_uses,uses",
      );
    if (suppliedId) query = query.eq("id", suppliedId);
    if (suppliedCode) query = query.eq("code", suppliedCode);
    const result = await query.is("deleted_at", null).maybeSingle();
    if (result.error)
      throw new PurchaseAttributionError(
        "No pudimos verificar el enlace. Intenta nuevamente.",
        503,
      );
    link = result.data;
    if (
      !link ||
      link.type !== "promoter_link" ||
      link.event_id !== eventId ||
      !link.promoter_id ||
      link.is_active === false ||
      link.deleted_at ||
      (link.expires_at &&
        (!Number.isFinite(Date.parse(link.expires_at)) ||
          Date.parse(link.expires_at) <= Date.now())) ||
      (link.max_uses != null &&
        Number(link.uses || 0) >= Number(link.max_uses)) ||
      (suppliedId && link.id !== suppliedId) ||
      (suppliedCode && link.code !== suppliedCode)
    ) {
      throw new PurchaseAttributionError(
        "El enlace no está disponible para este evento",
        409,
      );
    }
    if (
      (ref && ref !== link.promoter_id) ||
      (suppliedPromoter && suppliedPromoter !== link.promoter_id)
    )
      throw new PurchaseAttributionError(
        "El promotor no coincide con el enlace",
      );
  }
  const promoter = await readActivePromoter(
    supabase,
    ref || link?.promoter_id || suppliedPromoter!,
  );
  const eventResult = await supabase
    .from("events")
    .select("id,is_active,deleted_at,closed_at,sale_status,sale_public_message")
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (eventResult.error)
    throw new PurchaseAttributionError(
      "No pudimos verificar el evento. Intenta nuevamente.",
      503,
    );
  const decision = evaluateEventSales(eventResult.data);
  if (!eventResult.data || eventResult.data.deleted_at || !decision.available)
    throw new PurchaseAttributionError(
      decision.public_message || "El evento no está disponible",
      409,
    );
  if (ref && !link) {
    const { data, error } = await supabase.rpc("ensure_promoter_event_link", {
      p_promoter_id: promoter.id,
      p_event_id: eventId,
    });
    if (error)
      throw new PurchaseAttributionError(
        "No pudimos preparar el enlace para esta compra. Intenta nuevamente.",
        error.code === "P0001" ? 409 : 503,
      );
    link = Array.isArray(data) ? data[0] : data;
    if (
      !link?.id ||
      !link?.code ||
      link.promoter_id !== promoter.id ||
      link.event_id !== eventId
    )
      throw new PurchaseAttributionError(
        "No pudimos verificar la atribución de la compra",
        503,
      );
  }
  return {
    promoterId: promoter.id,
    promoterLinkCodeId: link?.id || null,
    promoterLinkCode: link?.code || null,
  };
}
