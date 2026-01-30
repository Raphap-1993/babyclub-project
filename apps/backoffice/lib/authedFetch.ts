import { supabaseClient } from "@/lib/supabaseClient";

const REFRESH_SKEW_MS = 60_000;

type Session = { access_token: string; expires_at?: number | null };

function isSessionExpired(session: Session | null | undefined) {
  if (!session?.expires_at) return false;
  return Date.now() >= session.expires_at * 1000 - REFRESH_SKEW_MS;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient.auth.refreshSession();
    if (error) return null;
    return data.session?.access_token || null;
  } catch (_err) {
    return null;
  }
}

async function resolveAccessToken(): Promise<string | null> {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      return refreshAccessToken();
    }
    const session = data.session as Session | null;
    if (!session) {
      return refreshAccessToken();
    }
    if (isSessionExpired(session)) {
      const refreshed = await refreshAccessToken();
      return refreshed || session.access_token || null;
    }
    return session.access_token || null;
  } catch (_err) {
    return null;
  }
}

export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  let attachedAuth = false;

  if (!headers.has("Authorization") && supabaseClient) {
    const token = await resolveAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      attachedAuth = true;
    }
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401 && attachedAuth && supabaseClient) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${refreshed}`);
      return fetch(input, { ...init, headers: retryHeaders });
    }
  }

  return response;
}
