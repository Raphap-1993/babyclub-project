import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  try {
    const { id } = await params;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Falta configuración de Supabase" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("[GET /api/tickets/:id] Buscando ticket:", id);

    // UNA SOLA QUERY con todos los JOINs necesarios
    const ticketQuery = applyNotDeleted(
      supabase
        .from("tickets")
        .select(`
          id,
          created_at,
          dni,
          full_name,
          email,
          phone,
          qr_token,
          event_id,
          code_id,
          promoter_id,
          table_reservation_id,
          event:events(name),
          code:codes(id,code,promoter_id,table_reservation_id),
          promoter:promoters(code,person:persons(first_name,last_name))
        `)
        .eq("id", id)
        .limit(1)
    );
    const { data, error } = await ticketQuery.maybeSingle();

    console.log("[GET /api/tickets/:id] Ticket + relaciones en:", Date.now() - startTime, "ms");

    if (error || !data) {
      console.error("[GET /api/tickets/:id] Error:", error);
      return NextResponse.json(
        { error: error?.message || "Ticket no encontrado" },
        { status: 404 }
      );
    }

    // Normalizar relaciones
    const eventRel = Array.isArray((data as any).event) ? (data as any).event[0] : (data as any).event;
    const codeRel = Array.isArray((data as any).code) ? (data as any).code[0] : (data as any).code;
    const promoterRel = Array.isArray((data as any).promoter) ? (data as any).promoter[0] : (data as any).promoter;

    const promoterPerson = Array.isArray(promoterRel?.person)
      ? promoterRel.person[0]
      : promoterRel?.person;
    const promoterName =
      [promoterPerson?.first_name, promoterPerson?.last_name].filter(Boolean).join(" ").trim() ||
      promoterRel?.code ||
      null;

    const tableReservationId = (data as any).table_reservation_id || codeRel?.table_reservation_id || null;
    let tableCodes: string[] = [];
    let tableName: string | null = null;
    let productName: string | null = null;
    let productItems: string[] | null = null;

    if (tableReservationId) {
      const reservationQuery = applyNotDeleted(
        supabase
          .from("table_reservations")
          .select("codes,table:tables(name),product:table_products(name,items)")
          .eq("id", tableReservationId)
          .limit(1)
      );
      const { data: reservationRow } = await reservationQuery.maybeSingle();
      if (reservationRow) {
        tableCodes = Array.isArray((reservationRow as any).codes)
          ? ((reservationRow as any).codes as any[]).map((value) => String(value || "").trim()).filter(Boolean)
          : [];

        const tableRel = Array.isArray((reservationRow as any).table)
          ? (reservationRow as any).table[0]
          : (reservationRow as any).table;
        const productRel = Array.isArray((reservationRow as any).product)
          ? (reservationRow as any).product[0]
          : (reservationRow as any).product;

        tableName = tableRel?.name || null;
        productName = productRel?.name || null;
        productItems = Array.isArray(productRel?.items) ? productRel.items : null;
      }
    }

    const ticket = {
      id: data.id,
      created_at: data.created_at,
      dni: data.dni ?? null,
      full_name: data.full_name ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      qr_token: data.qr_token ?? null,
      event_id: data.event_id ?? null,
      code_id: data.code_id ?? null,
      event_name: eventRel?.name ?? null,
      code_value: codeRel?.code ?? null,
      promoter_name: promoterName,
      table_codes: tableCodes,
      table_name: tableName,
      product_name: productName,
      product_items: productItems,
    };

    console.log("[GET /api/tickets/:id] Tiempo total:", Date.now() - startTime, "ms");

    return NextResponse.json({ ticket });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al obtener el ticket" },
      { status: 500 }
    );
  }
}
