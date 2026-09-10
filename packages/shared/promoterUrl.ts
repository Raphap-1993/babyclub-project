export function buildPermanentPromoterUrl(
  promoterId: string,
  landingUrl: string | undefined,
): string {
  if (!landingUrl?.trim())
    throw new Error(
      "Configura NEXT_PUBLIC_LANDING_URL para copiar el enlace de este entorno",
    );
  const url = new URL(landingUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("La URL de landing configurada no es válida");
  return new URL(`/p/${encodeURIComponent(promoterId)}`, url.origin).toString();
}
