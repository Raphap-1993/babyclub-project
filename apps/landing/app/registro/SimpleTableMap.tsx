"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

export interface TableSlot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  reserved?: boolean;
}

interface TableMapProps {
  slots: TableSlot[];
  selectedTableId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  layoutUrl?: string;
}

export default function SimpleTableMap({
  slots,
  selectedTableId,
  onSelect,
  loading,
  layoutUrl,
}: TableMapProps) {
  const [imageDimensions, setImageDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    if (layoutUrl) {
      const img = new window.Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = layoutUrl;
    }
  }, [layoutUrl]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!layoutUrl) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/50">
        No hay mapa disponible
      </div>
    );
  }

  const aspectRatio = imageDimensions.width / imageDimensions.height;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
        style={{
          aspectRatio: aspectRatio.toString(),
          maxWidth: "100%",
          maxHeight: "100%",
          margin: "auto",
        }}
      >
        <div className="relative h-full w-full">
          <Image
            src={layoutUrl}
            alt="Mapa de mesas"
            fill
            className="object-contain"
            priority
          />
          
          {/* SVG overlay para las mesas */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {slots.map((slot) => {
              const isSelected = slot.id === selectedTableId;
              const isReserved = slot.reserved;

              return (
                <g key={slot.id}>
                  <rect
                    x={slot.x}
                    y={slot.y}
                    width={slot.width}
                    height={slot.width}
                    fill={
                      isSelected
                        ? "rgba(233, 30, 99, 0.3)"
                        : isReserved
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(255, 255, 255, 0.1)"
                    }
                    stroke={
                      isSelected
                        ? "#e91e63"
                        : isReserved
                          ? "rgba(255, 255, 255, 0.15)"
                          : "rgba(255, 255, 255, 0.3)"
                    }
                    strokeWidth={isSelected ? 3 : 1}
                    className={`transition-all ${!isReserved ? "cursor-pointer hover:fill-white/20" : "cursor-not-allowed"}`}
                    onClick={() => !isReserved && onSelect(slot.id)}
                    rx={4}
                  />
                  <text
                    x={slot.x + slot.width / 2}
                    y={slot.y + slot.width / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSelected ? "#fff" : isReserved ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.8)"}
                    fontSize={Math.min(slot.width, slot.width) * 0.3}
                    fontWeight="600"
                    className="pointer-events-none select-none"
                  >
                    {slot.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
