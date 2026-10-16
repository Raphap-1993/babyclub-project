import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { ADMIN_ROLES } from "shared/auth/roles";
import { readMercadoPagoSalesControl } from "shared/payments/mercadopagoSalesControl";
import {
  LOCAL_PAYMENT_PANEL_URL,
  LOCAL_PAYMENT_TEST_URL,
  mercadoPagoAdminDeployment,
  readMercadoPagoRuntime,
} from "@/lib/mercadopagoAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const database = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

export async function GET(request: Request) {
  const guard = await requireStaffRole(request, ADMIN_ROLES);
  if (!guard.ok) return reply({ error: guard.error }, guard.status);
  try {
    const deployment = mercadoPagoAdminDeployment();
    const db = database();
    const [control, provider, audit] = await Promise.all([
      readMercadoPagoSalesControl(db),
      readMercadoPagoRuntime(deployment.landingUrl, deployment.environment),
      db
        .from("mp_sales_control_audit")
        .select("id,paused,version,created_at,staff_id")
        .order("id", { ascending: false })
        .limit(10),
    ]);
    if (audit.error) throw new Error("audit_unavailable");
    return reply({
      success: true,
      environment: deployment.environment,
      control,
      provider,
      history: audit.data || [],
      testUrl: LOCAL_PAYMENT_TEST_URL,
      testPanelUrl: LOCAL_PAYMENT_PANEL_URL,
    });
  } catch {
    return reply(
      {
        error:
          "No se pudo consultar Mercado Pago. Comprueba la conexión y vuelve a intentar.",
      },
      503,
    );
  }
}

export async function PATCH(request: Request) {
  const guard = await requireStaffRole(request, ADMIN_ROLES);
  if (!guard.ok) return reply({ error: guard.error }, guard.status);
  try {
    mercadoPagoAdminDeployment();
  } catch {
    return reply({ error: "Este entorno no puede modificar las ventas." }, 403);
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Solicitud inválida" }, 400);
  }
  if (
    !body ||
    typeof body.paused !== "boolean" ||
    !Number.isSafeInteger(body.version) ||
    body.version < 0 ||
    Object.keys(body).some((key) => !["paused", "version"].includes(key))
  ) {
    return reply(
      { error: "Indica el estado y la versión vigente de las ventas." },
      400,
    );
  }
  try {
    const { data, error } = await database().rpc("mp_set_sales_paused", {
      p_paused: body.paused,
      p_version: body.version,
      p_staff: guard.context.staffId,
    });
    if (error) {
      if (error.message?.includes("sales_control_conflict"))
        return reply(
          {
            error:
              "Otro administrador cambió el estado. Actualiza el panel antes de continuar.",
          },
          409,
        );
      if (error.message?.includes("sales_control_forbidden"))
        return reply(
          { error: "Solo un administrador activo puede cambiar las ventas." },
          403,
        );
      return reply(
        { error: "No se pudo cambiar el estado de las ventas." },
        503,
      );
    }
    return reply({ success: true, control: data });
  } catch {
    return reply({ error: "No se pudo cambiar el estado de las ventas." }, 503);
  }
}
