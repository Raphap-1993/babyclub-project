import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PromoterForm from "../../components/PromoterForm";
import { AdminHeader, AdminPage, AdminPanel } from "@/components/admin/PageScaffold";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <AdminPage>
      <AdminHeader
        kicker="Operaciones / Promotores"
        title="Editar promotor"
        description="Actualiza datos de contacto y configuración comercial."
        actions={
          <>
            <Link
              href={`/admin/promoters/${encodeURIComponent(id)}/codes`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Códigos
            </Link>
            <Link href="/admin/promoters" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Volver
            </Link>
          </>
        }
      />
      <AdminPanel contentClassName="p-6">
        <PromoterForm mode="edit" initialData={promoter} />
      </AdminPanel>
    </AdminPage>
  );
}
