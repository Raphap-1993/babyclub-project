import ModernReservationsClient from "./ModernReservationsClient";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ReservationRow = {
  id: string;
  friendly_code?: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  codes: string[] | null;
  ticket_quantity: number | null;
  table_name: string;
  event_name: string;
  organizer_name: string;
  organizer_id: string;
  created_at?: string;
};

const RETRYABLE_SUPABASE_ERROR = /(error code 522|connection timed out|gateway timeout|service unavailable|fetch failed|network|temporarily unavailable)/i;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizeErrorMessage(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return "Error inesperado al consultar Supabase";

  if (/<(!doctype|html)/i.test(normalized)) {
    const cloudflareCode = normalized.match(/error code\s+(\d{3})/i)?.[1];
    if (cloudflareCode) return `Supabase no respondió a tiempo (Cloudflare ${cloudflareCode})`;
    return "Supabase devolvió una respuesta HTML inesperada";
  }

  return normalized.length > 220 ? `${normalized.slice(0, 220)}...` : normalized;
}

function isRetryableSupabaseError(input: unknown): boolean {
  const raw = typeof input === "string" ? input : "";
  return RETRYABLE_SUPABASE_ERROR.test(raw);
}

function getUserFacingError(input: unknown): string {
  if (isRetryableSupabaseError(input)) {
    return "No se pudieron cargar reservas por un timeout temporal de Supabase. Reintenta en unos segundos.";
  }
  return sanitizeErrorMessage(input);
}

async function getReservations(): Promise<{ reservations: ReservationRow[]; error?: string }> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) return { reservations: [], error: "Falta configuración de Supabase" };
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const maxAttempts = 2;
    let data: any[] | null = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await applyNotDeleted(
        supabase
          .from("table_reservations")
          .select(`
            id,
            friendly_code,
            full_name,
            email,
            phone,
            status,
            codes,
            ticket_quantity,
            created_at,
            table_id,
            event_id
          `)
          .order("created_at", { ascending: false })
      );

      if (!result.error) {
        data = result.data as any[] | null;
        lastError = null;
        break;
      }

      lastError = result.error;
      const rawMessage = result.error?.message;
      const retryable = isRetryableSupabaseError(rawMessage);
      const willRetry = retryable && attempt < maxAttempts;

      console.error("[admin/reservations] fetch failed", {
        attempt,
        maxAttempts,
        retryable,
        willRetry,
        message: sanitizeErrorMessage(rawMessage),
        code: result.error?.code,
      });

      if (willRetry) {
        await delay(350 * attempt);
        continue;
      }
    }

    if (lastError) {
      return { reservations: [], error: getUserFacingError(lastError?.message) };
    }
    
    if (!data || data.length === 0) {
      return { reservations: [] };
    }

    // Obtener tablas, eventos y organizadores por separado
    const tableIds = [...new Set(data.map((r: any) => r.table_id).filter(Boolean))];
    const eventIds = [...new Set(data.map((r: any) => r.event_id).filter(Boolean))];
    
    const { data: tables } = tableIds.length > 0 
      ? await supabase.from("tables").select("id, name").in("id", tableIds)
      : { data: [] };
      
    const { data: events } = eventIds.length > 0
      ? await supabase.from("events").select("id, name, organizer_id").in("id", eventIds)
      : { data: [] };
      
    const organizerIds = [...new Set(events?.map((e: any) => e.organizer_id).filter(Boolean) || [])];
    
    const { data: organizers } = organizerIds.length > 0
      ? await supabase.from("organizers").select("id, name").in("id", organizerIds)
      : { data: [] };

    // Crear mapas para búsqueda rápida
    const tableMap = new Map(tables?.map((t: any) => [t.id, t]) || []);
    const eventMap = new Map(events?.map((e: any) => [e.id, e]) || []);
    const organizerMap = new Map(organizers?.map((o: any) => [o.id, o]) || []);

    const normalized: ReservationRow[] = (data as any[]).map((res) => {
      const table = tableMap.get(res.table_id);
      const event = eventMap.get(res.event_id);
      const organizer = event?.organizer_id ? organizerMap.get(event.organizer_id) : null;
      
      return {
        id: res.id,
        friendly_code: res.friendly_code ?? null,
        full_name: res.full_name ?? "",
        email: res.email ?? null,
        phone: res.phone ?? null,
        status: res.status ?? "",
        codes: res.codes ?? null,
        ticket_quantity: typeof res.ticket_quantity === "number" ? res.ticket_quantity : null,
        table_name: table?.name ?? "Entrada",
        event_name: event?.name ?? "—",
        organizer_name: organizer?.name ?? "Sin organizador",
        organizer_id: organizer?.id ?? "",
        created_at: res.created_at ?? undefined,
      };
    });

    return { reservations: normalized };
  } catch (err: any) {
    const safeMessage = sanitizeErrorMessage(err?.message || String(err));
    console.error("[admin/reservations] unexpected getReservations error", {
      message: safeMessage,
    });
    return { reservations: [], error: `Error inesperado: ${safeMessage}` };
  }
}

async function getOrganizers(): Promise<{ id: string; name: string }[]> {
  if (!supabaseUrl || !supabaseServiceKey) return [];
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  
  const { data } = await applyNotDeleted(
    supabase
      .from("organizers")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true })
  );
  
  return data || [];
}

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const { reservations, error } = await getReservations();
  const organizers = await getOrganizers();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header consistente */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-sm border-b border-slate-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                📋 Reservas de Mesas
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Gestiona las reservas de mesas por evento y organizador
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-700 text-red-200 p-4 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        <ModernReservationsClient 
          initialReservations={reservations} 
          organizers={organizers}
        />
      </div>
    </div>
  );
}
