import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import {
  readActivePromoter,
  PurchaseAttributionError,
} from "shared/promoterAttribution";
import { buildPermanentPromoterUrl } from "shared/promoterUrl";

// Kept at the existing endpoint for compatibility. Copying a permalink is read-only.
export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok)
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey)
    return NextResponse.json(
      { success: false, error: "Falta configuración de Supabase" },
      { status: 500 },
    );
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON inválido" },
      { status: 400 },
    );
  }
  const promoterId =
    typeof body?.promoter_id === "string" ? body.promoter_id.trim() : "";
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const promoter = await readActivePromoter(supabase, promoterId);
    const url = buildPermanentPromoterUrl(
      promoter.id,
      process.env.NEXT_PUBLIC_LANDING_URL,
    );
    return NextResponse.json({
      success: true,
      promoter_id: promoter.id,
      permanent: true,
      url,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "No pudimos obtener el enlace",
      },
      {
        status: error instanceof PurchaseAttributionError ? error.status : 503,
      },
    );
  }
}
