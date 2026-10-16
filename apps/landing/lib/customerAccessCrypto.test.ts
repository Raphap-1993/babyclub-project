import { beforeEach, describe, expect, it } from "vitest";
import {
  customerHash,
  deviceHash,
  openIdentity,
  sealIdentity,
} from "./customerAccessCrypto";

beforeEach(() => {
  process.env.CUSTOMER_ACCESS_SECRET = "12".repeat(32);
});
describe("customer device identity", () => {
  it("encrypts identity with fresh IVs, authenticates it, and never stores plaintext", () => {
    const identity = { dni: "00001234", email: "customer@example.com" };
    const a = sealIdentity(identity),
      b = sealIdentity(identity);
    expect(a).not.toBe(b);
    expect(a).not.toContain(identity.dni);
    expect(a).not.toContain(identity.email);
    expect(openIdentity(a)).toEqual(identity);
    const tampered = Buffer.from(a, "base64url");
    tampered[30] ^= 1;
    expect(() => openIdentity(tampered.toString("base64url"))).toThrow();
  });
  it("separates DNI, IP and OTP hashes and changes them on secret rotation", () => {
    const value = customerHash("dni", "00001234");
    expect(value).not.toBe(customerHash("ip", "00001234"));
    expect(value).not.toContain("00001234");
    process.env.CUSTOMER_ACCESS_SECRET = "34".repeat(32);
    expect(value).not.toBe(customerHash("dni", "00001234"));
    expect(deviceHash("token")).toHaveLength(64);
  });
  it("fails closed with missing configuration or wrong decryption key", () => {
    const sealed = sealIdentity({ dni: "00001234", email: "a@example.com" });
    process.env.CUSTOMER_ACCESS_SECRET = "56".repeat(32);
    expect(() => openIdentity(sealed)).toThrow();
    delete process.env.CUSTOMER_ACCESS_SECRET;
    expect(() => customerHash("dni", "00001234")).toThrow();
  });
});
