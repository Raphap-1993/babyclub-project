import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("shared/auth/requireStaff", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("../../reservations/email", () => ({
  sendTicketEmail: vi.fn(),
}));

const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");
const { sendTicketEmail } = await import("../../reservations/email");

describe("POST /api/tickets/send-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("does not expose provider quota errors to the backoffice modal", async () => {
    (requireStaffRole as any).mockResolvedValue({
      ok: true,
      context: { role: "admin" },
    });
    (createClient as any).mockReturnValue({});
    (sendTicketEmail as any).mockRejectedValue(
      new Error("You have reached your daily email sending quota."),
    );

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tickets/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: "ticket-1", email: "ana@test.com" }),
    });

    const res = await POST(req as any);
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(String(payload.error || "")).not.toContain("daily email sending quota");
    expect(String(payload.error || "")).toContain("ticket sigue disponible");
  });
});
