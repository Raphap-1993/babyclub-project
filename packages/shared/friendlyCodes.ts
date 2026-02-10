/**
 * Generate friendly reservation codes
 * Format: BC-{EVENT_PREFIX}-{TABLE_NAME}-{PERSON_INDEX}
 * Example: BC-LOVE-M1-001
 * 
 * @param eventPrefix - Short event identifier (e.g., "LOVE", "FIESTA")
 * @param tableName - Table name without "Mesa" prefix (e.g., "M1", "M2")
 * @param personIndex - 1-based index of person in reservation (1-5)
 * @returns Friendly code string
 */
export function generateFriendlyCode(
  eventPrefix: string,
  tableName: string,
  personIndex: number
): string {
  // Normalize inputs
  const prefix = eventPrefix.toUpperCase().replace(/\s+/g, '-');
  const table = tableName.toUpperCase().replace(/MESA\s*/i, '').trim();
  const index = personIndex.toString().padStart(3, '0');

  return `BC-${prefix}-${table}-${index}`;
}

/**
 * Parse a friendly code back into its components
 * @param code - Friendly code (e.g., "BC-LOVE-M1-001")
 * @returns Object with parsed components or null if invalid
 */
export function parseFriendlyCode(code: string): {
  eventPrefix: string;
  tableName: string;
  personIndex: number;
} | null {
  const pattern = /^BC-([A-Z0-9-]+)-([A-Z0-9]+)-(\d{3})$/;
  const match = code.match(pattern);

  if (!match) return null;

  return {
    eventPrefix: match[1],
    tableName: match[2],
    personIndex: parseInt(match[3], 10),
  };
}

/**
 * Generate multiple codes for a table reservation
 * @param eventPrefix - Event identifier
 * @param tableName - Table name
 * @param quantity - Number of codes to generate (based on table capacity)
 * @returns Array of friendly codes
 */
export function generateReservationCodes(
  eventPrefix: string,
  tableName: string,
  quantity: number
): string[] {
  const codes: string[] = [];

  for (let i = 1; i <= quantity; i++) {
    codes.push(generateFriendlyCode(eventPrefix, tableName, i));
  }

  return codes;
}

/**
 * Example usage:
 * 
 * const codes = generateReservationCodes("LOVE", "Mesa 1", 4);
 * // ["BC-LOVE-M1-001", "BC-LOVE-M1-002", "BC-LOVE-M1-003", "BC-LOVE-M1-004"]
 * 
 * const parsed = parseFriendlyCode("BC-LOVE-M1-002");
 * // { eventPrefix: "LOVE", tableName: "M1", personIndex: 2 }
 */
