import { describe, expect, it } from "vitest";
import { resolveMesaSelectionAfterReload } from "./mesaSelection";

describe("resolveMesaSelectionAfterReload", () => {
  it("no auto-selecciona una mesa cuando el usuario cambia de evento y aun no eligio mesa", () => {
    const result = resolveMesaSelectionAfterReload({
      tables: [
        { id: "table-1", name: "Mesa 1", is_reserved: false, products: [{ id: "prod-1" }] },
        { id: "table-2", name: "Mesa 2", is_reserved: false, products: [{ id: "prod-2" }] },
      ],
      currentSelectedTableId: "",
      currentSelectedProductId: "",
      selectedEventId: "event-1",
    });

    expect(result).toEqual({
      selectedTableId: "",
      selectedProductId: "",
    });
  });

  it("mantiene la mesa actual si sigue disponible tras recargar", () => {
    const result = resolveMesaSelectionAfterReload({
      tables: [
        { id: "table-1", name: "Mesa 1", is_reserved: false, products: [{ id: "prod-1" }] },
        { id: "table-2", name: "Mesa 2", is_reserved: false, products: [{ id: "prod-2" }] },
      ],
      currentSelectedTableId: "table-2",
      currentSelectedProductId: "prod-2",
      selectedEventId: "event-1",
    });

    expect(result).toEqual({
      selectedTableId: "table-2",
      selectedProductId: "prod-2",
    });
  });

  it("auto-selecciona la primera mesa disponible solo en la carga base sin evento seleccionado", () => {
    const result = resolveMesaSelectionAfterReload({
      tables: [
        { id: "table-1", name: "Mesa 1", is_reserved: true, products: [{ id: "prod-1" }] },
        { id: "table-2", name: "Mesa 2", is_reserved: false, products: [{ id: "prod-2" }] },
      ],
      currentSelectedTableId: "",
      currentSelectedProductId: "",
      selectedEventId: "",
    });

    expect(result).toEqual({
      selectedTableId: "table-2",
      selectedProductId: "prod-2",
    });
  });
});
