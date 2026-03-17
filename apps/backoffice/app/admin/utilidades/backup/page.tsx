import { AdminPage, AdminHeader } from "@/components/admin/PageScaffold";
import { Database } from "lucide-react";
import BackupClient from "./BackupClient";

export const dynamic = "force-dynamic";

export default function BackupPage() {
  return (
    <AdminPage>
      <AdminHeader
        kicker="Utilidades / Sistema"
        title="Backup de Base de Datos"
        description="Exporta todos los datos del sistema en formato JSON. Solo accesible para administradores."
      />
      <BackupClient />
    </AdminPage>
  );
}
