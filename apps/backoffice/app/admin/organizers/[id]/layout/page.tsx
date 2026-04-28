import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeOrganizerLayoutTableRecord,
  readOrganizerLayoutMetadata,
} from "shared/layoutMetadata";
import OrganizerLayoutClient from "./OrganizerLayoutClient";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getOrganizerWithLayout(organizerId: string) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: organizer, error: orgError } = await supabase
    .from("organizers")
    .select("*")
    .eq("id", organizerId)
    .is("deleted_at", null)
    .single();

  if (orgError || !organizer) {
    return null;
  }

  const organizerLayout = readOrganizerLayoutMetadata(organizer);
  const normalizedOrganizer = {
    id: organizer.id,
    name: organizer.name,
    slug: organizer.slug,
    layout_url: organizerLayout.layoutUrl,
    layout_canvas_width: organizerLayout.canvasWidth,
    layout_canvas_height: organizerLayout.canvasHeight,
  };
  const canvasWidth = organizerLayout.canvasWidth ?? 800;
  const canvasHeight = organizerLayout.canvasHeight ?? 600;

  const { data: tables, error: tablesError } = await supabase
    .from("tables")
    .select("*")
    .eq("organizer_id", organizerId)
    .is("deleted_at", null)
    .order("name");

  if (tablesError) {
    console.error("Error fetching tables:", tablesError);
  }

  return {
    organizer: normalizedOrganizer,
    tables:
      (tables || []).map((table) =>
        normalizeOrganizerLayoutTableRecord(table, {
          canvasWidth,
          canvasHeight,
        }),
      ) || [],
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
    <OrganizerLayoutClient organizer={data.organizer} tables={data.tables} />
  );
}
