import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/events/[id]/tables
 * Obtiene todas las mesas disponibles para un evento
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await context.params;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Obtener mesas disponibles con precios personalizados
    const { data, error } = await supabase
      .from("table_availability")
      .select(`
        id,
        is_available,
        custom_price,
        custom_min_consumption,
        notes,
        tables (
          id,
          name,
          ticket_count,
          price,
          min_consumption,
          is_active
        )
      `)
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("tables(name)");

    if (error) throw error;

    // Transformar datos para facilitar uso en frontend
    const tables = (data || []).map((item: any) => ({
      availabilityId: item.id,
      tableId: item.tables.id,
      name: item.tables.name,
      ticketCount: item.tables.ticket_count,
      basePrice: item.tables.price,
      finalPrice: item.custom_price || item.tables.price,
      baseMinConsumption: item.tables.min_consumption,
      finalMinConsumption: item.custom_min_consumption || item.tables.min_consumption,
      isAvailable: item.is_available,
      isActive: item.tables.is_active,
      notes: item.notes,
      hasCustomPrice: item.custom_price !== null,
      hasCustomMinConsumption: item.custom_min_consumption !== null,
    }));

    return NextResponse.json({ tables });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/events/[id]/tables
 * Actualiza la disponibilidad y precios de una mesa para un evento
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await context.params;

  try {
    const body = await req.json();
    const { tableId, isAvailable, customPrice, customMinConsumption, notes } = body;

    if (!tableId) {
      return NextResponse.json(
        { error: "tableId es requerido" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Actualizar o crear registro de disponibilidad
    const { data, error } = await supabase
      .from("table_availability")
      .upsert({
        table_id: tableId,
        event_id: eventId,
        is_available: isAvailable ?? true,
        custom_price: customPrice,
        custom_min_consumption: customMinConsumption,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[id]/tables
 * Marca una mesa como no disponible para un evento (soft delete)
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await context.params;

  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get("tableId");

    if (!tableId) {
      return NextResponse.json(
        { error: "tableId es requerido" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Soft delete
    const { error } = await supabase
      .from("table_availability")
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("table_id", tableId)
      .eq("event_id", eventId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
