import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseRateLimitEnv, rateLimit, rateLimitHeaders } from "shared/security/rateLimit";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = "event-assets";
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_VOUCHER_PER_MIN = parseRateLimitEnv(process.env.RATE_LIMIT_UPLOADS_VOUCHER_PER_MIN, 10);

export async function POST(req: Request) {
  const limiter = rateLimit(req, {
    keyPrefix: "landing:uploads:voucher",
    limit: RATE_LIMIT_VOUCHER_PER_MIN,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { success: false, error: "rate_limited", retryAfterMs: limiter.resetMs },
      { status: 429, headers: rateLimitHeaders(limiter) }
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const form = await req.formData();
  const file = form.get("file");
  const tableName = String(form.get("tableName") || "voucher");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Archivo requerido" }, { status: 400 });
  }

  const contentType = file.type || "application/octet-stream";
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json({ success: false, error: "Tipo de archivo no permitido" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = file.name?.split(".").pop() || "png";
  const path = `vouchers/${tableName}-${Date.now()}.${ext}`;

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
