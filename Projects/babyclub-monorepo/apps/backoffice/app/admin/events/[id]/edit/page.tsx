// apps/backoffice/app/admin/events/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import EventForm from "../../components/EventForm";
import Link from "next/link";

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
};

async function getEvent(id: string): Promise<EventRow | null> {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("events")
    .select("id,name,location,starts_at,entry_limit,capacity,header_image,is_active")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const { data: coverRow } = await supabase
    .from("event_messages")
    .select("value_text")
    .eq("event_id", id)
    .eq("key", "cover_image")
    .maybeSingle();

  const { data: codes } = await supabase
    .from("codes")
    .select("id,code")
    .eq("event_id", id)
    .eq("type", "general")
    .eq("is_active", true)
    .maybeSingle();

  const code = codes?.code || "";
  const cover_image = coverRow?.value_text || "";

  return { ...(data as EventRow), code, cover_image };
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white lg:px-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Editar</p>
            <h1 className="text-3xl font-semibold">Evento no encontrado</h1>
          </div>
          <Link
            href="/admin/events"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white lg:px-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Editar</p>
          <h1 className="text-3xl font-semibold">Editar evento</h1>
        </div>
        <Link
          href="/admin/events"
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
        >
          ← Volver
        </Link>
      </div>
      <EventForm mode="edit" initialData={event} />
    </main>
  );
}

export const dynamic = "force-dynamic";
