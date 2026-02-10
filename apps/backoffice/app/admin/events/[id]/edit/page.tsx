// apps/backoffice/app/admin/events/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import EventForm from "../../components/EventForm";
import Link from "next/link";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type EventRow = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  header_image: string;
  cover_image?: string;
  is_active: boolean;
  starts_at: string;
  entry_limit?: string | null;
  code?: string;
  organizer_id?: string;
};

async function getEvent(id: string): Promise<EventRow | null> {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const eventQuery = applyNotDeleted(
    supabase.from("events").select("id,name,location,starts_at,entry_limit,capacity,header_image,is_active,organizer_id").eq("id", id)
  );
  const { data, error } = await eventQuery.maybeSingle();

  if (error || !data) return null;

  const { data: coverRow } = await supabase
    .from("event_messages")
    .select("value_text")
    .eq("event_id", id)
    .eq("key", "cover_image")
    .maybeSingle();

  const codeQuery = applyNotDeleted(
    supabase.from("codes").select("id,code").eq("event_id", id).eq("type", "general").eq("is_active", true)
  );
  const { data: codes } = await codeQuery.maybeSingle();

  const code = codes?.code || "";
  const cover_image = coverRow?.value_text || "";

  return { ...(data as EventRow), code, cover_image };
}

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

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, organizers] = await Promise.all([getEvent(id), getOrganizers()]);
  if (!event || organizers.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">EDITAR</p>
              <h1 className="text-2xl font-semibold text-white">Evento no encontrado</h1>
            </div>
            <Link
              href="/admin/events"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
            >
              ← Volver
            </Link>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
            <div className="text-slate-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No se pudo encontrar el evento</h3>
            <p className="text-slate-400">El evento que intentas editar no existe o ha sido eliminado.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400 mb-1">EDITAR</p>
            <h1 className="text-2xl font-semibold text-white">Editar evento</h1>
          </div>
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
          >
            ← Volver
          </Link>
        </div>
        <EventForm mode="edit" initialData={event} organizers={organizers} />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
