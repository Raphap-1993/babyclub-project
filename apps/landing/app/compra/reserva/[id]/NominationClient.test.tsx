import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NominationPreparation } from "./NominationClient";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

describe("Preparación de entradas según aprobación real", () => {
  it.each(["pending", "unknown", "rejected", "cancelled"] as const)(
    "%s no ofrece una preparación que la API rechaza",
    (status) => {
      const html = renderToStaticMarkup(
        <NominationPreparation
          status={status}
          busy={false}
          preparing={false}
          onPrepare={() => {
            throw new Error("No debe preparar");
          }}
        />,
      );
      expect(html).not.toContain("Preparar mis entradas");
      expect(html).toBe("");
    },
  );
  it.each(["approved", "confirmed", "paid"] as const)(
    "%s permite preparar mediante acción explícita",
    (status) => {
      const action = vi.fn();
      const html = renderToStaticMarkup(
        <NominationPreparation
          status={status}
          busy={false}
          preparing={false}
          onPrepare={action}
        />,
      );
      expect(html).toContain("Preparar mis entradas");
      expect(action).not.toHaveBeenCalled();
    },
  );
});
