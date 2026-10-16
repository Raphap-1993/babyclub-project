import { describe, expect, it, vi } from "vitest";
import { tokenizeMercadoPagoYape } from "./mercadopagoYape";
const input = {
  phoneNumber: "111111111",
  otp: "123456",
  amountCents: 4000,
  environment: "test" as const,
};
describe("Yape browser adapter", () => {
  it("sends OTP only to MP.js; BABY receives a token and phone", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({
        id: "synthetic-token",
        private: "must-not-forward",
      });
    const sdk = { yape: vi.fn().mockReturnValue({ create }) };
    const result = await tokenizeMercadoPagoYape(sdk, input);
    expect(sdk.yape).toHaveBeenCalledWith({
      phoneNumber: input.phoneNumber,
      otp: input.otp,
    });
    expect(result).toEqual({
      payment_method_id: "yape",
      token: "synthetic-token",
      phone_number: input.phoneNumber,
    });
    expect(JSON.stringify(result)).not.toContain(input.otp);
  });
  it("validates before contacting MP and does not allow test fixtures in production", async () => {
    const sdk = { yape: vi.fn() };
    for (const patch of [
      { otp: "123" },
      { phoneNumber: "x" },
      { amountCents: 200001 },
      { environment: "live" as const },
    ])
      await expect(
        tokenizeMercadoPagoYape(sdk, { ...input, ...patch }),
      ).rejects.toThrow();
    expect(sdk.yape).not.toHaveBeenCalled();
  });
  it("does not leak provider exceptions containing the approval code", async () => {
    const sdk = {
      yape: () => ({
        create: () => Promise.reject(new Error("private-otp-123456")),
      }),
    };
    await expect(tokenizeMercadoPagoYape(sdk, input)).rejects.toThrow(
      "solicita un nuevo código",
    );
    await expect(tokenizeMercadoPagoYape(sdk, input)).rejects.not.toThrow(
      "123456",
    );
  });
});
