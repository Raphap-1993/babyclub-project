import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  supabaseClient: null,
}));

import { CodeTypePoliciesPanel } from "./CodeTypePoliciesPanel";
import { GenerateBatchModal } from "./CodesClient";

describe("CodeTypePoliciesPanel", () => {
  it("muestra los tipos soportados aunque falten filas en la base", () => {
    const html = renderToStaticMarkup(
      <CodeTypePoliciesPanel
        policies={[{ code_type: "promoter", requires_expiration: true }]}
        loading={false}
        savingCodeType={null}
        error={null}
        onToggle={() => {}}
      />,
    );

    expect(html).toContain("Cortesía");
    expect(html).toContain("Promotor");
    expect(html).toContain("Mesa");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
  });
});

describe("GenerateBatchModal", () => {
  it("muestra el campo de expiracion para capturar expires_at", () => {
    const html = renderToStaticMarkup(
      <GenerateBatchModal
        events={[{ id: "event-1", name: "Evento 1" }]}
        promoters={[{ id: "promoter-1", name: "Promotor 1" }]}
        defaultEventId="event-1"
        requiresExpiration={true}
        onClose={() => {}}
        onCreated={() => {}}
      />,
    );

    expect(html).toContain("Expiración");
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain("required");
  });
});
