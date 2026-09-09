import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function IngresosPage() {
  redirect("/admin/reportes/mesas?report=event_sales");
}
