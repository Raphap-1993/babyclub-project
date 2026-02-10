import Link from "next/link";
import EventForm from "../components/EventForm";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getOrganizers() {
  if (!supabaseUrl || !supabaseServiceKey) return [];
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await supabase
    .from("organizers")
    .select("id,name,slug")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  return data || [];
}

export const dynamic = "force-dynamic";

export default async function CreateEventPage() {
  const organizers = await getOrganizers();
  if (organizers.length === 0) return notFound();

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400 mb-1">CREAR</p>
            <h1 className="text-2xl font-semibold text-white">Nuevo evento</h1>
          </div>
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
          >
            ← Volver
          </Link>
        </div>
        <EventForm mode="create" organizers={organizers} />
      </div>
    </div>
  );
}
