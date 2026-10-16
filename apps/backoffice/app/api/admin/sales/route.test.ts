import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("shared/auth/requireStaff", () => ({ requireStaffRole: mocks.guard }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));
import { POST } from "./route";
const payload = {
  request_id: "10000000-0000-4000-8000-000000000001",
  event_id: "20000000-0000-4000-8000-000000000001",
  ticket_type_code: "all_night_1",
  package_quantity: 1,
  expected_amount_cents: 4000,
  full_name: "Comprador Prueba",
  doc_type: "dni",
  document: "00000001",
  email: "prueba@example.com",
  phone: "999000000",
  payment_method: "cash",
  received: true,
};
const request = (body: any) =>
  new NextRequest("http://localhost/api/admin/sales", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:64321");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-local");
  mocks.guard
    .mockReset()
    .mockResolvedValue({
      ok: true,
      context: { staffId: "authenticated-staff", role: "admin" },
    });
  mocks.rpc
    .mockReset()
    .mockResolvedValue({
      data: { reservationId: "res", ticketId: "ticket", replayed: false },
      error: null,
    });
});
describe("manual sale authorization and receipt", () => {
  it("rejects unauthenticated staff and never uses the service client", async () => {
    mocks.guard.mockResolvedValue({
      ok: false,
      status: 403,
      error: "No autorizado",
    });
    expect((await POST(request(payload))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.guard).toHaveBeenCalledWith(expect.anything(), [
      "admin",
      "superadmin",
    ]);
  });
  it("requires explicit payment receipt, valid document, email and positive configured quote", async () => {
    for (const changes of [
      { received: false },
      { document: "123" },
      { email: "bad" },
      { expected_amount_cents: 0 },
      { package_quantity: 11 },
      { payment_method: "mercadopago" },
      { payment_method: "transfer", reference: "" },
    ]) {
      expect((await POST(request({ ...payload, ...changes }))).status).toBe(
        400,
      );
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("binds the receipt to the authenticated administrator and ignores forged fields", async () => {
    const response = await POST(
      request({
        ...payload,
        created_by_staff_id: "attacker",
        price: 1,
        payment_status: "paid",
      }),
    );
    expect(response.status).toBe(200);
    const args = mocks.rpc.mock.calls[0][1];
    expect(args.p_staff).toBe("authenticated-staff");
    expect(args.p_payload.price).toBeUndefined();
    expect(args.p_payload.payment_status).toBeUndefined();
    expect(args.p_payload.expected_amount_cents).toBe(4000);
  });
  it("reports inventory conflicts without suggesting a new payment", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "reservation_table_active" },
    });
    expect(
      (
        await POST(
          request({
            ...payload,
            table_id: "30000000-0000-4000-8000-000000000001",
            product_id: "40000000-0000-4000-8000-000000000001",
          }),
        )
      ).status,
    ).toBe(409);
  });
  it("returns idempotent result for an already recorded sale", async () => {
    mocks.rpc.mockResolvedValue({
      data: { reservationId: "res", ticketId: "ticket", replayed: true },
      error: null,
    });
    expect((await (await POST(request(payload))).json()).replayed).toBe(true);
  });
});
