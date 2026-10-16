import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "shared/security/rateLimit";
import { deviceHash, sealIdentity } from "../../../lib/customerAccessCrypto";

const mock = vi.hoisted(() => ({
  tasks: [] as (() => Promise<void>)[],
  rpc: vi.fn(),
  from: vi.fn(),
  send: vi.fn(),
  find: vi.fn(),
  wallet: vi.fn(),
  tableData: null as any,
  tableError: null as any,
  queries: [] as any[],
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => mock.tasks.push(task),
}));
vi.mock("../../../lib/mercadopagoRoute", () => ({
  mercadoPagoDatabase: () => ({ rpc: mock.rpc, from: mock.from }),
}));
vi.mock("../../../lib/customerTickets", () => ({
  findCustomerIdentity: mock.find,
  readCustomerWallet: mock.wallet,
}));
vi.mock("shared/email/resend", () => ({ sendEmail: mock.send }));
import { GET, POST } from "./route";
const base = "https://babyclubaccess.com";
const token = "ab".repeat(32);
const challenge = "00000000-0000-4000-8000-000000000001:" + "cd".repeat(32);
const req = (body?: any, cookie = "", origin = base) =>
  new NextRequest(base + "/api/customer-access", {
    method: body ? "POST" : "GET",
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: { origin, cookie, "x-forwarded-for": "127.0.0.1" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStore();
  mock.tasks.length = 0;
  mock.queries.length = 0;
  process.env.CUSTOMER_ACCESS_SECRET = "12".repeat(32);
  mock.tableData = null;
  mock.tableError = null;
  mock.rpc.mockResolvedValue({ data: true, error: null });
  mock.find.mockResolvedValue({
    dni: "00001234",
    email: "customer@example.com",
  });
  mock.wallet.mockResolvedValue({
    event: { name: "Next" },
    tickets: [],
    reservations: [],
  });
  mock.from.mockImplementation((table: string) => {
    const q: any = {};
    for (const m of ["select", "update", "eq", "is", "gt"])
      q[m] = vi.fn(() => q);
    q.maybeSingle = async () => ({
      data: mock.tableData,
      error: mock.tableError,
    });
    q.then = (resolve: any) =>
      Promise.resolve({ error: mock.tableError }).then(resolve);
    mock.queries.push({ table, q });
    return q;
  });
});
describe("verified customer access", () => {
  it("never exposes a wallet without a verified cookie", async () => {
    const r = await GET(req());
    expect(r.status).toBe(401);
    expect(mock.wallet).not.toHaveBeenCalled();
  });
  it("rejects cross-origin changes", async () => {
    expect(
      (
        await POST(
          req(
            { action: "lookup", dni: "00001234" },
            "",
            "https://evil.example",
          ),
        )
      ).status,
    ).toBe(403);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it.each(["123", "123456789", "a0001234", "00001234,other"])(
    "validates DNI %s before querying",
    async (dni) => {
      expect((await POST(req({ action: "lookup", dni }))).status).toBe(400);
      expect(mock.tasks).toHaveLength(0);
    },
  );
  it("returns a generic challenge with no email, identity or QR before asynchronous lookup", async () => {
    const r = await POST(req({ action: "lookup", dni: "00001234" }));
    expect(r.status).toBe(202);
    const payload = await r.json();
    expect(payload).toMatchObject({ verified: false, resendAfter: 60 });
    expect(JSON.stringify(payload)).not.toMatch(
      /customer@example|00001234|qr_token/,
    );
    expect(mock.find).not.toHaveBeenCalled();
    expect(r.headers.get("set-cookie")).toContain("HttpOnly");
    expect(r.headers.get("set-cookie")).toContain("Secure");
    await mock.tasks[0]();
    expect(mock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        subject: "Tu código para acceder a BABY",
      }),
    );
    expect(mock.wallet).not.toHaveBeenCalled();
  });
  it("keeps the same public response for unknown DNI and sends no email", async () => {
    mock.find.mockResolvedValue(null);
    const r = await POST(req({ action: "lookup", dni: "00001234" }));
    expect(r.status).toBe(202);
    await mock.tasks[0]();
    expect(mock.send).not.toHaveBeenCalled();
  });
  it("does not send when the persistent database throttle rejects the challenge", async () => {
    mock.rpc.mockResolvedValue({ data: false, error: null });
    await POST(req({ action: "lookup", dni: "00001234" }));
    await mock.tasks[0]();
    expect(mock.find).not.toHaveBeenCalled();
    expect(mock.send).not.toHaveBeenCalled();
  });
  it("requires the browser challenge cookie and a six digit code", async () => {
    expect((await POST(req({ action: "verify", code: "123456" }))).status).toBe(
      400,
    );
    expect(
      (
        await POST(
          req(
            { action: "verify", code: "abc" },
            "baby_access_challenge=" + challenge,
          ),
        )
      ).status,
    ).toBe(400);
  });
  it("rejects wrong, consumed, expired or exhausted challenges without issuing a session", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: null });
    const r = await POST(
      req(
        { action: "verify", code: "123456" },
        "baby_access_challenge=" + challenge,
      ),
    );
    expect(r.status).toBe(401);
    expect(r.headers.get("set-cookie")).toBeNull();
  });
  it("issues an opaque secure cookie after atomic verification, never a DNI cookie", async () => {
    mock.rpc.mockResolvedValue({ data: "encrypted-identity", error: null });
    const r = await POST(
      req(
        { action: "verify", code: "123456", remember: true },
        "baby_access_challenge=" + challenge,
      ),
    );
    expect(r.status).toBe(200);
    const cookies = r.headers.get("set-cookie") || "";
    expect(cookies).toContain("__Host-baby_access=");
    expect(cookies).toContain("Max-Age=2592000");
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("SameSite=strict");
    expect(cookies).not.toContain("00001234");
    expect(mock.rpc.mock.calls[0][1].p_code_hash).not.toContain("123456");
  });
  it("loads the upcoming wallet using only the server-verified identity", async () => {
    mock.tableData = {
      identity_encrypted: sealIdentity({
        dni: "00001234",
        email: "customer@example.com",
      }),
    };
    const r = await GET(req(undefined, "__Host-baby_access=" + token));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(mock.wallet).toHaveBeenCalledWith(expect.anything(), {
      dni: "00001234",
      email: "customer@example.com",
    });
    expect(mock.queries[0].q.eq).toHaveBeenCalledWith(
      "token_hash",
      deviceHash(token),
    );
    expect(mock.queries[0].q.is).toHaveBeenCalledWith("revoked_at", null);
    expect(mock.queries[0].q.gt).toHaveBeenCalledWith(
      "expires_at",
      expect.any(String),
    );
  });
  it("does not send another OTP for the same DNI on a verified device", async () => {
    mock.tableData = {
      identity_encrypted: sealIdentity({
        dni: "00001234",
        email: "customer@example.com",
      }),
    };
    const r = await POST(
      req({ action: "lookup", dni: "00001234" }, "__Host-baby_access=" + token),
    );
    expect(r.status).toBe(200);
    expect(mock.tasks).toHaveLength(0);
    expect(mock.send).not.toHaveBeenCalled();
  });
  it("requires fresh verification when the DNI changes", async () => {
    mock.tableData = {
      identity_encrypted: sealIdentity({
        dni: "00001234",
        email: "customer@example.com",
      }),
    };
    const r = await POST(
      req({ action: "lookup", dni: "99999999" }, "__Host-baby_access=" + token),
    );
    expect(r.status).toBe(202);
    expect(mock.wallet).not.toHaveBeenCalled();
  });
  it("does not persist the cookie when remembering a device is disabled", async () => {
    mock.rpc.mockResolvedValue({ data: "encrypted-identity", error: null });
    const r = await POST(
      req(
        { action: "verify", code: "123456", remember: false },
        "baby_access_challenge=" + challenge,
      ),
    );
    expect(r.status).toBe(200);
    const sessionCookie =
      (r.headers.get("set-cookie") || "")
        .split(",")
        .find((part) => part.includes("__Host-baby_access=")) || "";
    expect(sessionCookie).not.toContain("Max-Age");
    expect(mock.queries[0].q.update).toHaveBeenCalledWith({
      expires_at: expect.any(String),
    });
  });
  it("fails closed for a corrupt or rotated device identity", async () => {
    mock.tableData = { identity_encrypted: "corrupt" };
    expect(
      (await GET(req(undefined, "__Host-baby_access=" + token))).status,
    ).toBe(401);
    expect(mock.wallet).not.toHaveBeenCalled();
  });
  it("revokes the device in the database and removes both cookies on logout", async () => {
    const r = await POST(
      req({ action: "logout" }, "__Host-baby_access=" + token),
    );
    expect(r.status).toBe(200);
    expect(mock.queries[0].q.update).toHaveBeenCalledWith({
      revoked_at: expect.any(String),
    });
    expect(r.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
