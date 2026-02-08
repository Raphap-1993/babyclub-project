import LayoutEditor from "./LayoutEditor";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getInitialData() {
  if (!supabaseUrl || !supabaseServiceKey) return { layout_url: null, tables: [] };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [{ data: layoutData }, { data: tablesData }] = await Promise.all([
    supabase.from("layout_settings").select("layout_url").eq("id", 1).maybeSingle(),
    supabase
      .from("tables")
      .select("id,name,pos_x,pos_y,pos_w,pos_h")
      .order("created_at", { ascending: true }),
  ]);
  return {
    layout_url: layoutData?.layout_url || null,
    tables: tablesData || [],
  };
}

export const dynamic = "force-dynamic";

export default async function LayoutPage() {
  const initial = await getInitialData();
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Mesas</p>
          <h1 className="text-3xl font-semibold">Plano de mesas</h1>
          <p className="text-sm text-white/60">Sube el plano y ajusta la posición de cada mesa.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <LayoutEditor initial={initial} />
      </div>
    </main>
  );
}
