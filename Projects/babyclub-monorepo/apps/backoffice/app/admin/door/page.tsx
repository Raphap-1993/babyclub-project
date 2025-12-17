import { createClient } from "@supabase/supabase-js";
import ScanClient from "../scan/ScanClient";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Option = { id: string; name: string };

async function getEvents(): Promise<Option[]> {
  if (!supabaseUrl || !supabaseServiceKey) return [];
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await supabase
    .from("events")
    .select("id,name,starts_at")
    .order("starts_at", { ascending: false })
    .limit(200);
  return (data as any[])?.map((ev) => ({ id: ev.id, name: ev.name })) || [];
}

export const dynamic = "force-dynamic";

export default async function DoorPage() {
  const events = await getEvents();
  return <ScanClient events={events} simpleMode />;
}
