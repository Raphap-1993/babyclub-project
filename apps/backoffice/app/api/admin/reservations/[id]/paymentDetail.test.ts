import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../../../tests/utils/supabaseMock";

vi.mock("shared/auth/requireStaff", () => ({ requireStaffRole: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("../../../reservations/update/route", () => ({ POST: vi.fn() }));
const { createClient } = await import("@supabase/supabase-js");
const { requireStaffRole } = await import("shared/auth/requireStaff");

describe("reservation payment references", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });
  it("returns approved payment references only to authenticated staff, without caching", async () => {
    vi.mocked(requireStaffRole).mockResolvedValue({
      ok: true,
      context: { staffId: "staff-1" },
    } as any);
    const { supabase, calls } = createSupabaseMock({
      "table_reservations.select": {
        data: { id: "res-1", sale_origin: "ticket", status: "approved" },
        error: null,
      },
      "payments.select": {
        data: [
          {
            provider: "mercadopago",
            status: "paid",
            amount: 2500,
            charge_id: "payment-123",
            order_id: "order-456",
            receipt_number: "BC-MP-123",
            paid_at: "2026-10-16T17:00:00Z",
          },
        ],
        error: null,
      },
    });
    vi.mocked(createClient).mockReturnValue(supabase as any);
    const { GET } = await import("./route");
    const response = await GET({} as any, {
      params: Promise.resolve({ id: "res-1" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).reservation.payment).toMatchObject({
      state: "paid",
      chargeId: "payment-123",
      orderId: "order-456",
      receiptNumber: "BC-MP-123",
    });
    expect(calls.find((c) => c.table === "payments")?.filters).toContainEqual({
      type: "eq",
      args: ["reservation_id", "res-1"],
    });
    expect(calls.every((c) => c.op === "select")).toBe(true);
  });
  it("does not read payment references for anonymous requests", async () => {
    vi.mocked(requireStaffRole).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Auth requerido",
    });
    const { GET } = await import("./route");
    expect(
      (await GET({} as any, { params: Promise.resolve({ id: "res-1" }) }))
        .status,
    ).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });
});
