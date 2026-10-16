const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const LOCAL_PAYMENT_TEST_URL = "http://127.0.0.1:3004/";
export const LOCAL_PAYMENT_PANEL_URL =
  "http://127.0.0.1:3000/admin/mercadopago";

// Never infer the payment mode from the browser or accept a target URL in a request.
export function mercadoPagoAdminDeployment() {
  const database = new URL(process.env.SUPABASE_URL || "");
  if (!process.env.VERCEL_ENV && loopback.has(database.hostname)) {
    return { environment: "test" as const, landingUrl: LOCAL_PAYMENT_TEST_URL };
  }
  if (
    process.env.VERCEL_ENV === "production" &&
    database.protocol === "https:" &&
    database.origin === "https://wtwnhqbbcocpnqqsybln.supabase.co"
  ) {
    return {
      environment: "live" as const,
      landingUrl: "https://babyclubaccess.com/",
    };
  }
  throw new Error(
    "El panel de pagos requiere producción o una base local aislada.",
  );
}

export async function readMercadoPagoRuntime(
  landingUrl: string,
  environment: string,
) {
  try {
    const response = await fetch(new URL("api/payments/status", landingUrl), {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    const json = await response.json();
    const mp = json?.providers?.mercadopago;
    if (!response.ok || !json.success || mp?.environment !== environment)
      return null;
    // Explicit allowlist: never relay provider keys or arbitrary upstream data.
    return {
      environment,
      enabled: mp.enabled === true,
      configured: mp.configured === true || mp.enabled === true,
    };
  } catch {
    return null;
  }
}
