import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccessModeToggle } from "./AccessModeToggle";

describe("AccessModeToggle", () => {
  it("muestra ambos modos y resalta acceso por defecto", () => {
    const html = renderToStaticMarkup(
      <AccessModeToggle mode="access" onModeChange={() => undefined} />,
    );

    expect(html).toContain("Entrar");
    expect(html).toContain("Nominación");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("bg-white text-black");
  });

  it("resalta nominación cuando ese modo está activo", () => {
    const html = renderToStaticMarkup(
      <AccessModeToggle mode="nomination" onModeChange={() => undefined} />,
    );

    expect(html).toContain("Nominación");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("bg-white text-black");
  });
});
