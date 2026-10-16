import { beforeEach, describe, expect, it, vi } from "vitest";

const { providerSend } = vi.hoisted(() => ({ providerSend: vi.fn() }));
vi.mock("resend", () => ({
  Resend: function () {
    return { emails: { send: providerSend } };
  },
}));

describe("sendEmail provider outcome", () => {
  it("passes the inline QR attachment and stable idempotency key to the provider", async () => {
    providerSend.mockResolvedValue({ data: { id: "message-qr" }, error: null });
    const { sendEmail } = await import("./resend");
    const attachments = [
      { filename: "entrada-baby.png", content: "cG5n", contentId: "buyer-qr" },
    ];
    await sendEmail({
      to: "recipient@example.test",
      subject: "Ticket",
      html: '<img src="cid:buyer-qr"/>',
      attachments,
      idempotencyKey: "manual-sale-123",
    });
    expect(providerSend).toHaveBeenCalledWith(
      expect.objectContaining({ attachments }),
      { idempotencyKey: "manual-sale-123" },
    );
  });
  beforeEach(() => {
    vi.resetModules();
    providerSend.mockReset();
    process.env.RESEND_API_KEY = "test-provider-key";
    process.env.RESEND_FROM = "BabyClub Access <no-reply@babyclubaccess.com>";
  });

  it("rejects a structured provider error instead of resolving as sent", async () => {
    providerSend.mockResolvedValue({
      data: null,
      error: { message: "Provider rejected request" },
    });
    const { sendEmail } = await import("./resend");
    await expect(
      sendEmail({
        to: "recipient@example.test",
        subject: "Ticket",
        text: "View ticket",
      }),
    ).rejects.toThrow("Provider rejected request");
  });

  it("rejects a response without an accepted message id", async () => {
    providerSend.mockResolvedValue({ data: null, error: null });
    const { sendEmail } = await import("./resend");
    await expect(
      sendEmail({
        to: "recipient@example.test",
        subject: "Ticket",
        text: "View ticket",
      }),
    ).rejects.toThrow();
  });

  it("returns an accepted message id", async () => {
    providerSend.mockResolvedValue({ data: { id: "message-1" }, error: null });
    const { sendEmail } = await import("./resend");
    await expect(
      sendEmail({
        to: "recipient@example.test",
        subject: "Ticket",
        text: "View ticket",
      }),
    ).resolves.toMatchObject({ data: { id: "message-1" } });
  });
});
