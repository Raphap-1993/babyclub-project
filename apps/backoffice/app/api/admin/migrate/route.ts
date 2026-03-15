import { NextResponse } from "next/server";

// Este endpoint fue removido por seguridad.
// Las migraciones se aplican via Supabase CLI o dashboard.
// Ver: supabase/migrations/
export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
