type RecordLike = Record<string, any> | null | undefined;

const DEFAULT_LAYOUT_CANVAS_WIDTH = 800;
const DEFAULT_LAYOUT_CANVAS_HEIGHT = 600;
const DEFAULT_LAYOUT_SIZE = 60;
const MIN_LAYOUT_SIZE = 20;

function hasOwn(record: RecordLike, field: string) {
  return !!record && Object.prototype.hasOwnProperty.call(record, field);
}

function toFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPositiveInt(value: unknown) {
  const parsed = toFiniteNumber(value);
  return parsed !== null && parsed > 0 ? Math.round(parsed) : null;
}

function toNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function readOrganizerLayoutMetadata(record: RecordLike) {
  return {
    layoutUrl: toNullableString(record?.layout_url),
    canvasWidth: hasOwn(record, "layout_canvas_width")
      ? toPositiveInt(record?.layout_canvas_width)
      : null,
    canvasHeight: hasOwn(record, "layout_canvas_height")
      ? toPositiveInt(record?.layout_canvas_height)
      : null,
    hasCanvasColumns:
      hasOwn(record, "layout_canvas_width") ||
      hasOwn(record, "layout_canvas_height"),
  };
}

export function readLayoutSettingsMetadata(record: RecordLike) {
  return {
    layoutUrl: toNullableString(record?.layout_url),
    canvasWidth: hasOwn(record, "canvas_width")
      ? toPositiveInt(record?.canvas_width)
      : null,
    canvasHeight: hasOwn(record, "canvas_height")
      ? toPositiveInt(record?.canvas_height)
      : null,
    hasCanvasColumns:
      hasOwn(record, "canvas_width") || hasOwn(record, "canvas_height"),
  };
}

export function detectTableLayoutCapabilities(record: RecordLike) {
  return {
    hasLayoutPositionColumns:
      hasOwn(record, "layout_x") && hasOwn(record, "layout_y"),
    hasLayoutSizeColumn: hasOwn(record, "layout_size"),
    hasLegacyPositionColumns:
      hasOwn(record, "pos_x") &&
      hasOwn(record, "pos_y") &&
      hasOwn(record, "pos_w") &&
      hasOwn(record, "pos_h"),
  };
}

export function normalizeOrganizerLayoutTableRecord(
  record: RecordLike,
  options?: {
    canvasWidth?: number | null;
    canvasHeight?: number | null;
    defaultLayoutSize?: number;
  },
) {
  const layoutCapabilities = detectTableLayoutCapabilities(record);
  const defaultLayoutSize = options?.defaultLayoutSize ?? DEFAULT_LAYOUT_SIZE;
  const canvasWidth =
    toPositiveInt(options?.canvasWidth) ?? DEFAULT_LAYOUT_CANVAS_WIDTH;
  const canvasHeight =
    toPositiveInt(options?.canvasHeight) ?? DEFAULT_LAYOUT_CANVAS_HEIGHT;
  const layoutSize = toPositiveInt(record?.layout_size) ?? defaultLayoutSize;

  if (layoutCapabilities.hasLayoutPositionColumns) {
    return {
      id: String(record?.id ?? ""),
      name: String(record?.name ?? ""),
      ticket_count: toFiniteNumber(record?.ticket_count),
      layout_x: toFiniteNumber(record?.layout_x),
      layout_y: toFiniteNumber(record?.layout_y),
      layout_size: layoutSize,
    };
  }

  if (layoutCapabilities.hasLegacyPositionColumns) {
    const widthPercent = clamp(toFiniteNumber(record?.pos_w) ?? 9, 2, 35);
    const heightPercent = clamp(toFiniteNumber(record?.pos_h) ?? 6, 2, 35);
    const xPercent = clamp(
      toFiniteNumber(record?.pos_x) ?? 10,
      0,
      100 - widthPercent,
    );
    const yPercent = clamp(
      toFiniteNumber(record?.pos_y) ?? 10,
      0,
      100 - heightPercent,
    );
    const widthPx = Math.max(
      MIN_LAYOUT_SIZE,
      Math.round((widthPercent / 100) * canvasWidth),
    );
    const heightPx = Math.max(
      MIN_LAYOUT_SIZE,
      Math.round((heightPercent / 100) * canvasHeight),
    );
    const normalizedSize = Math.max(widthPx, heightPx);

    return {
      id: String(record?.id ?? ""),
      name: String(record?.name ?? ""),
      ticket_count: toFiniteNumber(record?.ticket_count),
      layout_x: ((xPercent + widthPercent / 2) / 100) * canvasWidth,
      layout_y: ((yPercent + heightPercent / 2) / 100) * canvasHeight,
      layout_size: normalizedSize,
    };
  }

  return {
    id: String(record?.id ?? ""),
    name: String(record?.name ?? ""),
    ticket_count: toFiniteNumber(record?.ticket_count),
    layout_x: null,
    layout_y: null,
    layout_size: layoutSize,
  };
}
