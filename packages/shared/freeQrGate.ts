export const FREE_QR_DISABLED_MESSAGE =
  "QR free aún no está habilitado comercialmente.";

export function isFreeQrCodeType(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase() === "free";
}

export function isFreeQrReleaseEnabled() {
  return (
    String(process.env.ENABLE_FREE_QR_CODES || "")
      .trim()
      .toLowerCase() === "true"
  );
}
