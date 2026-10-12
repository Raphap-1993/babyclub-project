const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const TICKET_PATH = new RegExp(`^/(?:ticket|compra/reserva)/${UUID}/?$`, "i");

/** Open only a link already possessed by the visitor, never search by identity. */
export function getLocalTicketLink(
  value: string,
  origin: string,
): string | null {
  const input = value.trim();
  if (!input || input.length > 4096) return null;
  try {
    const url = new URL(input, origin);
    const trusted =
      url.origin === origin || url.origin === "https://babyclubaccess.com";
    if (
      !trusted ||
      url.username ||
      url.password ||
      !TICKET_PATH.test(url.pathname)
    )
      return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
