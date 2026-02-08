import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import ProductManager from "./ProductManager";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getData() {
  if (!supabaseUrl || !supabaseServiceKey) return { tables: [], error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("tables")
    .select(
      "id,name,event:events(name),products:table_products(id,name,description,items,price,tickets_included,is_active,sort_order)"
    )
    .order("name", { ascending: true });

  if (error || !data) return { tables: [], error: error?.message || "No se pudieron cargar las mesas" };

  const normalized = (data as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    event: Array.isArray(t.event) ? t.event?.[0] : t.event,
    products: (t.products || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      items: p.items || [],
      price: p.price,
      tickets_included: p.tickets_included,
      is_active: p.is_active,
      sort_order: p.sort_order,
    })),
  }));

  return { tables: normalized };
}

export const dynamic = "force-dynamic";

export default async function TableProductsPage() {
  const { tables, error } = await getData();

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Mesas</p>
          <h1 className="text-3xl font-semibold">Productos de mesa</h1>
          <p className="text-sm text-white/60">Configura packs de consumo asociados a cada mesa.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
          <Link
            href="/admin/tables"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            Mesas
          </Link>
        </div>
      </div>

      <ProductManager tables={tables} error={error} />
    </main>
  );
}
