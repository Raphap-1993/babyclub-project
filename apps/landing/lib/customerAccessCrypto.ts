import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

export type CustomerIdentity = { dni: string; email: string };
function secret() {
  const value = process.env.CUSTOMER_ACCESS_SECRET || "";
  if (!/^[a-f0-9]{64}$/.test(value))
    throw new Error("Customer access is not configured");
  return Buffer.from(value, "hex");
}
export const customerHash = (scope: string, value: string) =>
  createHmac("sha256", secret()).update(`${scope}:${value}`).digest("hex");
export const deviceHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function sealIdentity(identity: CustomerIdentity) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  cipher.setAAD(Buffer.from("baby-customer-access-v1"));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(identity), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function openIdentity(value: string): CustomerIdentity {
  const bytes = Buffer.from(value, "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secret(),
    bytes.subarray(0, 12),
  );
  decipher.setAAD(Buffer.from("baby-customer-access-v1"));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const identity = JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  );
  if (!/^\d{8}$/.test(identity.dni) || typeof identity.email !== "string")
    throw new Error("Invalid identity");
  return identity;
}
