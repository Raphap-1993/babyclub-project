// apps/backoffice/app/admin/events/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import EventForm from "../../components/EventForm";
import Link from "next/link";
import { applyNotDeleted } from "shared/db/softDelete";
import { AdminHeader, AdminPage } from "@/components/admin/PageScaffold";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type EventRow = {
  id: string;
  name: string;
  location: string;
  organizer_id?: string | null;
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

  const eventQuery = applyNotDeleted(
    supabase
      .from("events")
      .select("id,name,location,organizer_id,starts_at,entry_limit,capacity,header_image,is_active")
      .eq("id", id)
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

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) {
    return (
      <AdminPage>
        <AdminHeader
          kicker="Operaciones / Eventos"
          title="Evento no encontrado"
          actions={
            <Link href="/admin/events" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Volver
            </Link>
          }
        />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminHeader
        kicker="Operaciones / Eventos"
        title="Editar evento"
        description="Actualiza los datos del evento y su configuración operativa."
        actions={
          <Link href="/admin/events" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Volver
          </Link>
        }
      />
      <EventForm mode="edit" initialData={event} />
    </AdminPage>
  );
}

export const dynamic = "force-dynamic";
