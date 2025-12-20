"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { useSearchParams } from "next/navigation";

type ViewBoxSize = { width: number; height: number };

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

type TableMapProps = {
  slots: MapSlot[];
  selectedTableId: string;
  onSelect: (tableId: string) => void;
  layoutUrl?: string;
  loading?: boolean;
  enableZoom?: boolean;
};

export default function TableMap({
  slots,
  selectedTableId,
  onSelect,
  layoutUrl,
  loading = false,
  enableZoom = true,
}: TableMapProps) {
  const searchParams = useSearchParams();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewBoxSize, setViewBoxSize] = useState<ViewBoxSize>(MAP_VIEWBOX);
  const debugEnabled = searchParams?.get("debugMap") === "1" || process.env.NEXT_PUBLIC_MAP_DEBUG === "true";

  useEffect(() => {
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
  }, [layoutUrl]);

  const scaledSlots = useMemo(() => {
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

  const handleDebugClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!debugEnabled || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * viewBoxSize.width;
    const y = ((event.clientY - rect.top) / rect.height) * viewBoxSize.height;
    console.info("[map debug]", {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      xPct: Number(((x / viewBoxSize.width) * 100).toFixed(2)),
      yPct: Number(((y / viewBoxSize.height) * 100).toFixed(2)),
    });
  };

  const renderSlot = (slot: MapSlot) => {
    const isSelected = slot.tableId && slot.tableId === selectedTableId;
    const isReserved = slot.status === "reserved";
    const isAvailable = slot.status === "available";
    const centerX = slot.x + slot.w / 2;
    const centerY = slot.y + slot.h / 2;
    const label = slot.tableName || `Mesa ${slot.label}`;
    const capacity = slot.capacity != null ? `${slot.capacity} pax` : null;
    const statusLabel = isReserved ? "Reservada" : slot.status === "unavailable" ? "Fuera del mapa" : null;
    const fill = isSelected ? "rgba(233,30,99,0.2)" : isReserved ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.16)";
    const stroke = isSelected ? "#e91e63" : isReserved ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.6)";
    const textColor = isSelected ? "#ffffff" : "#f5f5f5";

    return (
      <g
        key={slot.id}
        role={isAvailable ? "button" : "presentation"}
        tabIndex={isAvailable ? 0 : -1}
        onClick={() => {
          if (isAvailable && slot.tableId) onSelect(slot.tableId);
        }}
        className={`transition-transform duration-150 ${isAvailable ? "cursor-pointer hover:scale-[1.015]" : "cursor-not-allowed"}`}
      >
        <rect
          x={slot.x}
          y={slot.y}
          width={slot.w}
          height={slot.h}
          rx={12}
          ry={12}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSelected ? 4 : 2}
          style={{ filter: isSelected ? "drop-shadow(0px 10px 25px rgba(233,30,99,0.3))" : "drop-shadow(0px 8px 20px rgba(0,0,0,0.35))" }}
        />
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize={14}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          <tspan x={centerX} dy={-4}>
            {label}
          </tspan>
          {capacity && (
            <tspan x={centerX} dy={16} fontWeight={500} fill={isSelected ? "#fefefe" : "#e5e5e5"}>
              {capacity}
            </tspan>
          )}
          {statusLabel && (
            <tspan x={centerX} dy={16} fontSize={12} fontWeight={500} fill="#d8d8d8">
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
      viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      onClick={debugEnabled ? handleDebugClick : undefined}
    >
      {layoutUrl && <image href={layoutUrl} x={0} y={0} width={viewBoxSize.width} height={viewBoxSize.height} />}
      {scaledSlots.map(renderSlot)}
    </svg>
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#121212] to-[#050505] p-2 shadow-[0_25px_80px_rgba(0,0,0,0.45)] sm:p-3 md:p-3">
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-inner"
        style={{ aspectRatio: `${viewBoxSize.width} / ${viewBoxSize.height}` }}
      >
        {enableZoom ? (
          <TransformWrapper
            disabled={!enableZoom}
            minScale={1}
            maxScale={3}
            wheel={{ step: 0.12 }}
            pinch={{ step: 0.12 }}
            doubleClick={{ disabled: true }}
            panning={{ velocityDisabled: true }}
          >
            <TransformComponent wrapperClass="h-full w-full" contentClass="h-full w-full">
              {mapContent}
            </TransformComponent>
          </TransformWrapper>
        ) : (
          <div className="h-full w-full">{mapContent}</div>
        )}

        {loading && <div className="pointer-events-none absolute inset-0 animate-pulse bg-white/5" />}
      </div>
    </div>
  );
}
