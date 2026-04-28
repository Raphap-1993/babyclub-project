import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PaymentServiceError } from "./errors";

export type PaymentSupabaseClient = SupabaseClient<any, any, any>;

export function createPaymentsAdminClient(): PaymentSupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new PaymentServiceError("Supabase config missing", 500);
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
