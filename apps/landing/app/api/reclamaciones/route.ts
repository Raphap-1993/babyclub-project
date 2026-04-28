import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { getLegalConfig } from "lib/legal";
import { sendEmail } from "shared/email/resend";
import {
  parseRateLimitEnv,
  rateLimit,
  rateLimitHeaders,
} from "shared/security/rateLimit";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_CLAIMS_PER_HOUR = parseRateLimitEnv(
  process.env.RATE_LIMIT_RECLAMACIONES_PER_HOUR,
  6,
);

const allowedClaimTypes = new Set(["reclamo", "queja"]);
const allowedDocTypes = new Set(["dni", "ce", "passport"]);

export async function POST(req: NextRequest) {
  const limiter = rateLimit(req, {
    keyPrefix: "landing:claims-book",
    limit: RATE_LIMIT_CLAIMS_PER_HOUR,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      {
        success: false,
        error: "rate_limited",
        retryAfterMs: limiter.resetMs,
      },
      { status: 429, headers: rateLimitHeaders(limiter) },
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch (_err) {
    return NextResponse.json(
      { success: false, error: "JSON inválido" },
      { status: 400 },
    );
  }

  const payload = normalizeClaimPayload(body);
  const validationError = validateClaimPayload(payload);
  if (validationError) {
    return NextResponse.json(
      { success: false, error: validationError },
      { status: 400 },
    );
  }

  const legal = getLegalConfig();
  const claimCode = makeClaimCode();
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.from("claims_book_entries").insert({
    claim_code: claimCode,
    claim_type: payload.claim_type,
    consumer_name: payload.consumer_name,
    doc_type: payload.doc_type,
    document_number: payload.document_number,
    address: payload.address,
    phone: payload.phone,
    email: payload.email,
    service_description: payload.service_description,
    event_reference: payload.event_reference || null,
    claimed_amount: payload.claimed_amount,
    detail: payload.detail,
    requested_solution: payload.requested_solution,
    provider_trade_name: legal.tradeName,
    provider_legal_name: legal.legalName,
    provider_ruc: legal.ruc,
    provider_address: legal.address,
    provider_phone: legal.phone,
    provider_email: legal.supportEmail,
    source_ip: getIp(req),
    user_agent: req.headers.get("user-agent") || null,
  });

  if (error) {
    return NextResponse.json(
      { success: false, error: "No se pudo registrar la solicitud" },
      { status: 500 },
    );
  }

  let emailWarning: string | undefined;
  try {
    await sendClaimEmails({
      claimCode,
      payload,
      legal,
    });
  } catch (err: any) {
    emailWarning =
      "La solicitud quedó registrada, pero no se pudo enviar la copia por correo. Conserva el código mostrado.";
    console.error("[claims-book] email_error", err?.message || err);
  }

  return NextResponse.json({
    success: true,
    claimCode,
    emailWarning,
  });
}

type ClaimPayload = {
  claim_type: "reclamo" | "queja";
  consumer_name: string;
  doc_type: "dni" | "ce" | "passport";
  document_number: string;
  address: string;
  phone: string;
  email: string;
  service_description: string;
  event_reference: string;
  claimed_amount: number | null;
  detail: string;
  requested_solution: string;
  accepted: boolean;
};

function normalizeClaimPayload(body: any): ClaimPayload {
  const claimType = clean(body?.claim_type).toLowerCase();
  const docType = clean(body?.doc_type).toLowerCase();
  const amountRaw = clean(body?.claimed_amount);
  const amount = amountRaw ? Number(amountRaw) : null;

  return {
    claim_type: (allowedClaimTypes.has(claimType) ? claimType : "reclamo") as
      | "reclamo"
      | "queja",
    consumer_name: clean(body?.consumer_name, 160),
    doc_type: (allowedDocTypes.has(docType) ? docType : "dni") as
      | "dni"
      | "ce"
      | "passport",
    document_number: clean(body?.document_number, 32),
    address: clean(body?.address, 240),
    phone: clean(body?.phone, 40),
    email: clean(body?.email, 160).toLowerCase(),
    service_description: clean(body?.service_description, 240),
    event_reference: clean(body?.event_reference, 160),
    claimed_amount: Number.isFinite(amount) && amount !== null ? amount : null,
    detail: clean(body?.detail, 3000),
    requested_solution: clean(body?.requested_solution, 1200),
    accepted: body?.accepted === true,
  };
}

function validateClaimPayload(payload: ClaimPayload): string | null {
  if (!payload.accepted) return "Debes aceptar la declaración para continuar.";
  if (!allowedClaimTypes.has(payload.claim_type)) {
    return "Tipo de solicitud inválido.";
  }
  if (!allowedDocTypes.has(payload.doc_type)) {
    return "Tipo de documento inválido.";
  }
  const required: Array<[string, string]> = [
    [payload.consumer_name, "Nombres y apellidos"],
    [payload.document_number, "Número de documento"],
    [payload.address, "Domicilio"],
    [payload.phone, "Teléfono"],
    [payload.email, "Correo electrónico"],
    [payload.service_description, "Producto o servicio"],
    [payload.detail, "Detalle"],
    [payload.requested_solution, "Pedido del consumidor"],
  ];
  const missing = required.find(([value]) => !value);
  if (missing) return `${missing[1]} es obligatorio.`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return "Correo electrónico inválido.";
  }
  if (payload.claimed_amount !== null && payload.claimed_amount < 0) {
    return "Monto reclamado inválido.";
  }
  return null;
}

function clean(value: unknown, maxLength = 1000): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function makeClaimCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = randomUUID().slice(0, 8);
  return `BC-${date}-${random.toUpperCase()}`;
}

function getIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

async function sendClaimEmails({
  claimCode,
  payload,
  legal,
}: {
  claimCode: string;
  payload: ClaimPayload;
  legal: ReturnType<typeof getLegalConfig>;
}) {
  const supportTo = legal.claimsEmail || legal.supportEmail;
  const subject = `Libro de Reclamaciones BABY - ${claimCode}`;
  const text = [
    `Código: ${claimCode}`,
    `Tipo: ${payload.claim_type}`,
    `Consumidor: ${payload.consumer_name}`,
    `Documento: ${payload.doc_type.toUpperCase()} ${payload.document_number}`,
    `Correo: ${payload.email}`,
    `Teléfono: ${payload.phone}`,
    `Domicilio: ${payload.address}`,
    `Servicio: ${payload.service_description}`,
    payload.event_reference ? `Evento/reserva: ${payload.event_reference}` : "",
    payload.claimed_amount != null
      ? `Monto reclamado: S/ ${payload.claimed_amount.toFixed(2)}`
      : "",
    `Detalle: ${payload.detail}`,
    `Pedido: ${payload.requested_solution}`,
    "",
    "Plazo máximo de respuesta: 30 días calendario.",
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;background:#050505;color:#f5f5f5;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#0b0b0b;border:1px solid rgba(255,255,255,0.1);border-radius:22px;padding:24px;">
        <p style="margin:0 0 8px;color:#e91e63;text-transform:uppercase;letter-spacing:0.18em;font-size:12px;font-weight:700;">Libro de Reclamaciones</p>
        <h1 style="margin:0 0 16px;font-size:24px;">Código ${escapeHtml(claimCode)}</h1>
        ${[
          ["Tipo", payload.claim_type],
          ["Consumidor", payload.consumer_name],
          [
            "Documento",
            `${payload.doc_type.toUpperCase()} ${payload.document_number}`,
          ],
          ["Correo", payload.email],
          ["Teléfono", payload.phone],
          ["Domicilio", payload.address],
          ["Servicio", payload.service_description],
          ["Evento/reserva", payload.event_reference || "-"],
          [
            "Monto reclamado",
            payload.claimed_amount != null
              ? `S/ ${payload.claimed_amount.toFixed(2)}`
              : "-",
          ],
          ["Detalle", payload.detail],
          ["Pedido", payload.requested_solution],
        ]
          .map(
            ([label, value]) =>
              `<p style="margin:0 0 10px;color:#d6d6d6;line-height:1.5;"><strong style="color:#fff;">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
          )
          .join("")}
        <p style="margin:16px 0 0;color:#bdbdbd;font-size:13px;">Plazo máximo de respuesta: 30 días calendario.</p>
      </div>
    </div>`;

  await sendEmail({
    to: [supportTo, payload.email],
    subject,
    text,
    html,
    replyTo: payload.email,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
