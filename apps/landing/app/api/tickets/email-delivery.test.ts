import { beforeEach, expect, it, vi } from "vitest";
import { createSupabaseMock } from "../../../../../tests/utils/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("shared/email/resend", () => ({ sendEmail: vi.fn() }));
const { createClient } = await import("@supabase/supabase-js");
const { sendEmail } = await import("shared/email/resend");

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  const { supabase } = createSupabaseMock({
    "codes.select": {
      data: {
        id: "code-1",
        code: "ENTRY-1",
        event_id: "event-1",
        is_active: true,
        max_uses: 999,
        uses: 0,
      },
      error: null,
    },
    "events.select": [
      { data: null, error: null },
      {
        data: {
          id: "event-1",
          name: "Evento <Demo>",
          location: "Sala <Demo>",
          is_active: true,
          closed_at: null,
          sale_status: "on_sale",
          starts_at: "2099-02-01T04:00:00.000Z",
        },
        error: null,
      },
    ],
    "persons.select": { data: null, error: null },
    "persons.insert": { data: { id: "person-1" }, error: null },
    "tickets.select": { data: null, error: null },
    "tickets.insert": { data: { id: "ticket-1" }, error: null },
  });
  (createClient as any).mockReturnValue(supabase);
});

async function registerTicket() {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "ENTRY-1",
        doc_type: "dni",
        document: "12345678",
        nombre: "Ana",
        apellido_paterno: "Demo",
        apellido_materno: "Demo",
        email: "ana@example.test",
        telefono: "+51999999999",
        birthdate: "1999-01-01",
      }),
    }) as any,
  );
}

it.each(["structured", "throw"])(
  "preserva ticket e informa fallo de correo %s sin revelar error del proveedor",
  async (kind) => {
    const providerError = "Sensitive provider detail";
    if (kind === "structured")
      (sendEmail as any).mockResolvedValue({
        data: null,
        error: { message: providerError },
      });
    else (sendEmail as any).mockRejectedValue(new Error(providerError));
    const response = await registerTicket();
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.ticketId).toBe("ticket-1");
    expect(result.emailSent).toBe(false);
    expect(result.emailError).toContain("ticket sigue disponible");
    expect(result.emailError).not.toContain(providerError);
  },
);

it("envía enlace a la entrada vigente sin QR externo y escapa texto del evento", async () => {
  (sendEmail as any).mockResolvedValue({
    data: { id: "message-1" },
    error: null,
  });
  const response = await registerTicket();
  expect((await response.json()).emailSent).toBe(true);
  const payload = (sendEmail as any).mock.calls[0][0];
  expect(payload.html).not.toContain("api.qrserver.com");
  expect(payload.html).toContain("Evento &lt;Demo&gt;");
  expect(payload.html).toContain("Ver entrada");
});
