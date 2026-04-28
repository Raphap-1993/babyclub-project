import { describe, expect, it } from "vitest";
import {
  detectTableLayoutCapabilities,
  normalizeOrganizerLayoutTableRecord,
  readLayoutSettingsMetadata,
  readOrganizerLayoutMetadata,
} from "./layoutMetadata";

describe("layoutMetadata", () => {
  it("lee organizer layout sin asumir columnas ausentes", () => {
    expect(
      readOrganizerLayoutMetadata({ layout_url: "https://cdn/layout.png" }),
    ).toEqual({
      layoutUrl: "https://cdn/layout.png",
      canvasWidth: null,
      canvasHeight: null,
      hasCanvasColumns: false,
    });
  });

  it("lee organizer layout con canvas metadata cuando existe", () => {
    expect(
      readOrganizerLayoutMetadata({
        layout_url: "https://cdn/layout.png",
        layout_canvas_width: 1280,
        layout_canvas_height: 720,
      }),
    ).toEqual({
      layoutUrl: "https://cdn/layout.png",
      canvasWidth: 1280,
      canvasHeight: 720,
      hasCanvasColumns: true,
    });
  });

  it("lee layout_settings legacy sin fallar cuando faltan columnas de canvas", () => {
    expect(readLayoutSettingsMetadata({ layout_url: "legacy.png" })).toEqual({
      layoutUrl: "legacy.png",
      canvasWidth: null,
      canvasHeight: null,
      hasCanvasColumns: false,
    });
  });

  it("detecta capacidades de layout por columnas reales presentes", () => {
    expect(
      detectTableLayoutCapabilities({
        id: "table-1",
        layout_x: 120,
        layout_y: 180,
        layout_size: 64,
      }),
    ).toEqual({
      hasLayoutPositionColumns: true,
      hasLayoutSizeColumn: true,
      hasLegacyPositionColumns: false,
    });
  });

  it("normaliza mesas legacy a coordenadas de layout", () => {
    expect(
      normalizeOrganizerLayoutTableRecord(
        {
          id: "table-1",
          name: "Mesa 1",
          ticket_count: 6,
          pos_x: 10,
          pos_y: 20,
          pos_w: 10,
          pos_h: 10,
        },
        { canvasWidth: 1000, canvasHeight: 500 },
      ),
    ).toEqual({
      id: "table-1",
      name: "Mesa 1",
      ticket_count: 6,
      layout_x: 150,
      layout_y: 125,
      layout_size: 100,
    });
  });
});
