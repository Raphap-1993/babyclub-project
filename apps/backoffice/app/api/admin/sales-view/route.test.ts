import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  reservations: vi.fn(),
  tickets: vi.fn(),
  ticket: vi.fn(),
}));
vi.mock("shared/auth/requireStaff", () => ({ requireStaffRole: mocks.guard }));
vi.mock("../../../admin/reservations/reservationData", () => ({
  getReservations: mocks.reservations,
}));
vi.mock("../../../admin/tickets/ticketData", () => ({
  getAdminTicketList: mocks.tickets,
}));
vi.mock("../../../admin/tickets/ticketDetailData", () => ({
  getTicket: mocks.ticket,
}));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({
    ok: false,
    status: 401,
    error: "Auth requerido",
  });
});
describe("protected sales views", () => {
  it("does not query customers, payments or QR before authenticating", async () => {
    for (const view of ["reservations", "tickets", "ticket"]) {
      const response = await GET(
        new NextRequest("http://localhost/api/admin/sales-view?view=" + view),
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mocks.reservations).not.toHaveBeenCalled();
    expect(mocks.tickets).not.toHaveBeenCalled();
    expect(mocks.ticket).not.toHaveBeenCalled();
  });
  it("passes filters only after staff authorization and disables caching", async () => {
    mocks.guard.mockResolvedValue({ ok: true });
    mocks.tickets.mockResolvedValue({ tickets: [], filters: {} });
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/sales-view?view=tickets&kind=invitations",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.tickets).toHaveBeenCalledWith({
      view: "tickets",
      kind: "invitations",
    });
    expect(response.headers.get("vary")).toBe("Authorization");
  });
});
