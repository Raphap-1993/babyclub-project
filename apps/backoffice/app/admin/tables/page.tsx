import TablesClient from "./TablesClient";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TableRow = {
  id: string;
  name: string;
  ticket_count: number | null;
  min_consumption: number | null;
  price: number | null;
  is_active: boolean | null;
  notes: string | null;
  reserved: boolean;
};

async function getTables(params: { page: number; pageSize: number }): Promise<{ tables: TableRow[]; total: number; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey) return { tables: [], total: 0, error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const start = (params.page - 1) * params.pageSize;
  const end = start + params.pageSize - 1;
  const { data, error, count } = await applyNotDeleted(
    supabase
      .from("tables")
      .select("id,name,ticket_count,min_consumption,price,is_active,notes", { count: "exact" })
      .order("created_at", { ascending: true })
      .range(start, end)
  );

  const activeStatuses = ["pending", "approved", "confirmed", "paid"];
  const { data: resData } = await applyNotDeleted(
    supabase.from("table_reservations").select("table_id,status").in("status", activeStatuses)
  );
  const reservedSet = new Set<string>((resData || []).map((r: any) => r.table_id).filter(Boolean));

  if (error || !data) return { tables: [], total: 0, error: error?.message || "No se pudieron cargar mesas" };
  const normalized: TableRow[] = (data as any[]).map((t) => {
    return {
      id: t.id,
      name: t.name ?? "",
      ticket_count: t.ticket_count ?? null,
      min_consumption: t.min_consumption ?? null,
      price: t.price ?? null,
      is_active: t.is_active ?? null,
      notes: t.notes ?? null,
      reserved: reservedSet.has(t.id),
    };
  });
  return { tables: normalized, total: count ?? data.length };
}

export const dynamic = "force-dynamic";

export default async function TablesPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const page = Math.max(1, parseInt((searchParams?.page as string) || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt((searchParams?.pageSize as string) || "10", 10) || 10));

  const { tables, total, error } = await getTables({ page, pageSize });
  if (!tables && error) return notFound();

  return <TablesClient tables={tables} error={error || null} pagination={{ page, pageSize }} total={total} />;
}
