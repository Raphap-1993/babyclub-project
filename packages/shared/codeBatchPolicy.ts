export type CodeTypePolicy = {
  code_type: string;
  requires_expiration: boolean;
  updated_by_staff_id?: string | null;
  updated_at?: string | null;
};

export type CodeBatchCloseReason = "closed" | "expired" | "quota" | null;

export type CodeBatchCloseCandidate = {
  closed_at?: string | Date | null;
  expires_at?: string | Date | null;
  remaining_usable_codes?: number | null;
};

function toTimeValue(value: string | Date | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function requiresExpirationForCodeType(
  codeType: string,
  policies: CodeTypePolicy[] | null | undefined,
) {
  const normalizedCodeType =
    typeof codeType === "string" ? codeType.trim() : "";
  if (!normalizedCodeType || !Array.isArray(policies)) return false;

  const policy = policies.find(
    (entry) =>
      typeof entry?.code_type === "string" &&
      entry.code_type.trim() === normalizedCodeType,
  );

  return policy?.requires_expiration === true;
}

export function resolveBatchCloseReason(
  batch: CodeBatchCloseCandidate | null | undefined,
  now: Date | string | number,
): CodeBatchCloseReason {
  if (batch?.closed_at != null) return "closed";

  const nowTime = toTimeValue(now);
  const expiresAtTime = toTimeValue(batch?.expires_at);
  if (nowTime !== null && expiresAtTime !== null && expiresAtTime <= nowTime) {
    return "expired";
  }

  const remainingUsableCodes = Number(batch?.remaining_usable_codes);
  if (Number.isFinite(remainingUsableCodes) && remainingUsableCodes <= 0) {
    return "quota";
  }

  return null;
}
