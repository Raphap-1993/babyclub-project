import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import AsistenciaPage from "../asistencia/page";
import IngresosPage from "../ingresos/page";
import MesasPage from "./mesas/page";
import PromotoresPage from "./promotores/page";
import LiquidacionesPage from "./liquidaciones/page";
import {
  legacyReportHref,
  reportPage,
  reportSelectionQuery,
  reportView,
} from "./navigation";

// These legacy bookmarks must keep the user's event and promoter selection.
describe("reportes: enlaces guardados", () => {
  it.each([
    [AsistenciaPage, "attendance"],
    [IngresosPage, "income"],
    [MesasPage, "summary"],
    [PromotoresPage, "promoters"],
    [LiquidacionesPage, "settlements"],
  ])("lleva la ruta antigua al mismo evento y sección", async (page, tab) => {
    const run = page as (props: {
      searchParams: Promise<Record<string, string>>;
    }) => unknown;
    await expect(
      Promise.resolve().then(() =>
        run({
          searchParams: Promise.resolve({
            event_id: "evento-1",
            promoter_id: "promotor-1",
          }),
        }),
      ),
    ).rejects.toThrow(
      `REDIRECT:/admin/reportes?event_id=evento-1&promoter_id=promotor-1&tab=${tab}`,
    );
  });
});

describe("selección del reporte en la URL", () => {
  it.each([
    ["event_sales", "income"],
    ["event_attendance", "attendance"],
    ["free_qr_no_show", "attendance"],
    ["promoter_performance", "promoters"],
    ["promoter_settlement", "settlements"],
  ])(
    "conserva el identificador de reporte %s de enlaces antiguos",
    (report, expected) => {
      const target = new URL(
        legacyReportHref({ report, event_id: "evento 1", promoter_id: "p&1" }),
        "https://example.test",
      );
      expect(target.pathname).toBe("/admin/reportes");
      expect(target.searchParams.get("report")).toBe(report);
      expect(target.searchParams.get("event_id")).toBe("evento 1");
      expect(target.searchParams.get("promoter_id")).toBe("p&1");
      expect(reportView(target.searchParams)).toBe(expected);
    },
  );

  it("selecciona Mesas cuando el enlace lo pide explícitamente", () => {
    expect(legacyReportHref({ tab: "tables" })).toBe(
      "/admin/reportes?tab=tables",
    );
    expect(
      reportView(new URLSearchParams("tab=promoters&report=event_sales")),
    ).toBe("promoters");
    expect(reportView(new URLSearchParams("tab=unavailable"))).toBe("summary");
  });

  it("mantiene evento, promotor y página al cambiar de pestaña y restaurar una URL anterior", () => {
    const original =
      "event_id=e1&tab=promoters&promoter_page=2&promoter_id=p1&report=promoter_performance";
    const next = new URLSearchParams(
      reportSelectionQuery(original, { view: "income" }),
    );
    expect(reportView(next)).toBe("income");
    expect(next.get("event_id")).toBe("e1");
    expect(next.get("promoter_id")).toBe("p1");
    expect(reportPage(next.get("promoter_page"))).toBe(1);
    const previous = new URLSearchParams(original);
    expect(reportView(previous)).toBe("promoters");
    expect(reportPage(previous.get("promoter_page"))).toBe(1);
  });

  it("vuelve a la primera página al cambiar de promotor o evento", () => {
    const original =
      "event_id=e1&tab=promoters&promoter_page=8&settlement_page=3&promoter_id=p1";
    const filtered = new URLSearchParams(
      reportSelectionQuery(original, { promoterId: "p2" }),
    );
    expect(filtered.get("promoter_id")).toBe("p2");
    expect(reportPage(filtered.get("promoter_page"))).toBe(0);
    expect(reportPage(filtered.get("settlement_page"))).toBe(0);
    const event = new URLSearchParams(
      reportSelectionQuery(original, { eventId: "e2" }),
    );
    expect(event.get("event_id")).toBe("e2");
    expect(reportPage(event.get("promoter_page"))).toBe(0);
    expect(reportPage(event.get("settlement_page"))).toBe(0);
    expect(event.get("promoter_id")).toBe("p1");
    expect(
      new URLSearchParams(
        reportSelectionQuery(original, { promoterId: "" }),
      ).has("promoter_id"),
    ).toBe(false);
  });
});
