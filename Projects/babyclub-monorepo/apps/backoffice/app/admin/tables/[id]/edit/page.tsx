import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import TableForm from "../../components/TableForm";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getTable(id: string) {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("tables")
    .select("id,name,ticket_count,min_consumption,price,is_active,notes")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export const dynamic = "force-dynamic";

export default async function EditTablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const table = await getTable(id);
  if (!table) return notFound();

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white lg:px-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Mesas</p>
          <h1 className="text-3xl font-semibold">Editar mesa</h1>
        </div>
        <Link
          href="/admin/tables"
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
        >
          ← Volver
        </Link>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <TableForm mode="edit" initialData={table as any} />
      </div>
    </main>
  );
}
