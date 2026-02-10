import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import OrganizerTablesClient from "./OrganizerTablesClient";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TableRow = {
  id: string;
  name: string;
  ticket_count: number | null;
  min_consumption: number | null;
  price: number | null;
  is_active: boolean | null;
  notes: string | null;
};

async function getOrganizer(id: string) {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("organizers")
    .select("id, name, slug, logo_url")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return data;
}

async function getTables(organizerId: string) {
  if (!supabaseUrl || !supabaseServiceKey) return [];

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("tables")
    .select("id, name, ticket_count, min_consumption, price, is_active, notes")
    .eq("organizer_id", organizerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data;
}

export default async function OrganizerTablesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organizer = await getOrganizer(id);

  if (!organizer) return notFound();

  const tables = await getTables(id);

  return <OrganizerTablesClient organizer={organizer} tables={tables} />;
}
