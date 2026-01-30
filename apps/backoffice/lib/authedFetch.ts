import { supabaseClient } from "@/lib/supabaseClient";

export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Authorization") && supabaseClient) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch (_err) {
      // ignore
    }
  }
  return fetch(input, { ...init, headers });
}
