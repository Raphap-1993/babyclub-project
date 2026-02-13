import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import {
  createSupabaseFetchWithTimeout,
  getUserFacingSupabaseError,
  isRetryableSupabaseError,
  sanitizeSupabaseErrorMessage,
} from "@/lib/supabaseErrors";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS || 9000);
const SUPABASE_RETRY_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 250;

type OrganizerRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  events_count?: number;
  tables_count?: number;
  created_at?: string;
};

type OrganizerCounterRow = {
  organizer_id: string | null;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function countByOrganizer(rows: OrganizerCounterRow[] | null): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const row of rows || []) {
    if (!row.organizer_id) continue;
    counters[row.organizer_id] = (counters[row.organizer_id] || 0) + 1;
  }
  return counters;
}

async function runSupabaseQueryWithRetry<T>(
  operation: string,
  query: () => Promise<{ data: T | null; error: any }>,
  userFacingFallback: string
): Promise<{ data: T | null; error?: string }> {
  for (let attempt = 1; attempt <= SUPABASE_RETRY_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await query();
      if (!error) return { data };

      const rawMessage = error?.message || error;
      const retryable = isRetryableSupabaseError(rawMessage);
      const willRetry = retryable && attempt < SUPABASE_RETRY_ATTEMPTS;

      if (retryable) {
        console.warn("[admin/organizers] transient Supabase error", {
          operation,
          attempt,
          maxAttempts: SUPABASE_RETRY_ATTEMPTS,
          willRetry,
          message: sanitizeSupabaseErrorMessage(rawMessage),
        });
      } else {
        console.error("[admin/organizers] Supabase query failed", {
          operation,
          attempt,
          maxAttempts: SUPABASE_RETRY_ATTEMPTS,
          message: sanitizeSupabaseErrorMessage(rawMessage),
        });
      }

      if (willRetry) {
        await delay(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      return {
        data: null,
        error: getUserFacingSupabaseError(rawMessage, userFacingFallback),
      };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      const retryable = isRetryableSupabaseError(rawMessage);
      const willRetry = retryable && attempt < SUPABASE_RETRY_ATTEMPTS;

      if (retryable) {
        console.warn("[admin/organizers] transient Supabase exception", {
          operation,
          attempt,
          maxAttempts: SUPABASE_RETRY_ATTEMPTS,
          willRetry,
          message: sanitizeSupabaseErrorMessage(rawMessage),
        });
      } else {
        console.error("[admin/organizers] unexpected exception", {
          operation,
          attempt,
          maxAttempts: SUPABASE_RETRY_ATTEMPTS,
          message: sanitizeSupabaseErrorMessage(rawMessage),
        });
      }

      if (willRetry) {
        await delay(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      return {
        data: null,
        error: getUserFacingSupabaseError(rawMessage, userFacingFallback),
      };
    }
  }

  return { data: null, error: userFacingFallback };
}

async function getOrganizers(): Promise<{ organizers: OrganizerRow[]; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey)
    return { organizers: [], error: "Falta configuración de Supabase" };

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: createSupabaseFetchWithTimeout(SUPABASE_TIMEOUT_MS) },
  });

  const organizersResult = await runSupabaseQueryWithRetry<OrganizerRow[]>(
    "organizers.list",
    () =>
      applyNotDeleted(
        supabase
          .from("organizers")
          .select("id, slug, name, is_active, sort_order, created_at")
          .order("sort_order", { ascending: true })
      ),
    "No se pudieron cargar organizadores. Reintenta en unos segundos."
  );
  if (organizersResult.error || !organizersResult.data) {
    return { organizers: [], error: organizersResult.error || "No se pudieron cargar organizadores" };
  }

  const [eventsResult, tablesResult] = await Promise.all([
    runSupabaseQueryWithRetry<OrganizerCounterRow[]>(
      "events.organizer_counters",
      () =>
        applyNotDeleted(
          supabase.from("events").select("organizer_id")
        ) as Promise<{ data: OrganizerCounterRow[] | null; error: any }>,
      "No se pudieron cargar los contadores de eventos por organizador."
    ),
    runSupabaseQueryWithRetry<OrganizerCounterRow[]>(
      "tables.organizer_counters",
      () =>
        applyNotDeleted(
          supabase.from("tables").select("organizer_id")
        ) as Promise<{ data: OrganizerCounterRow[] | null; error: any }>,
      "No se pudieron cargar los contadores de mesas por organizador."
    ),
  ]);

  const countersError =
    eventsResult.error ||
    tablesResult.error ||
    undefined;

  const eventsCountByOrganizer = countByOrganizer(eventsResult.data);
  const tablesCountByOrganizer = countByOrganizer(tablesResult.data);

  const organizersWithStats = organizersResult.data.map((org: OrganizerRow) => {
    return {
      ...org,
      events_count: eventsCountByOrganizer[org.id] || 0,
      tables_count: tablesCountByOrganizer[org.id] || 0,
    };
  });

  organizersWithStats.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });

  return { organizers: organizersWithStats, error: countersError };
}

export default async function OrganizersPage() {
  const { organizers, error } = await getOrganizers();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            🏢 Organizadores
          </h1>
          <p className="text-slate-400">
            Cada organizador tiene su propia configuración de mesas y croquis
          </p>
        </div>
        <Link
          href="/admin/organizers/create"
          className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          + Nuevo Organizador
        </Link>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizers.map((org) => (
          <div
            key={org.id}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-all duration-200"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-2xl">
                🏢
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{org.name}</h3>
                <p className="text-sm text-slate-400">{org.slug}</p>
              </div>
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-slate-900/50 rounded-lg px-3 py-2">
                <div className="text-xs text-slate-400">Eventos</div>
                <div className="text-lg font-bold text-white">{org.events_count || 0}</div>
              </div>
              <div className="flex-1 bg-slate-900/50 rounded-lg px-3 py-2">
                <div className="text-xs text-slate-400">Mesas</div>
                <div className="text-lg font-bold text-white">{org.tables_count || 0}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Link
                href={`/admin/organizers/${org.id}/tables`}
                className="block w-full bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white text-center px-4 py-2 rounded-lg transition-all duration-200 font-semibold"
              >
                🪑 Gestionar Mesas
              </Link>
              <Link
                href={`/admin/organizers/${org.id}/layout`}
                className="block w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-center px-4 py-2 rounded-lg transition-all duration-200 font-semibold"
              >
                📐 Diseñar Croquis
              </Link>
              <Link
                href={`/admin/organizers/${org.id}`}
                className="block w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white text-center px-4 py-2 rounded-lg transition-all duration-200 font-semibold"
              >
                ✏️ Editar Organizador
              </Link>
            </div>
          </div>
        ))}
      </div>

      {organizers.length === 0 && !error && (
        <div className="text-center py-12 text-slate-400">
          No hay organizadores configurados
        </div>
      )}
    </div>
  );
}
