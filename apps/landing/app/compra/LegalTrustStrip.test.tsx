import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LegalTrustStrip } from "./LegalTrustStrip";

describe("LegalTrustStrip", () => {
  it("separates the trust copy from the legal links for tighter mobile layout", () => {
    const html = renderToStaticMarkup(<LegalTrustStrip />);

    expect(html).toContain("Compra validada por BABY");
    expect(html).toContain("Entradas digitales y reservas de mesa BABY");
    expect(html).toContain('aria-label="Enlaces legales BABY"');
    expect(html).toContain("Términos");
    expect(html).toContain("Privacidad");
  });
});
