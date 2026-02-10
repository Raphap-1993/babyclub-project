import { NextResponse } from "next/server";
import { getQrSummaryAll } from "@repo/api-logic/qr-summary";

// GET /api/qr-summary-all
export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 });
  }
  try {
    const summaries = await getQrSummaryAll({ supabaseUrl, supabaseKey });
    return NextResponse.json({ events: summaries });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
  }
}
