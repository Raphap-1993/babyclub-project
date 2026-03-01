import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AsistenciaPage() {
  redirect("/admin/reportes/mesas?report=event_attendance");
}
