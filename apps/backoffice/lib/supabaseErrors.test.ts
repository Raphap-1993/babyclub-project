import { describe, expect, it } from "vitest";
import {
  getUserFacingSupabaseError,
  isRetryableSupabaseError,
  sanitizeSupabaseErrorMessage,
} from "./supabaseErrors";

describe("supabaseErrors", () => {
  it("sanitizes HTML cloudflare timeout responses", () => {
    const message = "<!DOCTYPE html><title>... Error code 522 ... Connection timed out</title>";
    expect(sanitizeSupabaseErrorMessage(message)).toBe("Supabase no respondió a tiempo (Cloudflare 522)");
  });

  it("returns generic HTML error when cloudflare code is missing", () => {
    const message = "<html><body>temporarily unavailable</body></html>";
    expect(sanitizeSupabaseErrorMessage(message)).toBe("Supabase devolvió una respuesta HTML inesperada");
  });

  it("detects retryable timeout and network errors", () => {
    expect(isRetryableSupabaseError("fetch failed: network timeout")).toBe(true);
    expect(isRetryableSupabaseError("Error code 522")).toBe(true);
  });

  it("returns fallback message for retryable errors", () => {
    const fallback = "No se pudieron cargar organizadores. Reintenta en unos segundos.";
    expect(getUserFacingSupabaseError("fetch failed with timeout", fallback)).toBe(fallback);
  });

  it("truncates very long non-html errors", () => {
    const longMessage = "x".repeat(240);
    const sanitized = sanitizeSupabaseErrorMessage(longMessage);
    expect(sanitized.length).toBe(223);
    expect(sanitized.endsWith("...")).toBe(true);
  });
});
