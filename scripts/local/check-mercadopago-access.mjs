// Node >= 20.12. Read-only verification; never creates an order or charge.
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

const envIndex = process.argv.indexOf("--env");
const envPath = envIndex >= 0 ? process.argv[envIndex + 1] : undefined;

async function main() {
  if (!envPath) {
    throw new Error(
      "Indica --env con la ruta del archivo local de credenciales.",
    );
  }
  const config = parseEnv(await readFile(envPath, "utf8"));
  if (config.MERCADOPAGO_ENVIRONMENT !== "test") {
    throw new Error(
      "Esta verificación local exige MERCADOPAGO_ENVIRONMENT=test.",
    );
  }
  const accessToken = config.MERCADOPAGO_ACCESS_TOKEN?.trim();
  const expectedCollector = config.MERCADOPAGO_COLLECTOR_ID?.trim();
  if (!accessToken || accessToken.includes("redacted")) {
    throw new Error("Falta el Access Token de prueba en el archivo local.");
  }
  if (!expectedCollector || !/^\d+$/.test(expectedCollector)) {
    throw new Error(
      "Falta el User ID del vendedor de prueba para contrastar la cuenta.",
    );
  }
  if (!config.MERCADOPAGO_PUBLIC_KEY?.trim()) {
    throw new Error("Falta la Public Key de prueba.");
  }

  const response = await fetch("https://api.mercadopago.com/users/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  // Provider errors and personal account data must not be written to logs.
  if (!response.ok) {
    throw new Error(
      `Mercado Pago rechazó la identificación (HTTP ${response.status}).`,
    );
  }
  const account = await response.json();
  if (String(account.id) !== expectedCollector) {
    throw new Error(
      "El token pertenece a otra cuenta: no coincide con el vendedor de prueba esperado.",
    );
  }
  if (account.site_id !== "MPE" || account.country_id !== "PE") {
    throw new Error(
      "La cuenta identificada no corresponde a Mercado Pago Perú.",
    );
  }
  console.log(
    JSON.stringify({
      success: true,
      environment: "test",
      collectorId: String(account.id),
      site: account.site_id,
      country: account.country_id,
      check: "account_identity_only",
      paymentsActivated: false,
    }),
  );
}

main().catch((error) => {
  // Do not print arbitrary fetch errors, response bodies or configuration values.
  const message =
    error?.name === "TimeoutError"
      ? "La identificación con Mercado Pago excedió el tiempo de espera."
      : error?.cause
        ? "No se pudo conectar con Mercado Pago."
        : error?.message || "No se pudo verificar la cuenta.";
  console.error(JSON.stringify({ success: false, error: message }));
  process.exitCode = 1;
});
