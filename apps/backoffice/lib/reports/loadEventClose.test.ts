import { describe, expect, it } from "vitest";
import { createSupabaseMock } from "../../../../tests/utils/supabaseMock";
import { readReportPages, loadEventClose } from "./loadEventClose";

describe("lector de cierre", () => {
  it("lee más de 1000 registros y continúa después de una página parcial", async () => {
    const { supabase, calls } = createSupabaseMock({
      "tickets.select": [
        {
          data: Array.from({ length: 500 }, (_, id) => ({ id })),
          error: null,
        },
        {
          data: Array.from({ length: 500 }, (_, index) => ({
            id: index + 500,
          })),
          error: null,
        },
        { data: [{ id: 1000 }], error: null },
        { data: [], error: null },
      ],
    });
    expect(
      await readReportPages(() => supabase.from("tickets").select("id")),
    ).toHaveLength(1001);
    expect(calls[1].filters).toContainEqual({
      type: "range",
      args: [500, 999],
    });
    expect(calls[3].filters).toContainEqual({
      type: "range",
      args: [1001, 1500],
    });
  });
  it("falla ante una página incompleta por error en vez de mostrar un total parcial", async () => {
    const { supabase } = createSupabaseMock({
      "tickets.select": [
        { data: [{ id: "1" }], error: null },
        { data: null, error: { message: "query timeout" } },
      ],
    });
    await expect(
      readReportPages(() => supabase.from("tickets").select("id")),
    ).rejects.toThrow();
  });
  it("no devuelve eventos eliminados ni convierte un error de datos en cero", async () => {
    const { supabase, calls } = createSupabaseMock({
      "events.select": { data: null, error: null },
    });
    expect(await loadEventClose(supabase as any, "e-1")).toBeNull();
    expect(calls[0].filters).toContainEqual({
      type: "is",
      args: ["deleted_at", null],
    });
  });
});
