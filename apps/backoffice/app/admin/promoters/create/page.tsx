import Link from "next/link";
import PromoterForm from "../components/PromoterForm";
import { AdminHeader, AdminPage, AdminPanel } from "@/components/admin/PageScaffold";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function CreatePromoterPage() {
  return (
    <AdminPage>
      <AdminHeader
        kicker="Operaciones / Promotores"
        title="Crear promotor"
        description="Registra datos personales, código y metadatos comerciales."
        actions={
          <Link href="/admin/promoters" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Volver
          </Link>
        }
      />
      <AdminPanel contentClassName="p-6">
        <PromoterForm mode="create" />
      </AdminPanel>
    </AdminPage>
  );
}
