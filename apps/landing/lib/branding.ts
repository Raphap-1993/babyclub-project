import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function getBranding() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { logo_url: null };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data } = await supabase
    .from("brand_settings")
    .select("logo_url")
    .eq("id", 1)
    .maybeSingle();

  return { logo_url: data?.logo_url || null };
}
