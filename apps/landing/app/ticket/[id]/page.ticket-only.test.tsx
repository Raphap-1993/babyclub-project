import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("./EmailSender", () => ({
  EmailSender: ({ defaultEmail }: { defaultEmail: string | null }) => (
    <div data-testid="email-sender">{defaultEmail || ""}</div>
  ),
}));
vi.mock("./TicketDownloader", () => ({
  TicketDownloader: ({ ticketId }: { ticketId: string }) => (
    <button type="button">{ticketId}</button>
  ),
}));
vi.mock("../../legal/LegalFooterLinks", () => ({
  LegalFooterLinks: () => <div data-testid="legal-footer" />,
}));

const { createClient } = await import("@supabase/supabase-js");

describe("TicketPage ticket-only presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("muestra tipo de entrada y evita copy de mesa/promotor para reservas ticket-only", async () => {
    const { supabase } = createSupabaseMock({
      "tickets.select": [
        {
          data: {
            id: "ticket-1",
            event_id: "event-1",
            table_reservation_id: "res-ticket-1",
            qr_token: "qr-token-1",
            full_name: "Smoke Unit 1",
            doc_type: "dni",
            document: "70000001",
            dni: null,
            email: null,
            phone: null,
            code: {
              code: "CODE-1",
              type: "courtesy",
              expires_at: null,
              promoter_id: null,
              table_reservation_id: "res-ticket-1",
            },
            event: {
              name: "SMOKE REQ-0012",
              location: "Local QA",
              starts_at: "2099-02-01T04:00:00.000Z",
              entry_limit: null,
            },
            promoter: null,
          },
          error: null,
        },
        {
          data: {
            table_id: null,
            product_id: null,
            table: null,
            product: null,
          },
          error: null,
        },
      ],
      "table_reservations.select": [
        {
          data: {
            codes: ["CODE-1", "CODE-2"],
            sale_origin: "ticket",
            ticket_type_label: "Smoke Trio",
            table: null,
            product: null,
          },
          error: null,
        },
        {
          data: {
            codes: ["CODE-1", "CODE-2"],
            status: "approved",
            full_name: "Comprador Principal",
            email: "buyer@test.com",
            phone: "999999999",
            document: "12345678",
          },
          error: null,
        },
        {
          data: {
            id: "res-ticket-1",
            status: "approved",
            sale_origin: "ticket",
            full_name: "Smoke Unit 1",
            email: null,
            phone: null,
            document: "70000001",
          },
          error: null,
        },
      ],
      "ticket_reservation_units.select": [
        {
          data: [
            {
              unit_index: 1,
              status: "issued",
              ticket_id: "ticket-1",
            },
            {
              unit_index: 2,
              status: "pending_nomination",
              ticket_id: null,
            },
          ],
          error: null,
        },
      ],
    });
    (createClient as any).mockReturnValue(supabase);

    const { default: TicketPage } = await import("./page");
    const html = renderToStaticMarkup(
      await TicketPage({
        params: Promise.resolve({ id: "ticket-1" }),
      }),
    );

    expect(html).toContain("Smoke Trio");
    expect(html).not.toContain("Reserva de mesa");
    expect(html).not.toContain("QR de mesa / promotor");
    expect(html).toContain("Completar asistentes");
    expect(html).toContain("/compra?reservationId=res-ticket-1");
  });
});
