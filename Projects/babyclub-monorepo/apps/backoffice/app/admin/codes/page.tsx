import { createClient } from "@supabase/supabase-js";
import CodesClient from "./CodesClient";

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

async function getPromoters(): Promise<Option[]> {
  if (!supabaseUrl || !supabaseServiceKey) return [];
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await supabase.from("promoters").select("id,code").order("created_at", { ascending: true }).limit(500);
  return (data as any[])?.map((p) => ({ id: p.id, name: p.code || "Sin código" })) || [];
}

export const dynamic = "force-dynamic";

export default async function CodesPage() {
  const [events, promoters] = await Promise.all([getEvents(), getPromoters()]);
  return <CodesClient events={events} promoters={promoters} />;
}
