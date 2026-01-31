import { NextRequest, NextResponse } from "next/server";
import { parseRateLimitEnv, rateLimit, rateLimitHeaders } from "shared/security/rateLimit";

const token = process.env.API_PERU_TOKEN || "";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_RENIEC_PER_MIN = parseRateLimitEnv(process.env.RATE_LIMIT_RENIEC_PER_MIN, 20);

export async function GET(req: NextRequest) {
  const limiter = rateLimit(req, {
    keyPrefix: "landing:reniec",
    limit: RATE_LIMIT_RENIEC_PER_MIN,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limiter.resetMs },
      { status: 429, headers: rateLimitHeaders(limiter) }
    );
  }

  const dni = req.nextUrl.searchParams.get("dni") || "";
  if (!dni || dni.length !== 8) {
    return NextResponse.json({ error: "DNI inválido" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "API_PERU_TOKEN no configurado" }, { status: 501 });
  }

  try {
    const url = `https://apiperu.dev/api/dni/${dni}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.success === false) {
      const message = payload?.message || "No se encontró DNI";
      const status = res.status === 401 ? 401 : res.status === 404 ? 404 : 400;
      return NextResponse.json({ error: `API Peru: ${message}` }, { status });
    }

    const data = payload?.data || payload || {};
    const birthdate = data?.fecha_nacimiento || data?.fechaNacimiento || null;

    if (birthdate && !isAdult(birthdate)) {
      return NextResponse.json({ error: "Solo mayores de 18" }, { status: 403 });
    }

    return NextResponse.json({
      dni,
      nombres: data?.nombres || "",
      apellidoPaterno: data?.apellido_paterno || data?.apellidoPaterno || "",
      apellidoMaterno: data?.apellido_materno || data?.apellidoMaterno || "",
      birthdate: birthdate,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error DNI" }, { status: 500 });
  }
}

function isAdult(birthdate: string) {
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return true;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 18;
}
