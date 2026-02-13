const RETRYABLE_SUPABASE_ERROR =
  /(aborterror|operation was aborted|aborted|timeout|timed out|error code 522|gateway timeout|service unavailable|fetch failed|network|temporarily unavailable)/i;

export function createSupabaseFetchWithTimeout(timeoutMs: number) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const upstreamSignal = init?.signal;
    const abortFromUpstream = () => controller.abort();
    if (upstreamSignal) {
      if (upstreamSignal.aborted) controller.abort();
      upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(input, { ...(init || {}), signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
    }
  };
}

function normalizeRawMessage(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object" && "message" in input) {
    const maybeMessage = (input as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return "";
}

export function sanitizeSupabaseErrorMessage(input: unknown): string {
  const normalized = normalizeRawMessage(input).replace(/\s+/g, " ").trim();
  if (!normalized) return "Error inesperado al consultar Supabase";

  if (/<(!doctype|html)/i.test(normalized)) {
    const cloudflareCode = normalized.match(/error code\s+(\d{3})/i)?.[1];
    if (cloudflareCode) return `Supabase no respondió a tiempo (Cloudflare ${cloudflareCode})`;
    return "Supabase devolvió una respuesta HTML inesperada";
  }

  return normalized.length > 220 ? `${normalized.slice(0, 220)}...` : normalized;
}

export function isRetryableSupabaseError(input: unknown): boolean {
  const normalized = normalizeRawMessage(input).replace(/\s+/g, " ").trim();
  return RETRYABLE_SUPABASE_ERROR.test(normalized);
}

export function getUserFacingSupabaseError(input: unknown, fallback: string): string {
  if (isRetryableSupabaseError(input)) return fallback;
  return sanitizeSupabaseErrorMessage(input);
}
