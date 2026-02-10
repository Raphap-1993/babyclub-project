import { redirect } from "next/navigation";

/**
 * DEPRECADO: Este menú ya no se usa para gestionar mesas.
 * 
 * NUEVO FLUJO (desde 2026-02-08):
 * - Ir a /admin/organizers
 * - Seleccionar organizador
 * - Click en "🪑 Gestionar Mesas"
 * 
 * RAZÓN: Cada organizador gestiona su propio inventario de mesas.
 * Ya no hay gestión global centralizada.
 */
export default function TablesPage() {
  redirect('/admin/organizers');
}
