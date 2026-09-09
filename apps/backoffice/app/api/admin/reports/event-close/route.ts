import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { ADMIN_ROLES } from "shared/auth/roles";
import { loadEventClose, loadReportEvents } from "@/lib/reports/loadEventClose";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers });

export async function GET(req: NextRequest) {
  const staff = await requireStaffRole(req, ADMIN_ROLES);
  if (!staff.ok) return json({ error: staff.error }, staff.status);
  const eventId = req.nextUrl.searchParams.get("event_id");
  if (
    eventId !== null &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      eventId,
    )
  ) {
    return json({ error: "Selecciona un evento válido." }, 400);
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return json({ error: "El servicio de reportes no está configurado." }, 503);
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    if (!eventId) return json({ events: await loadReportEvents(client) });
    const report = await loadEventClose(client, eventId);
    return report
      ? json({ report })
      : json({ error: "El evento no existe o fue eliminado." }, 404);
  } catch {
    return json(
      {
        error:
          "No se pudo completar el cierre. Vuelve a intentarlo; no se mostrarán cifras parciales.",
      },
      502,
    );
  }
}
