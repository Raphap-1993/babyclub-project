import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = "event-assets";
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const form = await req.formData();
  const file = form.get("file");
  const code = String(form.get("code") || "").trim() || "manifiesto";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Archivo requerido" }, { status: 400 });
  }

  const contentType = file.type || "application/octet-stream";
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json({ success: false, error: "Tipo de archivo no permitido" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = file.name?.split(".").pop() || mimeToExt(contentType) || "png";
  const safeCode = code.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "manifiesto";
  const path = `manifiestos/${safeCode}-${Date.now()}.${ext}`;

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

function mimeToExt(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "";
}
