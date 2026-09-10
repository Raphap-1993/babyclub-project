import QRCode from "qrcode";

export async function ticketQrDataUrl(qrToken: string): Promise<string> {
  if (!qrToken || !qrToken.trim()) throw new Error("QR no disponible");
  return QRCode.toDataURL(qrToken, {
    type: "image/png",
    width: 520,
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}
