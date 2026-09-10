import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { ticketQrDataUrl } from "./ticketQr";

const require = createRequire(import.meta.url);
const { PNG } = createRequire(require.resolve("qrcode"))("pngjs");
const { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } =
  createRequire(require.resolve("@zxing/browser"))("@zxing/library");

describe("individual ticket QR", () => {
  it("encodes the exact admission token in a locally generated PNG readable by the scanner", async () => {
    const token = "baby-ticket_qa-only+token/with=symbols-123456789";
    const result = await ticketQrDataUrl(token);
    expect(result.startsWith("data:image/png;base64,")).toBe(true);
    const png = PNG.sync.read(Buffer.from(result.split(",")[1], "base64"));
    expect(png.width).toBe(520);
    expect(png.height).toBe(520);
    const pixels = new Int32Array(png.width * png.height);
    for (let index = 0; index < pixels.length; index++) {
      const offset = index * 4;
      pixels[index] =
        (png.data[offset] << 16) |
        (png.data[offset + 1] << 8) |
        png.data[offset + 2];
    }
    const bitmap = new BinaryBitmap(
      new HybridBinarizer(
        new RGBLuminanceSource(pixels, png.width, png.height),
      ),
    );
    expect(new QRCodeReader().decode(bitmap).getText()).toBe(token);
  });

  it("does not fabricate a QR when the admission token is missing", async () => {
    await expect(ticketQrDataUrl("")).rejects.toThrow("QR no disponible");
    await expect(ticketQrDataUrl("   ")).rejects.toThrow("QR no disponible");
  });
});
