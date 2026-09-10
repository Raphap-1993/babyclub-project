import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const db = vi.hoisted(() => ({
  ticket: {} as any,
  unit: null as any,
  unitError: null as any,
  selects: [] as string[],
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      let columns = "";
      const query = {
        select(value: string) {
          columns = value;
          db.selects.push(value);
          return query;
        },
        eq() {
          return query;
        },
        maybeSingle: async () =>
          table === "ticket_reservation_units"
            ? { data: db.unit, error: db.unitError }
            : {
                data: columns.includes("qr_token") ? db.ticket : null,
                error: null,
              },
      };
      return query;
    },
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("./EmailSender", () => ({
  EmailSender: () =>
    React.createElement("div", {}, "Enviar entrada por correo"),
}));
vi.mock("./TicketDownloader", () => ({
  TicketDownloader: () =>
    React.createElement("button", {}, "Descargar entrada"),
}));
vi.mock("../../legal/LegalFooterLinks", () => ({
  LegalFooterLinks: () => null,
}));
vi.mock("shared/ticketReservationWorkspace", () => ({
  isReservationOwner: () => false,
  resolveTicketReservationWorkspaceContext: async () => ({
    pendingAssistantCount: 0,
    nominationUrl: null,
  }),
}));

let TicketPage: typeof import("./page").default;
beforeAll(async () => {
  vi.stubGlobal("React", React);
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only-not-a-real-key");
  TicketPage = (await import("./page")).default;
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-19T02:00:00Z"));
  db.ticket = {
    id: "ticket-example",
    event_id: "event-example",
    table_reservation_id: null,
    qr_token: "fixture-personal-qr-token",
    used: false,
    is_active: true,
    deleted_at: null,
    payment_status: "paid",
    full_name: "Persona Ejemplo",
    code: { code: "EJEMPLO", type: "free", expires_at: "2026-09-19T05:00:00Z" },
    event: {
      name: "Evento Ejemplo",
      starts_at: "2026-09-19T03:00:00Z",
      is_active: true,
    },
  };
  db.unit = { status: "issued", deleted_at: null };
  db.unitError = null;
  db.selects = [];
});
const render = async () =>
  renderToStaticMarkup(
    await TicketPage({ params: Promise.resolve({ id: "ticket-example" }) }),
  );

describe("Ticket público: acceso real y QR privado", () => {
  it("genera un PNG local sólo para la entrada válida", async () => {
    const html = await render();
    expect(html).toContain("Tu QR está listo");
    expect(html).toContain("data:image/png;base64,");
    expect(html).toContain("Descargar entrada");
    expect(html).toContain("Enviar entrada por correo");
    expect(html).not.toContain("api.qrserver.com");
    expect(html).not.toContain(db.ticket.qr_token);
    expect(db.selects[0]).toContain("used,is_active,deleted_at,payment_status");
  });
  it.each([
    ["used", "Entrada utilizada"],
    ["inactive", "Entrada no disponible"],
    ["expired", "Entrada vencida"],
    ["pending", "Entrada pendiente"],
    ["cancelled", "Entrada no disponible"],
  ])(
    "%s conserva la información sin QR, descarga ni reenvío",
    async (state, label) => {
      if (state === "used") db.ticket.used = true;
      if (state === "inactive") db.ticket.is_active = false;
      if (state === "expired")
        db.ticket.code.expires_at = "2026-09-19T01:00:00Z";
      if (state === "pending") db.ticket.payment_status = "pending";
      if (state === "cancelled") db.unit.status = "cancelled";
      const html = await render();
      expect(html).toContain(label);
      expect(html).toContain("Persona Ejemplo");
      expect(html).not.toContain("data:image/png");
      expect(html).not.toContain("Descargar entrada");
      expect(html).not.toContain("Enviar entrada por correo");
    },
  );
  it("sin token conserva el detalle sin producir una imagen inválida ni error de página", async () => {
    db.ticket.qr_token = "";
    const html = await render();
    expect(html).toContain("Entrada pendiente");
    expect(html).not.toContain("data:image/png");
  });
  it("el vencido ofrece comprar para el mismo evento junto al aviso", async () => {
    db.ticket.code.expires_at = "2026-09-19T01:00:00Z";
    const html = await render();
    expect(html).toContain('href="/compra?event_id=event-example"');
    expect(html.indexOf("Comprar otra entrada")).toBeLessThan(
      html.indexOf("Evento Ejemplo"),
    );
    expect(html).not.toContain("filtrado");
  });
  it("si falla la comprobación de unidad no promete un QR válido", async () => {
    db.unitError = { message: "fixture read unavailable" };
    const html = await render();
    expect(html).toContain("Entrada pendiente");
    expect(html).not.toContain("data:image/png");
  });
});
