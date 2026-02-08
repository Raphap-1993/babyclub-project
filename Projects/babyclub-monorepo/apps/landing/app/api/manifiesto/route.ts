import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ url: "/manifiesto.png", error: "Missing Supabase config" }, { status: 500 });
  }

  if (!code) {
    return NextResponse.json({ url: "/manifiesto.png", error: "Código vacío" }, { status: 400 });
  }

  const headers = {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
  };

  // Validar código en BD
  const codeRes = await fetch(
    `${supabaseUrl}/rest/v1/codes?select=event_id,is_active&code=eq.${encodeURIComponent(code)}&limit=1`,
    { headers }
  );
  const codeData = await codeRes.json().catch(() => []);
  const eventId = codeData?.[0]?.event_id;
  const isActive = codeData?.[0]?.is_active;

  if (!codeRes.ok || !eventId || isActive === false) {
    return NextResponse.json(
      { error: "Tu código intenta seducir al sistema… pero no logra abrirle las puertas. No es válido." },
      { status: 404 }
    );
  }

  const eventRes = await fetch(
    `${supabaseUrl}/rest/v1/events?select=header_image,id&id=eq.${encodeURIComponent(eventId)}&limit=1`,
    { headers }
  );
  if (!eventRes.ok) {
    return NextResponse.json(
      { error: "Tu código intenta seducir al sistema… pero no logra abrirle las puertas. No es válido." },
      { status: 404 }
    );
  }
  const eventData = await eventRes.json().catch(() => []);
  const url = eventData?.[0]?.header_image;

  let cover_url: string | null = null;
  const coverRes = await fetch(
    `${supabaseUrl}/rest/v1/event_messages?select=value_text&event_id=eq.${encodeURIComponent(
      eventId
    )}&key=eq.cover_image&limit=1`,
    { headers }
  );
  if (coverRes.ok) {
    const coverData = await coverRes.json().catch(() => []);
    cover_url = coverData?.[0]?.value_text || null;
  }

  return NextResponse.json({ url: url || "/manifiesto.png", cover_url });
}
