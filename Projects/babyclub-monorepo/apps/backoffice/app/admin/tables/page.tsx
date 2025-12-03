import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import TableActions from "./components/TableActions";

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
  event: { name: string };
};

async function getTables(): Promise<{ tables: TableRow[]; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey) return { tables: [], error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("tables")
    .select("id,name,ticket_count,min_consumption,price,is_active,notes,event:events(name)")
    .order("created_at", { ascending: true });

  if (error || !data) return { tables: [], error: error?.message || "No se pudieron cargar mesas" };
  return { tables: data as TableRow[] };
}

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const { tables, error } = await getTables();
  if (!tables && error) return notFound();

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Mesas</p>
          <h1 className="text-3xl font-semibold">Listado de mesas</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
          <Link
            href="/admin/tables/create"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)]"
          >
            Crear mesa
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Evento</th>
              <th className="px-4 py-3 text-left">Tickets</th>
              <th className="px-4 py-3 text-left">Consumo mín</th>
              <th className="px-4 py-3 text-left">Precio</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tables.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-white/60">
                  {error ? `Error: ${error}` : "No hay mesas aún."}
                </td>
              </tr>
            )}
            {tables.map((table) => (
              <tr key={table.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-semibold text-white">
                  <div>{table.name}</div>
                  {table.notes && <div className="text-xs text-white/60">{table.notes}</div>}
                </td>
                <td className="px-4 py-3 text-white/80">{table.event?.name || "—"}</td>
                <td className="px-4 py-3 text-white/80">{table.ticket_count ?? "—"}</td>
                <td className="px-4 py-3 text-white/80">
                  {table.min_consumption != null ? `S/ ${table.min_consumption}` : "—"}
                </td>
                <td className="px-4 py-3 text-white/80">{table.price != null ? `S/ ${table.price}` : "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                      table.is_active ? "bg-[#e91e63]/15 text-[#e91e63]" : "bg-white/5 text-white/70"
                    }`}
                  >
                    {table.is_active ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <TableActions id={table.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
