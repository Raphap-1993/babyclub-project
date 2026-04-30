"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  TransformComponent,
  TransformWrapper,
  useControls,
} from "react-zoom-pan-pinch";
import { useSearchParams } from "next/navigation";

type ViewBoxSize = { width: number; height: number };
type DisplayViewBox = ViewBoxSize & { x: number; y: number };
type FocusPaddingMode = "default" | "mobile";
type BoundsRect = { x: number; y: number; width: number; height: number };
type TableTooltip = {
  title: string;
  details: string[];
  x: number;
  y: number;
};

export const MAP_VIEWBOX: ViewBoxSize = { width: 1080, height: 1659 };

export type MapSlot = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: "available" | "reserved" | "unavailable";
  tableId?: string | null;
  tableName?: string;
  capacity?: number | null;
};

export function percentToViewBox(value: number, axis: "x" | "y") {
  const size = axis === "x" ? MAP_VIEWBOX.width : MAP_VIEWBOX.height;
  return (size * value) / 100;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getFullDisplayViewBox(size: ViewBoxSize): DisplayViewBox {
  return { x: 0, y: 0, width: size.width, height: size.height };
}

function getFocusedDisplayViewBox(
  slots: MapSlot[],
  size: ViewBoxSize,
  paddingMode: FocusPaddingMode = "default",
  extraBounds: BoundsRect | null = null,
): DisplayViewBox {
  if (slots.length === 0 && !extraBounds) return getFullDisplayViewBox(size);

  const slotLeft =
    slots.length > 0 ? Math.min(...slots.map((slot) => slot.x)) : null;
  const slotTop =
    slots.length > 0 ? Math.min(...slots.map((slot) => slot.y)) : null;
  const slotRight =
    slots.length > 0
      ? Math.max(...slots.map((slot) => slot.x + slot.w))
      : null;
  const slotBottom =
    slots.length > 0
      ? Math.max(...slots.map((slot) => slot.y + slot.h))
      : null;
  const left =
    slotLeft === null
      ? extraBounds!.x
      : extraBounds
        ? Math.min(slotLeft, extraBounds.x)
        : slotLeft;
  const top =
    slotTop === null
      ? extraBounds!.y
      : extraBounds
        ? Math.min(slotTop, extraBounds.y)
        : slotTop;
  const right =
    slotRight === null
      ? extraBounds!.x + extraBounds!.width
      : extraBounds
        ? Math.max(slotRight, extraBounds.x + extraBounds.width)
        : slotRight;
  const bottom =
    slotBottom === null
      ? extraBounds!.y + extraBounds!.height
      : extraBounds
        ? Math.max(slotBottom, extraBounds.y + extraBounds.height)
        : slotBottom;
  const contentWidth = right - left;
  const contentHeight = bottom - top;

  if (contentWidth <= 0 || contentHeight <= 0)
    return getFullDisplayViewBox(size);

  if (paddingMode === "mobile") {
    const paddingLeft = Math.max(size.width * 0.02, contentWidth * 0.08, 18);
    const paddingRight = Math.max(size.width * 0.02, contentWidth * 0.08, 18);
    const paddingTop = Math.max(size.height * 0.025, contentHeight * 0.04, 16);
    const paddingBottom = Math.max(
      size.height * 0.04,
      contentHeight * 0.06,
      24,
    );
    const expandedLeft = clampNumber(left - paddingLeft, 0, size.width);
    const expandedTop = clampNumber(top - paddingTop, 0, size.height);
    const expandedRight = clampNumber(right + paddingRight, 0, size.width);
    const expandedBottom = clampNumber(
      bottom + paddingBottom,
      0,
      size.height,
    );
    const width = clampNumber(
      expandedRight - expandedLeft,
      size.width * 0.44,
      size.width,
    );
    const height = clampNumber(
      expandedBottom - expandedTop,
      size.height * 0.54,
      size.height,
    );

    return {
      x: clampNumber(expandedLeft, 0, size.width - width),
      y: clampNumber(expandedTop, 0, size.height - height),
      width,
      height,
    };
  }

  const paddingX = Math.max(size.width * 0.06, contentWidth * 0.35, 48);
  const paddingY = Math.max(size.height * 0.06, contentHeight * 0.28, 48);
  const width = Math.min(
    size.width,
    Math.max(contentWidth + paddingX * 2, size.width * 0.48),
  );
  const height = Math.min(
    size.height,
    Math.max(contentHeight + paddingY * 2, size.height * 0.46),
  );
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  return {
    x: clampNumber(centerX - width / 2, 0, size.width - width),
    y: clampNumber(centerY - height / 2, 0, size.height - height),
    width,
    height,
  };
}

// Componente de controles de zoom
function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform, instance } = useControls();
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (instance) {
      const updateZoom = () => {
        const currentZoom = Math.round(
          (instance.transformState.scale || 1) * 100,
        );
        setZoom(currentZoom);
      };
      updateZoom();

      // Escuchar cambios de zoom
      const interval = setInterval(updateZoom, 100);
      return () => clearInterval(interval);
    }
  }, [instance]);

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
      {/* Indicador de zoom */}
      <div className="rounded-lg bg-black/80 backdrop-blur-sm border border-white/10 px-3 py-1.5 text-center">
        <span className="text-xs font-semibold text-white/90">{zoom}%</span>
      </div>

      {/* Botones de control */}
      <div className="flex flex-col gap-1.5 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10 p-1.5">
        <button
          onClick={() => zoomIn()}
          className="group flex h-9 w-9 items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
          title="Acercar"
        >
          <svg
            className="h-5 w-5 text-white/70 group-hover:text-white transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v12m6-6H6"
            />
          </svg>
        </button>

        <button
          onClick={() => zoomOut()}
          className="group flex h-9 w-9 items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
          title="Alejar"
        >
          <svg
            className="h-5 w-5 text-white/70 group-hover:text-white transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18 12H6"
            />
          </svg>
        </button>

        <div className="h-px bg-white/10 my-0.5" />

        <button
          onClick={() => resetTransform()}
          className="group flex h-9 w-9 items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
          title="Resetear vista"
        >
          <svg
            className="h-5 w-5 text-white/70 group-hover:text-white transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>

      {/* Hint de gestos */}
      <div className="hidden lg:block rounded-lg bg-black/80 backdrop-blur-sm border border-white/10 px-2.5 py-1.5">
        <p className="text-[9px] text-white/50 text-center leading-tight">
          Arrastra para mover
          <br />
          Scroll para zoom
        </p>
      </div>
    </div>
  );
}

