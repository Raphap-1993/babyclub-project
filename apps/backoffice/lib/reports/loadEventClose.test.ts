import { describe, expect, it } from "vitest";
import { createSupabaseMock } from "../../../../tests/utils/supabaseMock";
import { readReportPages, loadEventClose } from "./loadEventClose";

describe("lector de cierre", () => {
  const event = { id: "e-1", name: "Evento", starts_at: null, closed_at: null };
  const emptySources = () => ({
    "events.select": { data: event, error: null },
    "tickets.select": { data: [], error: null },
    "codes.select": { data: [], error: null },
    "table_reservations.select": { data: [], error: null },
    "payments.select": { data: [], error: null },
    "scan_logs.select": { data: [], error: null },
  });

  it("lee liquidaciones completas del evento con campos explícitos y resuelve promotores sin tickets", async () => {
    const { supabase, calls } = createSupabaseMock({
      ...emptySources(),
      "promoter_settlements.select": [
        {
          data: [
            {
              id: "s1",
              event_id: "e-1",
              promoter_id: "p1",
              status: "pending",
              currency_code: "PEN",
              cash_total_cents: 5000,
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "s2",
              event_id: "e-1",
              promoter_id: "p1",
              status: "paid",
              currency_code: "PEN",
              cash_total_cents: 3000,
            },
          ],
          error: null,
        },
        { data: [], error: null },
      ],
      "promoters.select": [
        {
          data: [
            {
              id: "p1",
              code: "ANA",
              person: { first_name: "Ana", last_name: "Ruiz" },
            },
          ],
          error: null,
        },
        { data: [], error: null },
      ],
    });
    const report = await loadEventClose(supabase as any, "e-1");
    expect(report?.settlements).toMatchObject({
      count: 2,
      pendingCents: 5000,
      settledCents: 3000,
    });
    expect(report?.settlements.records[0].promoterName).toBe("Ana Ruiz");
    const queries = calls.filter(
      (call) => call.table === "promoter_settlements",
    );
    expect(queries).toHaveLength(3);
    for (const query of queries) {
      expect(query.filters).toContainEqual({
        type: "eq",
        args: ["event_id", "e-1"],
      });
      expect(query.selectClause).toBe(
        "id,event_id,promoter_id,promoter_name,status,currency_code,cash_total_cents,cash_units,drink_units,created_at,settled_at,deleted_at,is_active",
      );
    }
    expect(queries[2].filters).toContainEqual({
      type: "range",
      args: [2, 501],
    });
    expect(
      calls.find((call) => call.table === "promoters")?.filters,
    ).toContainEqual({ type: "in", args: ["id", ["p1"]] });
  });

  it("rechaza el cierre completo si falla una página de liquidaciones", async () => {
    const { supabase } = createSupabaseMock({
      ...emptySources(),
      "promoter_settlements.select": [
        { data: [{ id: "s1", event_id: "e-1" }], error: null },
        { data: null, error: { message: "permission denied" } },
      ],
    });
    await expect(loadEventClose(supabase as any, "e-1")).rejects.toThrow(
      "No se pudo completar la lectura del reporte.",
    );
  });

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
