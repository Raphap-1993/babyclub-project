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

async function getData() {
  if (!supabaseUrl || !supabaseServiceKey) return { tables: [], error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await applyNotDeleted(
    supabase
      .from("tables")
      .select(
        "id,name,event:events(name),products:table_products(id,name,description,items,price,tickets_included,is_active,sort_order,deleted_at)"
      )
      .order("name", { ascending: true })
  );

  if (error || !data) return { tables: [], error: error?.message || "No se pudieron cargar las mesas" };

  const normalized = (data as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    event: Array.isArray(t.event) ? t.event?.[0] : t.event,
    products: (t.products || [])
      .filter((p: any) => !p?.deleted_at)
      .map((p: any) => ({
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
                <CardTitle className="mt-2 text-3xl">Table Product Manager</CardTitle>
                <p className="mt-2 text-sm text-white/60">Configura combos, precios y orden operativo de venta por mesa.</p>
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

        <ProductManager tables={tables} error={error} />
      </div>
    </main>
  );
}
