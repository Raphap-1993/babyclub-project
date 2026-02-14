import { NextRequest, NextResponse } from "next/server";
import { getPromoterSummaryAll } from "@repo/api-logic/promoter-summary";
import { requireStaffRole } from "shared/auth/requireStaff";

// GET /api/promoter-summary-all
export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 });
  }

  try {
    const summaries = await getPromoterSummaryAll({ supabaseUrl, supabaseKey });
    return NextResponse.json({ events: summaries });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}
