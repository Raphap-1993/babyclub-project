import type { SupabaseClient } from "@supabase/supabase-js";

type Supabase = SupabaseClient<any, "public", any>;

export async function logProcessEvent({
  supabase,
  category,
  action,
  status,
  message,
  toEmail,
  provider,
  providerId,
  reservationId,
  ticketId,
  meta,
}: {
  supabase: Supabase | null;
  category: string;
  action: string;
  status: "success" | "error";
  message?: string | null;
  toEmail?: string | null;
  provider?: string | null;
  providerId?: string | null;
  reservationId?: string | null;
  ticketId?: string | null;
  meta?: Record<string, any> | null;
}) {
  if (!supabase) return;
  try {
    await supabase.from("process_logs").insert({
      category,
      action,
      status,
      message: message || null,
      to_email: toEmail || null,
      provider: provider || null,
      provider_id: providerId || null,
      reservation_id: reservationId || null,
      ticket_id: ticketId || null,
      meta: meta || null,
    });
  } catch (_err) {
    // ignore logging errors
  }
}
