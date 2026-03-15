import Link from "next/link";
import { notFound } from "next/navigation";
import { getBranding } from "shared/branding";
import LogoUploader from "./components/LogoUploader";
import { AdminHeader, AdminPage, AdminPanel } from "@/components/admin/PageScaffold";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const brand = await getBranding();
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
