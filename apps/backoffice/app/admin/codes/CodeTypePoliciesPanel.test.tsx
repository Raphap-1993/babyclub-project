import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CodeTypePoliciesPanel } from "./CodeTypePoliciesPanel";

describe("CodeTypePoliciesPanel", () => {
  it("renderiza la lista de tipos soportados y la accion de guardado", () => {
    const html = renderToStaticMarkup(
      <CodeTypePoliciesPanel
        policies={[
          { code_type: "courtesy", requires_expiration: false },
          { code_type: "promoter", requires_expiration: true },
          { code_type: "table", requires_expiration: false },
        ]}
        saving={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain("Cortesía");
    expect(html).toContain("Promotor");
    expect(html).toContain("Mesa");
    expect(html).toContain("Guardar políticas");
  });
});
