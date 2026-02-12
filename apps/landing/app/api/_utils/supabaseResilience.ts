type SupabaseLikeError = {
  message?: string | null;
  code?: string | null;
};

type SupabaseLikeResult<T> = {
  data: T | null;
  error: SupabaseLikeError | null;
};

const RETRYABLE_SUPABASE_ERROR =
  /(error code 522|connection timed out|gateway timeout|service unavailable|fetch failed|network|temporarily unavailable|upstream|econnreset|etimedout|aborterror|aborted|operation was aborted|timeout)/i;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const DEFAULT_SUPABASE_TIMEOUT_MS = 6000;

function extractErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const value = (error as { message?: unknown }).message;
    return typeof value === "string" ? value : "";
  }
  return "";
}

export function sanitizeSupabaseErrorMessage(error: unknown): string {
  const raw = extractErrorMessage(error).replace(/\s+/g, " ").trim();
  if (!raw) return "Error inesperado al consultar Supabase";

  if (/<(!doctype|html)/i.test(raw)) {
    const cloudflareCode = raw.match(/error code\s+(\d{3})/i)?.[1];
    if (cloudflareCode) return `Supabase no respondió a tiempo (Cloudflare ${cloudflareCode})`;
    return "Supabase devolvió una respuesta HTML inesperada";
  }

  return raw.length > 220 ? `${raw.slice(0, 220)}...` : raw;
}

export function isRetryableSupabaseError(error: unknown): boolean {
  const message = extractErrorMessage(error);
  if (!message) return false;
  return RETRYABLE_SUPABASE_ERROR.test(message);
}

export function createSupabaseFetchWithTimeout(timeoutMs = DEFAULT_SUPABASE_TIMEOUT_MS) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(input, { ...(init || {}), signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

export async function withSupabaseRetry<T>(
  operation: string,
  execute: () => PromiseLike<SupabaseLikeResult<T>>,
  maxAttempts = 2
): Promise<{ data: T | null; error: SupabaseLikeError | null; retryable: boolean }> {
  let lastError: SupabaseLikeError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await execute();
    if (!result.error) {
      return { data: result.data, error: null, retryable: false };
    }

    lastError = result.error;
    const retryable = isRetryableSupabaseError(result.error);
    const willRetry = retryable && attempt < maxAttempts;

    console.warn("[landing/supabase] query failed", {
      operation,
      attempt,
      maxAttempts,
      retryable,
      willRetry,
      code: result.error?.code || null,
      message: sanitizeSupabaseErrorMessage(result.error),
    });

    if (willRetry) {
      await delay(300 * attempt);
      continue;
    }

    return { data: result.data, error: result.error, retryable };
  }

  return { data: null, error: lastError, retryable: isRetryableSupabaseError(lastError) };
}
