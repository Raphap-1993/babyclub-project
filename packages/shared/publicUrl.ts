const FALLBACK_PUBLIC_APP_URL = "https://babyclubaccess.com";

function isNonProductionVercelPreviewHost(url: URL) {
  const vercelEnv = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  return (
    Boolean(vercelEnv) &&
    vercelEnv !== "production" &&
    url.hostname.endsWith(".vercel.app")
  );
}

function normalizeBaseUrl(value: string, options?: { allowPanelHost?: boolean }) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
    if (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1"
    ) {
      return "";
    }
    if (isNonProductionVercelPreviewHost(url)) {
      return "";
    }
    if (!options?.allowPanelHost && url.hostname.startsWith("panel.")) {
      return "";
    }
    return `${url.protocol}//${url.host}`.replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function getPublicAppUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_LANDING_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    FALLBACK_PUBLIC_APP_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(String(candidate || ""));
    if (normalized) return normalized;
  }

  return FALLBACK_PUBLIC_APP_URL;
}

export function getPublicLandingUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_LANDING_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
    FALLBACK_PUBLIC_APP_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(String(candidate || ""));
    if (normalized) return normalized;
  }

  return FALLBACK_PUBLIC_APP_URL;
}
