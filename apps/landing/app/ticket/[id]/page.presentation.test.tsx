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

describe("TicketPage commercial presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("distingue mesa/box sin mezclarlo con promotor", async () => {
    const { supabase } = createSupabaseMock({
      "tickets.select": [
        {
          data: {
            id: "ticket-table-1",
            event_id: "event-1",
            table_reservation_id: "res-table-1",
            qr_token: "qr-table-1",
            full_name: "Mesa Invitado",
            doc_type: "dni",
            document: "70000011",
            dni: null,
            email: "mesa@test.com",
            phone: "999111222",
            code: {
              code: "TABLE-1",
              type: "table",
              expires_at: null,
              promoter_id: null,
              table_reservation_id: "res-table-1",
            },
            event: {
              name: "Baby Friday",
              location: "Lima",
              starts_at: "2099-02-01T04:00:00.000Z",
              entry_limit: null,
            },
            promoter: null,
          },
          error: null,
        },
        {
          data: {
            table_id: "table-1",
            product_id: "product-1",
            table: { name: "Box 5" },
            product: { name: "Pack Box", items: ["1 Whisky"] },
          },
          error: null,
        },
      ],
      "table_reservations.select": [{ data: null, error: null }],
    });
    (createClient as any).mockReturnValue(supabase);

    const { default: TicketPage } = await import("./page");
    const html = renderToStaticMarkup(
      await TicketPage({
        params: Promise.resolve({ id: "ticket-table-1" }),
      }),
    );

    expect(html).toContain("Mesa / Box");
    expect(html).toContain(
      "Este QR corresponde a un cupo individual de mesa o box.",
    );
    expect(html).not.toContain("QR de mesa / promotor");
    expect(html).toContain("Box 5");
  });

  it("distingue QR promotor sin mezclarlo con mesa", async () => {
    const { supabase } = createSupabaseMock({
      "tickets.select": [
        {
          data: {
            id: "ticket-promoter-1",
            event_id: "event-1",
            table_reservation_id: null,
            qr_token: "qr-promoter-1",
            full_name: "Promo Invitado",
            doc_type: "dni",
            document: "70000012",
            dni: null,
            email: "promo@test.com",
            phone: "999333444",
            code: {
              code: "PROMO-1",
              type: "courtesy",
              expires_at: null,
              promoter_id: "promoter-1",
              table_reservation_id: null,
            },
            event: {
              name: "Baby Friday",
              location: "Lima",
              starts_at: "2099-02-01T04:00:00.000Z",
              entry_limit: null,
            },
            promoter: {
              code: "MARIA",
              person: { first_name: "Maria", last_name: "Promo" },
            },
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
    });
    (createClient as any).mockReturnValue(supabase);

    const { default: TicketPage } = await import("./page");
    const html = renderToStaticMarkup(
      await TicketPage({
        params: Promise.resolve({ id: "ticket-promoter-1" }),
      }),
    );

    expect(html).toContain("QR promotor");
    expect(html).toContain(
      "Este QR no tiene límite de hora de ingreso.",
    );
    expect(html).not.toContain("QR de mesa / promotor");
    expect(html).toContain("Maria Promo");
  });
});
