"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
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

// Componente de controles de zoom
function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform, instance } = useControls();
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (instance) {
      const updateZoom = () => {
        const currentZoom = Math.round((instance.transformState.scale || 1) * 100);
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
          <svg className="h-5 w-5 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
          </svg>
        </button>

        <button
          onClick={() => zoomOut()}
          className="group flex h-9 w-9 items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
          title="Alejar"
        >
          <svg className="h-5 w-5 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
          </svg>
        </button>

        <div className="h-px bg-white/10 my-0.5" />

        <button
          onClick={() => resetTransform()}
          className="group flex h-9 w-9 items-center justify-center rounded-md bg-white/5 hover:bg-white/10 transition-colors"
          title="Resetear vista"
        >
          <svg className="h-5 w-5 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Hint de gestos */}
      <div className="hidden lg:block rounded-lg bg-black/80 backdrop-blur-sm border border-white/10 px-2.5 py-1.5">
        <p className="text-[9px] text-white/50 text-center leading-tight">
          Arrastra para mover<br/>
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
  loading?: boolean;
  enableZoom?: boolean;
  labelMode?: "full" | "number";
  enforceSquare?: boolean;
  minSlotSizePx?: number;
};

export default function TableMap({
  slots,
  selectedTableId,
  onSelect,
  layoutUrl,
  viewBoxOverride = null,
  loading = false,
  enableZoom = true,
  labelMode = "full",
  enforceSquare = false,
  minSlotSizePx = 0,
}: TableMapProps) {
  const searchParams = useSearchParams();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewBoxSize, setViewBoxSize] = useState<ViewBoxSize>(MAP_VIEWBOX);
  const debugEnabled = searchParams?.get("debugMap") === "1" || process.env.NEXT_PUBLIC_MAP_DEBUG === "true";

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

  const scaledSlots = useMemo(() => {
    const scaleX = viewBoxSize.width / MAP_VIEWBOX.width;
    const scaleY = viewBoxSize.height / MAP_VIEWBOX.height;
    return slots.map((slot) => ({
      ...(() => {
        const x = slot.x * scaleX;
        const y = slot.y * scaleY;
        const w = slot.w * scaleX;
        const h = slot.h * scaleY;

        if (enforceSquare) {
          const centerX = x + w / 2;
          const centerY = y + h / 2;
          const squareSide = Math.max(Math.max(w, h), minSlotSizePx);
          return {
            ...slot,
            x: centerX - squareSide / 2,
            y: centerY - squareSide / 2,
            w: squareSide,
            h: squareSide,
          };
        }

        if (minSlotSizePx > 0) {
          const centerX = x + w / 2;
          const centerY = y + h / 2;
          const width = Math.max(w, minSlotSizePx);
          const height = Math.max(h, minSlotSizePx);
          return {
            ...slot,
            x: centerX - width / 2,
            y: centerY - height / 2,
            w: width,
            h: height,
          };
        }

        return {
          ...slot,
          x,
          y,
          w,
          h,
        };
      })(),
    }));
  }, [slots, viewBoxSize.height, viewBoxSize.width, enforceSquare, minSlotSizePx]);

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
    const label = labelMode === "number" ? slot.label : slot.tableName || `Mesa ${slot.label}`;
    const capacity = labelMode === "number" ? null : slot.capacity != null ? `${slot.capacity} pax` : null;
    const statusLabel =
      labelMode === "number" ? null : isReserved ? "Reservada" : slot.status === "unavailable" ? "Fuera del mapa" : null;
    const fill = isSelected ? "rgba(233,30,99,0.2)" : isReserved ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.16)";
    const stroke = isSelected ? "#e91e63" : isReserved ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.6)";
    const textColor = isSelected ? "#ffffff" : "#f5f5f5";
    const labelFontSize = Math.max(13, Math.min(26, Math.min(slot.w, slot.h) * 0.36));

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
          rx={4}
          ry={4}
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
          fontSize={labelFontSize}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          <tspan x={centerX} dy={labelMode === "number" ? 0 : -4}>
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
      {scaledSlots.map(renderSlot)}
    </svg>
  );

  return (
    <div className="h-full w-full flex items-center justify-center bg-black/40">
      <div className="relative h-full w-full overflow-hidden">
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
            
            <TransformComponent wrapperClass="h-full w-full" contentClass="h-full w-full flex items-center justify-center">
              <div className="w-full" style={{ aspectRatio: `${viewBoxSize.width} / ${viewBoxSize.height}`, maxHeight: '100%' }}>
                {mapContent}
              </div>
            </TransformComponent>
          </TransformWrapper>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <div className="w-full" style={{ aspectRatio: `${viewBoxSize.width} / ${viewBoxSize.height}`, maxHeight: '100%' }}>
              {mapContent}
            </div>
          </div>
        )}

        {loading && <div className="pointer-events-none absolute inset-0 animate-pulse bg-white/5" />}
      </div>
    </div>
  );
}
