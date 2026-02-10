import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import LogoUploader from "./components/LogoUploader";
import { AdminHeader, AdminPage, AdminPanel } from "@/components/admin/PageScaffold";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getBrand() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await supabase.from("brand_settings").select("logo_url").eq("id", 1).maybeSingle();
  return data || { logo_url: "" };
}

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const brand = await getBrand();
  if (!brand) return notFound();

  return (
    <AdminPage maxWidth="6xl">
      <AdminHeader
        kicker="Configuración / Branding"
        title="Logo"
        description="Actualiza la identidad visual del backoffice y landing."
        actions={
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Volver
          </Link>
        }
      />
      <AdminPanel contentClassName="p-6">
        <LogoUploader initialUrl={brand.logo_url || ""} />
      </AdminPanel>
    </AdminPage>
  );
}
