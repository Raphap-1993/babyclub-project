import { redirect } from 'next/navigation';

export const dynamic = "force-dynamic";

export default function MesasReservasPage() {
  // Redirigir a la página moderna de reservas
  redirect('/admin/reservations');
}
