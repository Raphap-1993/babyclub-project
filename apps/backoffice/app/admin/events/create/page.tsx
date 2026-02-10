import Link from "next/link";
import EventForm from "../components/EventForm";
import { AdminHeader, AdminPage } from "@/components/admin/PageScaffold";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function CreateEventPage() {
  return (
    <AdminPage>
      <AdminHeader
        kicker="Operaciones / Eventos"
        title="Nuevo evento"
        description="Crea un evento y configura su manifiesto, capacidad y códigos."
        actions={
          <Link href="/admin/events" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Volver
          </Link>
        }
      />
      <EventForm mode="create" />
    </AdminPage>
  );
}
