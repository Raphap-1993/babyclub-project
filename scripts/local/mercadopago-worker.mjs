import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
const env = parseEnv(
  await readFile(process.argv[2] || "apps/landing/.env.local", "utf8"),
);
const base = new URL(process.argv[3] || "http://localhost:3004");
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
  !env.MERCADOPAGO_WORKER_SECRET
)
  throw new Error("Local worker requires a local URL and secret");
async function tick() {
  try {
    const response = await fetch(
      new URL("/api/payments/mercadopago/reconcile", base),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env.MERCADOPAGO_WORKER_SECRET}` },
        signal: AbortSignal.timeout(50_000),
      },
    );
    const result = await response.json();
    console.log(
      JSON.stringify({
        time: new Date().toISOString(),
        status: response.status,
        checked: result.checked,
        errors: result.errors,
        notificationJobs: result.notificationJobs,
      }),
    );
  } catch {
    console.log("Worker will retry on the next cycle");
  }
}
do {
  await tick();
  if (process.argv.includes("--once")) break;
  await new Promise((resolve) => setTimeout(resolve, 15_000));
} while (true);
