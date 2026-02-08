import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PromoterForm from "../../components/PromoterForm";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type PromoterRecord = {
  id?: string;
  person_id?: string;
  first_name: string;
  last_name: string;
  dni: string;
  email: string;
  phone: string;
  code: string;
  instagram?: string | null;
  tiktok?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
};

async function getPromoter(id: string): Promise<PromoterRecord | null> {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("promoters")
    .select("id,person_id,code,instagram,tiktok,notes,is_active, persons(first_name,last_name,dni,email,phone)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const person = (data as any)?.persons || {};
  return {
    id: data.id,
    person_id: data.person_id || undefined,
    first_name: person.first_name || "",
    last_name: person.last_name || "",
    dni: person.dni || "",
    email: person.email || "",
    phone: person.phone || "",
    code: data.code || "",
    instagram: data.instagram || "",
    tiktok: data.tiktok || "",
    notes: data.notes || "",
    is_active: data.is_active,
  };
}

export const dynamic = "force-dynamic";

export default async function EditPromoterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const promoter = await getPromoter(id);
  if (!promoter) return notFound();

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white lg:px-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Promotores</p>
          <h1 className="text-3xl font-semibold">Editar promotor</h1>
        </div>
        <Link
          href="/admin/promoters"
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
        >
          ← Volver
        </Link>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#0c0c0c] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <PromoterForm mode="edit" initialData={promoter} />
      </div>
    </main>
  );
}
