import { describe, expect, it } from "vitest";
import { buildMapSlotsFromTables } from "./tableSlotUtils";

describe("buildMapSlotsFromTables", () => {
  it("prioriza coordenadas layout_x/layout_y sobre legacy cuando ambas existen", () => {
    const slots = buildMapSlotsFromTables([
      {
        id: "table-1",
        name: "Mesa 1",
        layout_x: 400,
        layout_y: 200,
        layout_size: 40,
        // legacy inconsistente a propósito
        pos_x: 10,
        pos_y: 10,
        pos_w: 4,
        pos_h: 6.6667,
      },
    ] as any);

    expect(slots).toHaveLength(1);
    // x esperado por layout en canvas inferido ~1000px => ~38% del MAP_VIEWBOX.x(1080) ~= 410
    expect(slots[0].x).toBeGreaterThan(390);
    expect(slots[0].x).toBeLessThan(430);
  });

  it("infiera canvas desde datos legacy para evitar desalineado en mesas mixtas", () => {
    const slots = buildMapSlotsFromTables([
      {
        id: "mesa-1",
        name: "Mesa 1",
        layout_x: 243,
        layout_y: 77,
        layout_size: 40,
        pos_x: 22.2777,
        pos_y: 9.5,
        pos_w: 3.996,
        pos_h: 6.6667,
      },
      {
        id: "mesa-3",
        name: "Mesa 3",
        layout_x: 137,
        layout_y: 230,
        layout_size: 40,
        pos_x: null,
        pos_y: null,
        pos_w: null,
        pos_h: null,
      },
    ] as any);

    const mesa3 = slots.find((slot) => slot.id === "mesa-3");
    expect(mesa3).toBeTruthy();
    // Con canvas inferido ~1000px, x debe quedar cerca de 126 (no ~158 como con fallback 800)
    expect(mesa3!.x).toBeGreaterThan(120);
    expect(mesa3!.x).toBeLessThan(132);
  });
});
