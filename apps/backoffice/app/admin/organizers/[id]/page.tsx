import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import OrganizerEditClient from "./OrganizerEditClient";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getOrganizer(id: string) {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data } = await supabase
    .from("organizers")
    .select("id, name, slug, sort_order, is_active")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  return data;
}

export default async function EditOrganizerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organizer = await getOrganizer(id);

  if (!organizer) return notFound();

  return <OrganizerEditClient organizer={organizer} />;
}
