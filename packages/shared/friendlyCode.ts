/**
 * Genera códigos friendly para eventos siguiendo el patrón:
 * {EVENT_SLUG}-{MMDD}
 * 
 * Ejemplo: "BABY Deluxe" + 27/02/2026 → "BABY-DELUXE-0227"
 */

/**
 * Convierte un texto a slug friendly (solo mayúsculas, números y guiones)
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-") // Replace non-alphanumeric with dash
    .replace(/^-+|-+$/g, "") // Remove leading/trailing dashes
    .slice(0, 30); // Max 30 chars
}

/**
 * Genera código friendly para evento
 * @param eventName Nombre del evento
 * @param eventDate Fecha del evento (ISO string o Date)
 * @returns Código friendly único (ej: "BABY-DELUXE-0227")
 */
export function generateEventCode(eventName: string, eventDate: string | Date): string {
  const slug = slugify(eventName);
  
  const date = typeof eventDate === 'string' ? new Date(eventDate) : eventDate;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePart = `${month}${day}`;
  
  return `${slug}-${datePart}`;
}

/**
 * Genera código de promotor para evento específico
 * @param eventCode Código del evento (ej: "BABY-0227")
 * @param promoterCode Código del promotor (ej: "MARIA")
 * @returns Código de promotor por evento (ej: "BABY-0227-MARIA")
 */
export function generatePromoterEventCode(eventCode: string, promoterCode: string): string {
  const promoterSlug = slugify(promoterCode);
  return `${eventCode}-${promoterSlug}`;
}

/**
 * Valida si un código sigue el patrón friendly
 * @param code Código a validar
 * @returns true si es válido
 */
export function isValidFriendlyCode(code: string): boolean {
  // Patrón: TEXTO-MMDD o TEXTO-MMDD-TEXTO
  const pattern = /^[A-Z0-9]+-\d{4}(-[A-Z0-9]+)?$/;
  return pattern.test(code);
}

/**
 * Agrega sufijo numérico si código ya existe
 * @param baseCode Código base
 * @param attempt Intento número (para recursión)
 * @returns Código con sufijo si es necesario
 */
export function addSuffixIfNeeded(baseCode: string, attempt: number = 1): string {
  if (attempt === 1) return baseCode;
  return `${baseCode}-${attempt}`;
}
