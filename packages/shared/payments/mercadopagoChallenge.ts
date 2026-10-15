// The challenge URL carries a guest capability. Never log it or accept it from
// a checkout request. Only use the URL obtained from the canonical Orders API.
export function safeMercadoPagoChallengeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !["www.mercadopago.com.pe", "www.mercadopago.com.ar"].includes(
        url.hostname,
      ) ||
      !/^\/auth\/card\/validation\/pages\/remedies\/[a-zA-Z0-9-]+\/?$/.test(
        url.pathname,
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

// A completion message is only a hint to re-read the server state, never proof
// that payment succeeded. Ignore unrelated windows and forged origins.
export function isMercadoPagoChallengeComplete(
  event: { source: unknown; origin: string; data: unknown },
  frameWindow: unknown,
  challengeUrl: string,
) {
  const url = safeMercadoPagoChallengeUrl(challengeUrl);
  return Boolean(
    url &&
      frameWindow &&
      event.source === frameWindow &&
      event.origin === new URL(url).origin &&
      event.data &&
      typeof event.data === "object" &&
      (event.data as { status?: string }).status === "COMPLETE",
  );
}
