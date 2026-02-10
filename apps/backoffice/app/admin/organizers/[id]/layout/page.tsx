import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import OrganizerLayoutClient from "./OrganizerLayoutClient";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getOrganizerWithLayout(organizerId: string) {
  console.log("=== LAYOUT PAGE SERVER: START ===");
  console.log("organizerId received:", organizerId, "type:", typeof organizerId);
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Supabase config missing!");
    return null;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Fetching organizer...");
  const { data: organizer, error: orgError } = await supabase
    .from("organizers")
    .select("id, name, slug, layout_url")
    .eq("id", organizerId)
    .is("deleted_at", null)
    .single();

  console.log("Organizer result:", { organizer, orgError });

  if (!organizer) {
    console.error("Organizer not found or has error");
    return null;
  }

  // Obtener todas las mesas del organizador para el diseñador
  console.log("Fetching tables for organizer_id:", organizerId);
  const { data: tables, error: tablesError } = await supabase
    .from("tables")
    .select("id, name, ticket_count, layout_x, layout_y, layout_size")
    .eq("organizer_id", organizerId)
    .is("deleted_at", null)
    .order("name");

  console.log("Tables query result:", { 
    tablesCount: tables?.length || 0,
    tables: tables?.map(t => ({ 
      id: t.id, 
      name: t.name,
      has_position: t.layout_x !== null && t.layout_y !== null
    })),
    tablesError,
    query: {
      table: "tables",
      filter_organizer_id: organizerId,
      filter_deleted_at: null
    }
  });

  if (tablesError) {
    console.error("Error fetching tables:", tablesError);
  }

  console.log("=== LAYOUT PAGE SERVER: END ===");
  console.log("Returning:", {
    organizerName: organizer.name,
    tablesCount: tables?.length || 0
  });

  return {
    organizer,
    tables: tables || [],
  };
}

export default async function OrganizerLayoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getOrganizerWithLayout(id);
  
  if (!data) return notFound();

  return (
    <OrganizerLayoutClient 
      organizer={data.organizer} 
      tables={data.tables}
    />
  );
}
