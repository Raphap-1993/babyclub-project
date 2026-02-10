import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import EventTablesClient from "./EventTablesClient";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getEventWithTables(eventId: string) {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Obtener evento
  const { data: event } = await supabase
    .from("events")
    .select("id, name, organizer_id, is_active")
    .eq("id", eventId)
    .is("deleted_at", null)
    .single();

  if (!event) return null;

  // Obtener todas las mesas del organizador
  const { data: allTables } = await supabase
    .from("tables")
    .select("id, name, ticket_count, price, min_consumption, is_active")
    .eq("organizer_id", event.organizer_id)
    .is("deleted_at", null)
    .order("name");

  // Obtener disponibilidad para este evento
  const { data: availability } = await supabase
    .from("table_availability")
    .select("*")
    .eq("event_id", eventId)
    .is("deleted_at", null);

  // Map de disponibilidad por table_id
  const availabilityMap = new Map(
    (availability || []).map((a: any) => [a.table_id, a])
  );

  // Combinar datos
  const tables = (allTables || []).map((table: any) => {
    const avail = availabilityMap.get(table.id);
    return {
      ...table,
      availabilityId: avail?.id,
      isAvailable: avail?.is_available ?? false,
      customPrice: avail?.custom_price,
      customMinConsumption: avail?.custom_min_consumption,
      notes: avail?.notes,
    };
  });

  return {
    event,
    tables,
  };
}

export default async function EventTablesPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const data = await getEventWithTables(id);
  
  if (!data) return notFound();

  return <EventTablesClient event={data.event} tables={data.tables} />;
}
