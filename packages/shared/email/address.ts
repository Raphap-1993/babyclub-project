const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return trimmed;

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1).toLowerCase();
  return `${localPart}@${domainPart}`;
}

export function isValidEmailAddress(value: string) {
  return EMAIL_REGEX.test(normalizeEmailAddress(value));
}

export function normalizeEmailRecipients(value: string | string[]) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.map((item) => normalizeEmailAddress(item)).filter(Boolean)),
    );
  }
  return normalizeEmailAddress(value);
}

export function getEmailDomain(value: string | null | undefined) {
  const normalized = normalizeEmailAddress(value || "");
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) return null;
  return normalized.slice(atIndex + 1);
}
