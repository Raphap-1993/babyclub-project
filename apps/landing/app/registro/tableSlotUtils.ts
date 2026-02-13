import type { MapSlot } from "./TableMap";
import { percentToViewBox } from "./TableMap";

const DEFAULT_LAYOUT_CANVAS_WIDTH = 800;
const DEFAULT_LAYOUT_CANVAS_HEIGHT = 600;
const DEFAULT_LAYOUT_SIZE_PX = 60;
const DEFAULT_LEGACY_WIDTH_PERCENT = 9;
const DEFAULT_LEGACY_HEIGHT_PERCENT = 6;

type TableMapSource = {
  id: string;
  name: string;
  ticket_count?: number | null;
  is_reserved?: boolean | null;
  pos_x?: number | null;
  pos_y?: number | null;
  pos_w?: number | null;
  pos_h?: number | null;
  layout_x?: number | null;
  layout_y?: number | null;
  layout_size?: number | null;
};

type BuildMapSlotsOptions = {
  canvasWidth?: number | null;
  canvasHeight?: number | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
};

function asFiniteNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseTableLabel(name: string) {
  const match = name.match(/(\d+)/);
  return match ? match[1] : name;
}

function resolveLayoutCanvas(tables: TableMapSource[]) {
  const layoutTables = tables.filter((table) => {
    return asFiniteNumber(table.layout_x) !== null && asFiniteNumber(table.layout_y) !== null;
  });

  if (layoutTables.length === 0) {
    return {
      width: DEFAULT_LAYOUT_CANVAS_WIDTH,
      height: DEFAULT_LAYOUT_CANVAS_HEIGHT,
    };
  }

  const maxX = layoutTables.reduce((max, table) => {
    const centerX = asFiniteNumber(table.layout_x) ?? 0;
    const size = asFiniteNumber(table.layout_size) ?? DEFAULT_LAYOUT_SIZE_PX;
    return Math.max(max, centerX + size / 2);
  }, DEFAULT_LAYOUT_CANVAS_WIDTH);

  const maxY = layoutTables.reduce((max, table) => {
    const centerY = asFiniteNumber(table.layout_y) ?? 0;
    const size = asFiniteNumber(table.layout_size) ?? DEFAULT_LAYOUT_SIZE_PX;
    return Math.max(max, centerY + size / 2);
  }, DEFAULT_LAYOUT_CANVAS_HEIGHT);

  return {
    width: Math.max(DEFAULT_LAYOUT_CANVAS_WIDTH, maxX + 24),
    height: Math.max(DEFAULT_LAYOUT_CANVAS_HEIGHT, maxY + 24),
  };
}

export function hasMapPosition(table: TableMapSource) {
  const hasLayout = asFiniteNumber(table.layout_x) !== null && asFiniteNumber(table.layout_y) !== null;
  const hasLegacy = asFiniteNumber(table.pos_x) !== null && asFiniteNumber(table.pos_y) !== null;
  return hasLayout || hasLegacy;
}

export function buildMapSlotsFromTables(tables: TableMapSource[], options?: BuildMapSlotsOptions): MapSlot[] {
  const providedCanvasWidth = asFiniteNumber(options?.canvasWidth);
  const providedCanvasHeight = asFiniteNumber(options?.canvasHeight);
  const hasProvidedCanvas =
    providedCanvasWidth !== null &&
    providedCanvasHeight !== null &&
    providedCanvasWidth > 0 &&
    providedCanvasHeight > 0;

  const layoutCanvas = hasProvidedCanvas
    ? { width: providedCanvasWidth, height: providedCanvasHeight }
    : resolveLayoutCanvas(tables);
  return tables
    .filter(hasMapPosition)
    .map((table) => {
      const hasLayout = asFiniteNumber(table.layout_x) !== null && asFiniteNumber(table.layout_y) !== null;
      let xPercent = 0;
      let yPercent = 0;
      let widthPercent = 0;
      let heightPercent = 0;

      if (hasLayout) {
        const centerX = asFiniteNumber(table.layout_x) ?? 0;
        const centerY = asFiniteNumber(table.layout_y) ?? 0;
        const sizePx = clamp(asFiniteNumber(table.layout_size) ?? DEFAULT_LAYOUT_SIZE_PX, 36, 200);
        widthPercent = clamp((sizePx / layoutCanvas.width) * 100, 2, 35);
        heightPercent = clamp((sizePx / layoutCanvas.height) * 100, 2, 35);
        xPercent = clamp(
          ((centerX - sizePx / 2) / layoutCanvas.width) * 100,
          0,
          100 - widthPercent
        );
        yPercent = clamp(
          ((centerY - sizePx / 2) / layoutCanvas.height) * 100,
          0,
          100 - heightPercent
        );
      } else {
        widthPercent = clamp(
          asFiniteNumber(table.pos_w) ?? DEFAULT_LEGACY_WIDTH_PERCENT,
          2,
          35
        );
        heightPercent = clamp(
          asFiniteNumber(table.pos_h) ?? DEFAULT_LEGACY_HEIGHT_PERCENT,
          2,
          35
        );
        xPercent = clamp(asFiniteNumber(table.pos_x) ?? 10, 0, 100 - widthPercent);
        yPercent = clamp(asFiniteNumber(table.pos_y) ?? 10, 0, 100 - heightPercent);
      }

      return {
        id: table.id,
        label: parseTableLabel(table.name),
        tableId: table.id,
        tableName: table.name,
        capacity: table.ticket_count ?? null,
        status: table.is_reserved ? "reserved" : "available",
        x: percentToViewBox(xPercent, "x"),
        y: percentToViewBox(yPercent, "y"),
        w: percentToViewBox(widthPercent, "x"),
        h: percentToViewBox(heightPercent, "y"),
      } satisfies MapSlot;
    });
}
