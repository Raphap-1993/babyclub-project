import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = "event-assets";

export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Supabase config missing:", { supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey });
    return NextResponse.json({ success: false, error: "Configuración de Supabase incompleta" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Archivo requerido" }, { status: 400 });
  }
  
  console.log("Uploading layout image:", { name: file.name, type: file.type, size: file.size });
  
  const rawName = file.name || "layout";
  const cleaned = rawName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const safeName = cleaned || "layout";
  const path = `layouts/${Date.now()}-${safeName}`;
  const contentType = file.type || "application/octet-stream";
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log("Uploading to Supabase Storage:", { bucket, path, contentType, size: buffer.length });

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) {
    console.error("Supabase upload error:", uploadError);
    return NextResponse.json({ 
      success: false, 
      error: `Error de almacenamiento: ${uploadError.message}` 
    }, { status: 500 });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  
  if (!data.publicUrl) {
    console.error("No public URL returned from Supabase");
    return NextResponse.json({ success: false, error: "No se pudo obtener URL pública" }, { status: 500 });
  }
  
  console.log("Upload successful:", data.publicUrl);
  return NextResponse.json({ success: true, url: data.publicUrl });
}