type TableMapProps = {
  slots: MapSlot[];
  selectedTableId: string;
  onSelect: (tableId: string) => void;
  layoutUrl?: string;
  viewBoxOverride?: ViewBoxSize | null;
  imageNaturalSize?: ViewBoxSize | null;
  loading?: boolean;
  enableZoom?: boolean;
  labelMode?: "full" | "number";
  enforceSquare?: boolean;
  minSlotSizePx?: number;
  minSlotScreenPx?: number;
  focusOnSlots?: boolean;
  focusOnSlotsOnMobile?: boolean;
};

export default function TableMap({
  slots,
  selectedTableId,
  onSelect,
  layoutUrl,
  viewBoxOverride = null,
  imageNaturalSize = null,
  loading = false,
  enableZoom = true,
  labelMode = "full",
  enforceSquare = false,
  minSlotSizePx = 0,
  minSlotScreenPx = 0,
  focusOnSlots = false,
  focusOnSlotsOnMobile = false,
}: TableMapProps) {
  const searchParams = useSearchParams();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewBoxSize, setViewBoxSize] = useState<ViewBoxSize>(MAP_VIEWBOX);
  const [mapViewportSize, setMapViewportSize] = useState<ViewBoxSize>({
    width: 0,
    height: 0,
  });
  const [tooltip, setTooltip] = useState<TableTooltip | null>(null);
  const debugEnabled =
    searchParams?.get("debugMap") === "1" ||
    process.env.NEXT_PUBLIC_MAP_DEBUG === "true";

  useEffect(() => {
    if (viewBoxOverride?.width && viewBoxOverride?.height) {
      setViewBoxSize({
        width: viewBoxOverride.width,
        height: viewBoxOverride.height,
      });
      return;
    }

    if (!layoutUrl) {
      setViewBoxSize(MAP_VIEWBOX);
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setViewBoxSize({ width: img.naturalWidth, height: img.naturalHeight });
      } else {
        setViewBoxSize(MAP_VIEWBOX);
      }
    };
    img.onerror = () => setViewBoxSize(MAP_VIEWBOX);
    img.src = layoutUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [layoutUrl, viewBoxOverride?.width, viewBoxOverride?.height]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setMapViewportSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    updateSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const baseScaledSlots = useMemo(() => {
    const scaleX = viewBoxSize.width / MAP_VIEWBOX.width;
    const scaleY = viewBoxSize.height / MAP_VIEWBOX.height;
    return slots.map((slot) => ({
      ...slot,
      x: slot.x * scaleX,
      y: slot.y * scaleY,
      w: slot.w * scaleX,
      h: slot.h * scaleY,
    }));
  }, [slots, viewBoxSize.height, viewBoxSize.width]);

  const imageContainedBounds = useMemo(() => {
    if (
      !imageNaturalSize?.width ||
      !imageNaturalSize?.height ||
      imageNaturalSize.width <= 0 ||
      imageNaturalSize.height <= 0
    ) {
      return null;
    }

    const scale = Math.min(
      viewBoxSize.width / imageNaturalSize.width,
      viewBoxSize.height / imageNaturalSize.height,
    );

    if (!Number.isFinite(scale) || scale <= 0) return null;

    const width = imageNaturalSize.width * scale;
    const height = imageNaturalSize.height * scale;

    return {
      x: (viewBoxSize.width - width) / 2,
      y: (viewBoxSize.height - height) / 2,
      width,
      height,
    };
  }, [imageNaturalSize?.height, imageNaturalSize?.width, viewBoxSize.height, viewBoxSize.width]);

  const shouldFocusOnSlots =
    focusOnSlots ||
    (focusOnSlotsOnMobile &&
      mapViewportSize.width > 0 &&
      mapViewportSize.width < 640);

  const displayViewBox = useMemo(
    () =>
      shouldFocusOnSlots
        ? getFocusedDisplayViewBox(
            baseScaledSlots,
            viewBoxSize,
            mapViewportSize.width > 0 && mapViewportSize.width < 640
              ? "mobile"
              : "default",
            mapViewportSize.width > 0 && mapViewportSize.width < 640
              ? imageContainedBounds
              : null,
          )
        : getFullDisplayViewBox(viewBoxSize),
    [
      baseScaledSlots,
      imageContainedBounds,
      mapViewportSize.width,
      shouldFocusOnSlots,
      viewBoxSize,
    ],
  );

  const effectiveMinSlotSizePx = useMemo(() => {
    if (
      minSlotScreenPx <= 0 ||
      mapViewportSize.width <= 0 ||
      mapViewportSize.height <= 0 ||
      mapViewportSize.width >= 640
    ) {
      return minSlotSizePx;
    }

    const renderScale = Math.min(
      mapViewportSize.width / displayViewBox.width,
      mapViewportSize.height / displayViewBox.height,
    );

    if (!Number.isFinite(renderScale) || renderScale <= 0) {
      return minSlotSizePx;
    }

    return Math.max(minSlotSizePx, minSlotScreenPx / renderScale);
  }, [
    displayViewBox.height,
    displayViewBox.width,
    mapViewportSize.height,
    mapViewportSize.width,
    minSlotScreenPx,
    minSlotSizePx,
  ]);

  const handleDebugClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!debugEnabled || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x =
      displayViewBox.x +
      ((event.clientX - rect.left) / rect.width) * displayViewBox.width;
    const y =
      displayViewBox.y +
      ((event.clientY - rect.top) / rect.height) * displayViewBox.height;
    console.info("[map debug]", {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      xPct: Number(((x / viewBoxSize.width) * 100).toFixed(2)),
      yPct: Number(((y / viewBoxSize.height) * 100).toFixed(2)),
    });
  };

  const getSlotTooltip = (
    slot: MapSlot,
    isSelected: boolean | "" | null | undefined,
  ) => {
    const tableTitle = slot.tableName || `Mesa ${slot.label}`;
    const status = isSelected
      ? "Seleccionada"
      : slot.status === "reserved"
        ? "Reservada"
        : slot.status === "unavailable"
          ? "No disponible"
          : "Libre";
    const details = [`Estado: ${status}`];

    if (slot.capacity != null) {
      details.push(`${slot.capacity} tickets incluidos`);
    }
    if (slot.status === "available") {
      details.push("Haz clic para seleccionar");
    }

    return { title: tableTitle, details };
  };

  const showSlotTooltip = (
    slot: MapSlot,
    isSelected: boolean | "" | null | undefined,
    event?: MouseEvent<SVGGElement>,
  ) => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    const rawX =
      event && containerRect ? event.clientX - containerRect.left + 12 : 16;
    const rawY =
      event && containerRect ? event.clientY - containerRect.top - 12 : 76;
    const x = containerRect
      ? clampNumber(rawX, 12, Math.max(12, containerRect.width - 232))
      : rawX;
    const y = containerRect
      ? clampNumber(rawY, 76, containerRect.height - 8)
      : rawY;
    setTooltip({
      ...getSlotTooltip(slot, isSelected),
      x,
      y,
    });
  };

  const renderSlot = (slot: MapSlot) => {
    const isSelected = slot.tableId && slot.tableId === selectedTableId;
    const isReserved = slot.status === "reserved";
    const isAvailable = slot.status === "available";
    const centerX = slot.x + slot.w / 2;
    const centerY = slot.y + slot.h / 2;
    const visualSide = enforceSquare
      ? Math.max(slot.w, slot.h, effectiveMinSlotSizePx)
      : null;
    const visualWidth = visualSide ?? Math.max(slot.w, effectiveMinSlotSizePx);
    const visualHeight = visualSide ?? Math.max(slot.h, effectiveMinSlotSizePx);
    const visualX = centerX - visualWidth / 2;
    const visualY = centerY - visualHeight / 2;
    const isCompactMarker =
      effectiveMinSlotSizePx > 0 &&
      (visualWidth > slot.w || visualHeight > slot.h);
    const label =
      labelMode === "number"
        ? slot.label
        : slot.tableName || `Mesa ${slot.label}`;
    const capacity =
      labelMode === "number"
        ? null
        : slot.capacity != null
          ? `${slot.capacity} pax`
          : null;
    const statusLabel =
      labelMode === "number"
        ? null
        : isReserved
          ? "Reservada"
          : slot.status === "unavailable"
            ? "Fuera del mapa"
            : null;
    const fill = isSelected
      ? "rgba(233,30,99,0.2)"
      : isReserved
        ? "rgba(80,80,80,0.28)"
        : "rgba(255,255,255,0.16)";
    const stroke = isSelected
      ? "#e91e63"
      : isReserved
        ? "rgba(220,220,220,0.45)"
        : "rgba(255,255,255,0.6)";
    const markerFill =
      isCompactMarker && !isSelected
        ? isAvailable
          ? "rgba(16,16,16,0.88)"
          : "rgba(42,42,42,0.58)"
        : fill;
    const markerStroke =
      isCompactMarker && !isSelected
        ? isAvailable
          ? "rgba(245,245,245,0.58)"
          : "rgba(245,245,245,0.32)"
        : stroke;
    const textColor =
      isCompactMarker && !isAvailable && !isSelected ? "#b8b8b8" : "#f5f5f5";
    const labelFontSize =
      labelMode === "number"
        ? isCompactMarker
          ? Math.max(
              8,
              Math.min(11, Math.min(visualWidth, visualHeight) * 0.44),
            )
          : Math.max(
              8,
              Math.min(16, Math.min(visualWidth, visualHeight) * 0.42),
            )
        : Math.max(
            13,
            Math.min(26, Math.min(visualWidth, visualHeight) * 0.36),
          );
    const tooltipContent = getSlotTooltip(slot, isSelected);
    const accessibleLabel = [tooltipContent.title, ...tooltipContent.details]
      .filter(Boolean)
      .join(". ");

    return (
      <g
        key={slot.id}
        role={isAvailable ? "button" : "presentation"}
        aria-label={accessibleLabel}
        aria-disabled={!isAvailable}
        tabIndex={isAvailable ? 0 : -1}
        onClick={() => {
          if (isAvailable && slot.tableId) onSelect(slot.tableId);
        }}
        onMouseEnter={(event) => showSlotTooltip(slot, isSelected, event)}
        onMouseMove={(event) => showSlotTooltip(slot, isSelected, event)}
        onMouseLeave={() => setTooltip(null)}
        onFocus={() => showSlotTooltip(slot, isSelected)}
        onBlur={() => setTooltip(null)}
        className={`transition-transform duration-150 ${isAvailable ? "cursor-pointer hover:scale-[1.015]" : "cursor-not-allowed"}`}
      >
        <title>{accessibleLabel}</title>
        <rect
          x={visualX}
          y={visualY}
          width={visualWidth}
          height={visualHeight}
          rx={isCompactMarker ? Math.min(8, visualWidth * 0.28) : 4}
          ry={isCompactMarker ? Math.min(8, visualHeight * 0.28) : 4}
          fill={markerFill}
          stroke={markerStroke}
          strokeWidth={
            isCompactMarker ? (isSelected ? 2.5 : 1.5) : isSelected ? 4 : 2
          }
          vectorEffect="non-scaling-stroke"
          style={{
            filter: isCompactMarker
              ? isSelected
                ? "drop-shadow(0px 6px 12px rgba(233,30,99,0.35))"
                : undefined
              : isSelected
                ? "drop-shadow(0px 10px 25px rgba(233,30,99,0.3))"
                : "drop-shadow(0px 8px 20px rgba(0,0,0,0.35))",
          }}
        />
        {isReserved && !isCompactMarker && (
          <line
            x1={visualX + 4}
            y1={visualY + 4}
            x2={visualX + visualWidth - 4}
            y2={visualY + visualHeight - 4}
            stroke="rgba(245,245,245,0.7)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize={labelFontSize}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          <tspan x={centerX} dy={labelMode === "number" ? 0 : -4}>
            {label}
          </tspan>
          {capacity && (
            <tspan
              x={centerX}
              dy={16}
              fontWeight={500}
              fill={isSelected ? "#fefefe" : "#e5e5e5"}
            >
              {capacity}
            </tspan>
          )}
          {statusLabel && (
            <tspan
              x={centerX}
              dy={16}
              fontSize={12}
              fontWeight={500}
              fill="#d8d8d8"
            >
              {statusLabel}
            </tspan>
          )}
        </text>
      </g>
    );
  };

  const mapContent = (
    <svg
      ref={svgRef}
      viewBox={`${displayViewBox.x} ${displayViewBox.y} ${displayViewBox.width} ${displayViewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      onClick={debugEnabled ? handleDebugClick : undefined}
    >
      {layoutUrl && (
        <image
          href={layoutUrl}
          x={0}
          y={0}
          width={viewBoxSize.width}
          height={viewBoxSize.height}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      {baseScaledSlots.map(renderSlot)}
    </svg>
  );
  return (
    <div className="flex h-full w-full min-w-0 max-w-full items-center justify-center overflow-hidden bg-black/40">
      <div
        ref={containerRef}
        className="relative h-full w-full min-w-0 max-w-full overflow-hidden"
      >
        {enableZoom ? (
          <TransformWrapper
            disabled={!enableZoom}
            minScale={0.8}
            maxScale={3}
            initialScale={0.95}
            wheel={{ step: 0.12 }}
            pinch={{ step: 0.12 }}
            doubleClick={{ disabled: true }}
            panning={{ velocityDisabled: true }}
            centerOnInit
          >
            {/* Controles de zoom */}
            <ZoomControls />

            <TransformComponent
              wrapperClass="h-full w-full min-w-0 max-w-full overflow-hidden"
              contentClass="h-full w-full min-w-0 max-w-full flex items-center justify-center overflow-hidden"
            >
              <div
                className="w-full min-w-0 max-w-full"
                style={{
                  aspectRatio: `${displayViewBox.width} / ${displayViewBox.height}`,
                  maxHeight: "100%",
                }}
              >
                {mapContent}
              </div>
            </TransformComponent>
          </TransformWrapper>
        ) : (
          <div className="flex h-full w-full min-w-0 max-w-full items-center justify-center overflow-hidden">
            <div
              className="w-full min-w-0 max-w-full"
              style={{
                aspectRatio: `${displayViewBox.width} / ${displayViewBox.height}`,
                maxHeight: "100%",
              }}
            >
              {mapContent}
            </div>
          </div>
        )}

        {loading && (
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-white/5" />
        )}
        {tooltip && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-white/10 bg-[#080808]/95 px-3 py-2 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translateY(-100%)",
            }}
          >
            <p className="truncate text-xs font-semibold text-white">
              {tooltip.title}
            </p>
            <div className="mt-1 space-y-0.5">
              {tooltip.details.map((detail) => (
                <p key={detail} className="text-[11px] leading-4 text-white/65">
                  {detail}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
