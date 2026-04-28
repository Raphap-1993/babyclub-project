import { createHash } from "node:crypto";
import { DateTime } from "luxon";

const LIMA_TZ = "America/Lima";

export function splitCustomerName(fullName: string) {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return { firstName: "Cliente", lastName: "BabyClub" };
  }

  const chunks = cleaned.split(" ");
  if (chunks.length === 1) {
    return { firstName: chunks[0], lastName: "BabyClub" };
  }

  return {
    firstName: chunks.slice(0, -1).join(" "),
    lastName: chunks.slice(-1).join(" "),
  };
}

export function buildWebhookEventKey(
  provider: string,
  rawBody: string,
  eventId: string | null,
) {
  if (eventId) return `${provider}:${eventId}`;
  const hash = createHash("sha256").update(rawBody).digest("hex");
  return `${provider}:sha256:${hash}`;
}

export function buildReceiptNumber(seed: string, now = new Date()) {
  const date = DateTime.fromJSDate(now).setZone(LIMA_TZ).toFormat("yyyyLLdd");
  const suffix =
    seed
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-8)
      .toUpperCase() || Math.random().toString(36).slice(2, 10).toUpperCase();
  return `BC-${date}-${suffix}`;
}
