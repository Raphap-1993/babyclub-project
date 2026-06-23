import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  parseRateLimitEnv,
  rateLimit,
  rateLimitHeaders,
} from "shared/security/rateLimit";
import {
  VOUCHER_ALLOWED_BUCKET_MIME_TYPES,
  VOUCHER_ALLOWED_FILE_TYPES_LABEL,
  VOUCHER_FILE_MAX_SIZE_BYTES,
  getVoucherFileExtension,
  inferVoucherMimeType,
  isAllowedVoucherFile,
} from "shared/voucherFilePolicy";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = "event-assets";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_VOUCHER_PER_MIN = parseRateLimitEnv(
  process.env.RATE_LIMIT_UPLOADS_VOUCHER_PER_MIN,
  10,
);

async function ensureEventAssetsBucket(supabase: any) {
  const { error } = await supabase.storage.getBucket(bucket);
  if (!error) return;

  const message = error.message.toLowerCase();
  const missingBucket =
    message.includes("bucket not found") ||
    message.includes("not found") ||
    message.includes("does not exist");
  if (!missingBucket) {
    throw new Error(error.message);
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: [...VOUCHER_ALLOWED_BUCKET_MIME_TYPES],
  });

  if (
    createError &&
    !createError.message.toLowerCase().includes("already exists")
  ) {
    throw new Error(createError.message);
  }
}

export async function POST(req: Request) {
  const limiter = rateLimit(req, {
    keyPrefix: "landing:uploads:voucher",
    limit: RATE_LIMIT_VOUCHER_PER_MIN,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { success: false, error: "rate_limited", retryAfterMs: limiter.resetMs },
      { status: 429, headers: rateLimitHeaders(limiter) },
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const form = await req.formData();
  const file = form.get("file");
  const tableName = String(form.get("tableName") || "voucher");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Archivo requerido" },
      { status: 400 },
    );
  }

  if (!isAllowedVoucherFile(file)) {
    return NextResponse.json(
      {
        success: false,
        error: `Tipo de archivo no permitido. Usa ${VOUCHER_ALLOWED_FILE_TYPES_LABEL}.`,
      },
      { status: 400 },
    );
  }

  if (file.size > VOUCHER_FILE_MAX_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: "La imagen no debe superar 5MB" },
      { status: 400 },
    );
  }

  const contentType = inferVoucherMimeType(file);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ext = getVoucherFileExtension(file) || "png";
  const path = `vouchers/${tableName}-${Date.now()}.${ext}`;

  try {
    await ensureEventAssetsBucket(supabase);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          err?.message ||
          "No se pudo preparar el almacenamiento de comprobantes",
      },
      { status: 500 },
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType,
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { success: false, error: uploadError.message },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ success: true, url: data.publicUrl });
}
