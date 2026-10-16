import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { mercadoPagoDatabase } from "../../../lib/mercadopagoRoute";
import {
  customerHash,
  deviceHash,
  openIdentity,
  sealIdentity,
} from "../../../lib/customerAccessCrypto";
import {
  findCustomerIdentity,
  readCustomerWallet,
} from "../../../lib/customerTickets";
import {
  getClientIp,
  rateLimit,
  rateLimitHeaders,
} from "shared/security/rateLimit";
import { sendEmail } from "shared/email/resend";

export const runtime = "nodejs";
export const maxDuration = 30;
const challengeCookie = "baby_access_challenge";
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "Referrer-Policy": "no-referrer",
};
const respond = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers });
const secure = (req: NextRequest) => new URL(req.url).protocol === "https:";
const cookieName = (req: NextRequest) =>
  secure(req) ? "__Host-baby_access" : "baby_access";
const cookieOptions = (req: NextRequest) => ({
  httpOnly: true,
  secure: secure(req),
  sameSite: "strict" as const,
  path: "/",
});

async function deviceIdentity(req: NextRequest) {
  const token = req.cookies.get(cookieName(req))?.value || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const db = mercadoPagoDatabase();
  const result = await db
    .from("customer_access_devices")
    .select("identity_encrypted")
    .eq("token_hash", deviceHash(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (result.error) throw new Error("Session unavailable");
  if (!result.data) return null;
  try {
    return openIdentity(result.data.identity_encrypted);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const identity = await deviceIdentity(req);
    if (!identity) return respond({ verified: false }, 401);
    return respond({
      verified: true,
      wallet: await readCustomerWallet(mercadoPagoDatabase(), identity),
    });
  } catch {
    return respond(
      { error: "No pudimos cargar tus entradas. Inténtalo de nuevo." },
      503,
    );
  }
}

export async function POST(req: NextRequest) {
  let sameOrigin = false;
  try {
    const origin = new URL(req.headers.get("origin") || "");
    const requestHost = req.headers.get("host") || new URL(req.url).host;
    const localHttp =
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    sameOrigin =
      origin.host === requestHost &&
      (origin.protocol === "https:" || localHttp);
  } catch {
    /* Missing or malformed Origin must fail closed. */
  }
  if (!sameOrigin) return respond({ error: "Solicitud no permitida." }, 403);
  const limit = rateLimit(req, {
    keyPrefix: "customer-access",
    limit: 30,
    windowMs: 900_000,
  });
  if (!limit.ok)
    return NextResponse.json(
      { error: "Espera unos minutos para volver a intentarlo." },
      { status: 429, headers: { ...headers, ...rateLimitHeaders(limit) } },
    );
  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > 1024) throw new Error("body");
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("body");
  } catch {
    return respond({ error: "Solicitud inválida." }, 400);
  }
  try {
    const db = mercadoPagoDatabase();
    if (body.action === "logout") {
      const token = req.cookies.get(cookieName(req))?.value || "";
      if (/^[a-f0-9]{64}$/.test(token)) {
        const result = await db
          .from("customer_access_devices")
          .update({ revoked_at: new Date().toISOString() })
          .eq("token_hash", deviceHash(token));
        if (result.error) throw new Error("Revoke failed");
      }
      const response = respond({ verified: false });
      response.cookies.set(cookieName(req), "", {
        ...cookieOptions(req),
        maxAge: 0,
      });
      response.cookies.set(challengeCookie, "", {
        ...cookieOptions(req),
        maxAge: 0,
      });
      return response;
    }
    if (body.action === "verify") {
      const binding = req.cookies.get(challengeCookie)?.value || "";
      const [id, nonce] = binding.split(":");
      if (
        !/^[a-f0-9-]{36}$/.test(id || "") ||
        !/^[a-f0-9]{64}$/.test(nonce || "") ||
        !/^\d{6}$/.test(body.code || "")
      )
        return respond(
          {
            error: "Ingresa el código de seis dígitos de la última solicitud.",
          },
          400,
        );
      const token = randomBytes(32).toString("hex");
      const result = await db.rpc("verify_customer_access_challenge", {
        p_id: id,
        p_binding_hash: deviceHash(nonce),
        p_code_hash: customerHash("otp", `${id}:${nonce}:${body.code}`),
        p_token_hash: deviceHash(token),
      });
      if (result.error) throw new Error("Verification unavailable");
      if (!result.data)
        return respond(
          {
            error:
              "Código incorrecto, vencido o sin intentos disponibles. Revisa el último código o solicita uno nuevo.",
          },
          401,
        );
      // Read failures must not lose the verified session: GET can retry afterwards.
      const response = respond({ verified: true });
      if (body.remember !== true) {
        const updated = await db
          .from("customer_access_devices")
          .update({
            expires_at: new Date(
              Date.now() + 12 * 60 * 60 * 1000,
            ).toISOString(),
          })
          .eq("token_hash", deviceHash(token));
        if (updated.error) throw new Error("Session unavailable");
      }
      response.cookies.set(cookieName(req), token, {
        ...cookieOptions(req),
        ...(body.remember === true ? { maxAge: 30 * 86400 } : {}),
      });
      response.cookies.set(challengeCookie, "", {
        ...cookieOptions(req),
        maxAge: 0,
      });
      return response;
    }
    if (
      body.action !== "lookup" ||
      typeof body.dni !== "string" ||
      !/^\d{8}$/.test(body.dni.trim())
    )
      return respond({ error: "Ingresa un DNI de ocho dígitos." }, 400);
    const dni = body.dni.trim();
    const identity = await deviceIdentity(req);
    if (identity && identity.dni === dni)
      return respond({
        verified: true,
        wallet: await readCustomerWallet(db, identity),
      });
    // Validate configuration before returning the generic challenge response.
    const documentHash = customerHash("dni", dni);
    const ipHash = customerHash("ip", getClientIp(req));
    const id = randomUUID();
    const nonce = randomBytes(32).toString("hex");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = customerHash("otp", `${id}:${nonce}:${code}`);
    after(async () => {
      let stage = "challenge";
      try {
        const created = await db.rpc("create_customer_access_challenge", {
          p_id: id,
          p_document_hash: documentHash,
          p_ip_hash: ipHash,
          p_binding_hash: deviceHash(nonce),
          p_code_hash: codeHash,
        });
        if (created.error) throw new Error("Challenge unavailable");
        if (!created.data) {
          console.info("[customer-access] challenge_throttled");
          return;
        }
        stage = "lookup";
        const owner = await findCustomerIdentity(db, dni);
        if (!owner) {
          console.info("[customer-access] recipient_not_found");
          return;
        }
        stage = "identity";
        const saved = await db
          .from("customer_access_challenges")
          .update({ identity_encrypted: sealIdentity(owner) })
          .eq("id", id)
          .is("consumed_at", null);
        if (saved.error) throw new Error("Challenge unavailable");
        stage = "email";
        await sendEmail({
          to: owner.email,
          subject: "Tu código para acceder a BABY",
          idempotencyKey: `customer-access/${id}`,
          text: `Tu código de verificación de BABY es: ${code}\n\nVence en 10 minutos y solo se puede usar una vez. Escríbelo en Mis entradas. No compartas el código. Si no solicitaste este acceso, ignora este mensaje.`,
          html: `<div lang="es" style="max-width:520px;margin:auto;padding:32px;font-family:Arial,sans-serif;background:#080808;color:#fff"><h1>Tu acceso a BABY</h1><p>Escribe este código en Mis entradas:</p><p style="font-family:monospace;font-size:32px;letter-spacing:8px">${code}</p><p>Vence en 10 minutos y solo se puede usar una vez.</p><p>No compartas el código. Si no solicitaste este acceso, ignora este mensaje.</p></div>`,
        });
        console.info("[customer-access] verification_email_accepted");
      } catch {
        console.error(`[customer-access] ${stage}_failed`);
      } finally {
        try {
          const cleanup = await db.rpc("cleanup_customer_access");
          if (cleanup.error) console.error("[customer-access] cleanup_failed");
        } catch {
          console.error("[customer-access] cleanup_failed");
        }
      }
    });
    const response = respond(
      {
        verified: false,
        message:
          "Si el DNI tiene un correo registrado en BABY, enviaremos allí un código. Revisa también correo no deseado.",
        resendAfter: 60,
      },
      202,
    );
    response.cookies.set(challengeCookie, `${id}:${nonce}`, {
      ...cookieOptions(req),
      maxAge: 600,
    });
    return response;
  } catch {
    console.error("[customer-access] request_failed");
    return respond(
      { error: "El servicio no está disponible. Inténtalo más tarde." },
      503,
    );
  }
}
