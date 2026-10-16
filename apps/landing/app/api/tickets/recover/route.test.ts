import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "shared/security/rateLimit";
import { emailLookup, recoveryEmail, recoveryKey } from "./recovery";

const mocks = vi.hoisted(() => ({
  tasks: [] as (() => Promise<void>)[],
  send: vi.fn(),
  queries: [] as any[],
  from: vi.fn(),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => mocks.tasks.push(task),
}));
vi.mock("shared/email/resend", () => ({ sendEmail: mocks.send }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mocks.from }),
}));
import { POST } from "./route";

const request = (email: unknown) =>
  new NextRequest("https://babyclubaccess.com/api/tickets/recover", {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: { "x-forwarded-for": "127.0.0.1" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStore();
  mocks.tasks.length = 0;
  mocks.queries.length = 0;
  process.env.SUPABASE_URL = "http://127.0.0.1:64321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-key";
  mocks.from.mockImplementation((table: string) => {
    const query: any = { data: [], error: null };
    for (const method of ["select", "ilike", "is", "eq", "or", "order"])
      query[method] = vi.fn(() => query);
    query.limit = vi.fn(async () => ({ data: query.data, error: query.error }));
    mocks.queries.push({ table, query });
    return query;
  });
});
describe("private ticket recovery", () => {
  it("escapes LIKE wildcards and never embeds raw HTML", () => {
    expect(emailLookup("a_b%z@example.com")).toBe("a\\_b\\%z@example.com");
    expect(
      recoveryEmail([{ label: "<script>", url: 'https://example.com/"' }]).html,
    ).not.toContain("<script>");
  });
  it("uses a case-insensitive, private idempotency key per 20 minute window", () => {
    expect(recoveryKey("A@example.com", 1)).toBe(
      recoveryKey("a@example.com", 2),
    );
    expect(recoveryKey("a@example.com", 1)).not.toBe(
      recoveryKey("a@example.com", 1_200_001),
    );
    expect(recoveryKey("a@example.com")).not.toContain("a@example.com");
  });
  it.each([
    "",
    "bad",
    "a@example.com,b@example.com",
    "a@example.com\r\nBcc:x@y.com",
  ])("rejects invalid recipient %s", async (email) => {
    expect((await POST(request(email))).status).toBe(400);
    expect(mocks.tasks).toHaveLength(0);
  });
  it("returns the same generic response before checking for purchases", async () => {
    const response = await POST(request("customer@example.com"));
    expect(response.status).toBe(202);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      message: expect.stringContaining("Si hay entradas"),
    });
    await mocks.tasks[0]();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.queries[0].query.eq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.queries[0].query.or).toHaveBeenCalledWith(
      "payment_status.is.null,payment_status.eq.paid",
    );
    expect(mocks.queries[1].query.eq).toHaveBeenCalledWith(
      "status",
      "approved",
    );
    for (const { query } of mocks.queries) {
      expect(query.ilike).toHaveBeenCalledWith("email", "customer@example.com");
      expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    }
  });
  it("sends only matching ticket and buyer reservation links to the registered recipient", async () => {
    mocks.from.mockImplementationOnce(() => {
      const q: any = {};
      for (const method of ["select", "ilike", "is", "eq", "or", "order"])
        q[method] = () => q;
      q.limit = async () => ({
        data: [
          { id: "ticket-1", table_reservation_id: "someone-elses-purchase" },
        ],
        error: null,
      });
      return q;
    });
    await POST(request("Customer@example.com"));
    await mocks.tasks[0]();
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        idempotencyKey: expect.any(String),
      }),
    );
    const payload = mocks.send.mock.calls[0][0];
    expect(payload.text).toContain("/ticket/ticket-1");
    expect(payload.text).not.toContain("someone-elses-purchase");
  });
  it("suppresses repeated recipient requests without exposing the limit or existence", async () => {
    const first = await POST(request("a@example.com"));
    const second = await POST(request("A@example.com"));
    expect(await first.json()).toEqual(await second.json());
    expect(mocks.tasks).toHaveLength(1);
  });
  it("limits requests per IP", async () => {
    for (let i = 0; i < 5; i++) await POST(request(`a${i}@example.com`));
    expect((await POST(request("another@example.com"))).status).toBe(429);
  });
});
