export function extractAccessCodeInput(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);
    const code = parsed.searchParams.get("code");
    if (code?.trim()) return code.trim();
  } catch {
    // Ignore non-URL values.
  }

  const queryMatch = value.match(/[?&]code=([^&]+)/i);
  if (queryMatch?.[1]) {
    try {
      return decodeURIComponent(queryMatch[1]).trim();
    } catch {
      return queryMatch[1].trim();
    }
  }

  return value;
}
