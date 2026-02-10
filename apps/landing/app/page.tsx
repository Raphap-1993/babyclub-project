import { createClient } from "@supabase/supabase-js";
import AccessCodeClient from "./AccessCodeClient";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fallbackLogoUrl = process.env.NEXT_PUBLIC_LOGO_URL || null;

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const code = `${error.code || ""}`.toUpperCase();
  const message = `${error.message || ""}`.toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("does not exist");
}

async function getInitialLogoUrl() {
  if (!supabaseUrl || !supabaseServiceKey) return fallbackLogoUrl;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.from("brand_settings").select("logo_url").eq("id", 1).maybeSingle();
    if (error) {
      if (isMissingRelationError(error)) return fallbackLogoUrl;
      return fallbackLogoUrl;
    }
    return data?.logo_url || fallbackLogoUrl;
  } catch (_error) {
    return fallbackLogoUrl;
  }
}

export const dynamic = "force-dynamic";

export default async function AccessCodePage() {
  const initialLogoUrl = await getInitialLogoUrl();
  return <AccessCodeClient initialLogoUrl={initialLogoUrl} />;
}
