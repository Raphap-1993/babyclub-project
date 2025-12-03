import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = "event-assets";
const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const form = await req.formData();
  const file = form.get("file");
  const path = (form.get("path") as string) || "branding/logo.png";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Archivo requerido" }, { status: 400 });
  }

  const contentType = file.type || "application/octet-stream";
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json({ success: false, error: "Tipo de archivo no permitido" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    cacheControl: "3600",
    upsert: true,
  });

  if (uploadError) {
    return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ success: true, url: data.publicUrl });
}
