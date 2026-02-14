import { createClient } from "@supabase/supabase-js";
import { applyNotDeleted } from "shared/db/softDelete";
import ModernOrganizersClient from "./ModernOrganizersClient";
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

  return <ModernOrganizersClient initialOrganizers={organizers} error={error || null} />;
}
