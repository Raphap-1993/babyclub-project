import { getEntryCutoff } from "./entryLimit";

export type TicketAccessState = {
  state: "ready" | "used" | "inactive" | "expired" | "pending";
  reason: string | null;
  expiredAt: string | null;
};

export function getTicketAccessState({
  ticket,
  code,
  event,
  unit,
  now = new Date(),
}: {
  ticket: {
    used?: boolean | null;
    is_active?: boolean | null;
    deleted_at?: string | null;
    payment_status?: string | null;
  };
  code?: { type?: string | null; expires_at?: string | null } | null;
  event: {
    starts_at?: string | null;
    entry_limit?: string | null;
    is_active?: boolean | null;
    closed_at?: string | null;
    deleted_at?: string | null;
  } | null;
  unit?: { status?: string | null; deleted_at?: string | null } | null;
  now?: Date;
}): TicketAccessState {
  const result = (
    state: TicketAccessState["state"],
    reason: string | null = null,
    expiredAt: string | null = null,
  ): TicketAccessState => ({ state, reason, expiredAt });
  if (ticket.used || unit?.status === "used")
    return result("used", "already_used");
  if (
    ticket.is_active === false ||
    ticket.deleted_at ||
    unit?.deleted_at ||
    unit?.status === "cancelled"
  )
    return result("inactive", "ticket_inactive");
  if (
    !event ||
    event.is_active === false ||
    event.closed_at ||
    event.deleted_at
  )
    return result("inactive", "event_inactive");
  if (String(ticket.payment_status || "").toLowerCase() === "pending")
    return result("pending", "payment_pending");
  if (unit?.status === "expired") return result("expired", "ticket_expired");
  if (unit && unit.status !== "issued")
    return result("pending", "nomination_required");
  // Code activity/quota govern issuance. Existing individual tickets keep their own validity.
  const cutoff =
    code?.type?.toLowerCase() === "general" && event.starts_at
      ? getEntryCutoff(event.starts_at, event.entry_limit)?.cutoff
      : null;
  const expiry = code?.expires_at ? new Date(code.expires_at) : null;
  if (
    cutoff &&
    now.getTime() > cutoff.toMillis() &&
    (!expiry || cutoff.toMillis() <= expiry.getTime())
  ) {
    return result("expired", "entry_cutoff", cutoff.toUTC().toISO());
  }
  if (expiry && now.getTime() > expiry.getTime())
    return result("expired", "ticket_expired", expiry.toISOString());
  if (cutoff && now.getTime() > cutoff.toMillis())
    return result("expired", "entry_cutoff", cutoff.toUTC().toISO());
  return result("ready");
}
