import { afterEach, describe, expect, it } from "vitest";

import { FREE_QR_DISABLED_MESSAGE, isFreeQrReleaseEnabled } from "./freeQrGate";

describe("freeQrGate", () => {
  const previousFlag = process.env.ENABLE_FREE_QR_CODES;

  afterEach(() => {
    if (previousFlag === undefined) {
      delete process.env.ENABLE_FREE_QR_CODES;
      return;
    }
    process.env.ENABLE_FREE_QR_CODES = previousFlag;
  });

  it("mantiene QR free deshabilitado por defecto", () => {
    delete process.env.ENABLE_FREE_QR_CODES;

    expect(isFreeQrReleaseEnabled()).toBe(false);
    expect(FREE_QR_DISABLED_MESSAGE).toContain("QR free");
  });

  it("solo habilita QR free con flag explicito en true", () => {
    process.env.ENABLE_FREE_QR_CODES = "true";
    expect(isFreeQrReleaseEnabled()).toBe(true);

    process.env.ENABLE_FREE_QR_CODES = "TRUE";
    expect(isFreeQrReleaseEnabled()).toBe(true);

    process.env.ENABLE_FREE_QR_CODES = "1";
    expect(isFreeQrReleaseEnabled()).toBe(false);
  });
});
