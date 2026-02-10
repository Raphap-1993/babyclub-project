import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/qr-summary-all
export async function GET() {
  // 1. Obtener todos los eventos activos (ajusta la lógica según tu modelo)
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, name, date, status")
    .eq("status", "active");

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  // 2. Para cada evento, contar QRs por tipo
  const summaries = await Promise.all(
    events.map(async (event) => {
      // Agrupar por tipo de ticket (ajusta el campo 'type' según tu modelo)
      const { data, error } = await supabase
        .from("tickets")
        .select("type", { count: "exact" })
        .eq("event_id", event.id);

      if (error) {
        return { event_id: event.id, error: error.message };
      }

      // Agrupar y contar por tipo
      const by_type = {};
      (data || []).forEach((row) => {
        const type = row.type || "desconocido";
        by_type[type] = (by_type[type] || 0) + 1;
      });

      return {
        event_id: event.id,
        name: event.name,
        date: event.date,
        total_qr: data ? data.length : 0,
        by_type,
      };
    })
  );

  return NextResponse.json({ events: summaries });
}
