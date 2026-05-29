import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RegistroHero } from "./RegistroHero";

describe("RegistroHero", () => {
  it("renders the BABY brand with the provided logo before the registration title", () => {
    const html = renderToStaticMarkup(
      <RegistroHero logoUrl="https://cdn.example.com/baby-logo.png" />,
    );

    expect(html).toContain("BABY");
    expect(html).toContain("Registro");
    expect(html).toContain('alt="BABY"');
    expect(html).toContain("cdn.example.com/baby-logo.png");
  });
});
