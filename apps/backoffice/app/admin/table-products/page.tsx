import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import ProductManager from "./ProductManager";
import { applyNotDeleted } from "shared/db/softDelete";
import { Box, Table2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SearchParams = Record<string, string | string[] | undefined>;

type OrganizerOption = { id: string; name: string };
type EventOption = { id: string; name: string; date?: string };
type ProductRow = {
  id: string;
  name: string;
  description?: string | null;
  items?: string[];
  price?: number | null;
  tickets_included?: number | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};
type TableRow = {
  id: string;
  name: string;
  organizer_id?: string | null;
  event_id?: string | null;
  event?: { id?: string | null; name?: string | null } | null;
  products: ProductRow[];
};

async function getData(params?: SearchParams) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      organizers: [] as OrganizerOption[],
      events: [] as EventOption[],
      tables: [] as TableRow[],
      selectedOrganizerId: "",
      selectedEventId: "",
      error: "Falta configuración de Supabase",
    };
  }

  const requestedOrganizerId = typeof params?.organizer_id === "string" ? params.organizer_id : "";
  const requestedEventId = typeof params?.event_id === "string" ? params.event_id : "";

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: organizersRaw, error: organizersError } = await applyNotDeleted(
    supabase.from("organizers").select("id,name").order("name", { ascending: true })
  );

  if (organizersError) {
    return {
      organizers: [] as OrganizerOption[],
      events: [] as EventOption[],
      tables: [] as TableRow[],
      selectedOrganizerId: "",
      selectedEventId: "",
      error: organizersError.message,
    };
  }

  const organizers = ((organizersRaw as any[]) || []).map((organizer) => ({
    id: String(organizer.id),
    name: String(organizer.name || "Organizador sin nombre"),
  }));

  const selectedOrganizerId =
    requestedOrganizerId && organizers.some((organizer) => organizer.id === requestedOrganizerId)
      ? requestedOrganizerId
      : organizers[0]?.id || "";

  let events: EventOption[] = [];
  if (selectedOrganizerId) {
    const { data: eventsRaw, error: eventsError } = await applyNotDeleted(
      supabase
        .from("events")
        .select("id,name,starts_at,is_active,force_closed")
        .eq("organizer_id", selectedOrganizerId)
        .order("starts_at", { ascending: false })
    );

    if (eventsError) {
      return {
        organizers,
        events: [] as EventOption[],
        tables: [] as TableRow[],
        selectedOrganizerId,
        selectedEventId: "",
        error: eventsError.message,
      };
    }

    events = ((eventsRaw as any[]) || [])
      .filter((event) => event?.is_active !== false && event?.force_closed !== true)
      .map((event) => ({
        id: String(event.id),
        name: String(event.name || "Evento sin nombre"),
        date: event?.starts_at ? new Date(event.starts_at).toLocaleDateString("es-PE") : "",
      }));
  }

  const selectedEventId =
    requestedEventId && events.some((event) => event.id === requestedEventId)
      ? requestedEventId
      : events[0]?.id || "";

  if (!selectedOrganizerId) {
    return {
      organizers,
      events,
      tables: [] as TableRow[],
      selectedOrganizerId,
      selectedEventId,
    };
  }

  const { data: tablesRaw, error: tablesError } = await applyNotDeleted(
    supabase
      .from("tables")
      .select(
        "id,name,event_id,organizer_id,event:events(id,name),products:table_products(id,name,description,items,price,tickets_included,is_active,sort_order,deleted_at)"
      )
      .eq("organizer_id", selectedOrganizerId)
      .order("name", { ascending: true })
  );

  if (tablesError) {
    return {
      organizers,
      events,
      tables: [] as TableRow[],
      selectedOrganizerId,
      selectedEventId,
      error: tablesError.message,
    };
  }

  let tables = ((tablesRaw as any[]) || []).map((table) => ({
    id: table.id,
    name: table.name,
    organizer_id: table.organizer_id,
    event_id: table.event_id,
    event: Array.isArray(table.event) ? table.event?.[0] : table.event,
    products: (table.products || [])
      .filter((product: any) => !product?.deleted_at)
      .map((product: any) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        items: product.items || [],
        price: product.price,
        tickets_included: product.tickets_included,
        is_active: product.is_active,
        sort_order: product.sort_order,
      }))
      .sort((a: any, b: any) => {
        const orderA = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : 0;
        const orderB = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : 0;
        if (orderA !== orderB) return orderA - orderB;
        return String(a?.name || "").localeCompare(String(b?.name || ""), "es", { sensitivity: "base" });
      }),
  })) as TableRow[];

  if (selectedEventId) {
    tables = tables.filter((table) => !table.event_id || table.event_id === selectedEventId);
  }

  return {
    organizers,
    events,
    tables,
    selectedOrganizerId,
    selectedEventId,
  };
}

export const dynamic = "force-dynamic";

export default async function TableProductsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { organizers, events, tables, selectedOrganizerId, selectedEventId, error } = await getData(params);

  return (
    <main className="relative overflow-hidden px-3 py-4 text-white sm:px-5 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_16%,rgba(166,12,47,0.10),transparent_32%),radial-gradient(circle_at_84%_0%,rgba(255,255,255,0.09),transparent_30%),radial-gradient(circle_at_50%_108%,rgba(255,255,255,0.06),transparent_42%)]" />

      <div className="mx-auto w-full max-w-7xl space-y-3">
        <Card className="border-[#2b2b2b] bg-[#111111]">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardDescription className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                  Operaciones / Productos de mesa
                </CardDescription>
                <CardTitle className="mt-2 text-3xl">Gestión de Productos de Mesa</CardTitle>
                <p className="mt-2 text-sm text-white/60">
                  Flujo ordenado por organizador: selecciona organizador, evento y mesa antes de editar combos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Volver
                </Link>
                <Link href="/admin/tables" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  <Table2 className="h-4 w-4" />
                  Mesas
                </Link>
                <Link href="/admin/tables/layout" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  <Box className="h-4 w-4" />
                  Plano
                </Link>
              </div>
            </div>
          </CardHeader>
        </Card>

        <ProductManager
          organizers={organizers}
          events={events}
          tables={tables}
          selectedOrganizerId={selectedOrganizerId}
          selectedEventId={selectedEventId}
          error={error}
        />
      </div>
    </main>
  );
}
