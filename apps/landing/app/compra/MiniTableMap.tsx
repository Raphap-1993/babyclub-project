import React from "react";
import Image from "next/image";

type Table = {
  id: string;
  name: string;
  pos_x?: number | null;
  pos_y?: number | null;
  pos_w?: number | null;
  pos_h?: number | null;
  ticket_count?: number | null;
  min_consumption?: number | null;
  price?: number | null;
  is_reserved?: boolean | null;
};

export default function MiniTableMap({
  tables,
  selectedId,
  onSelect,
  layoutUrl,
}: {
  tables: Table[];
  selectedId: string;
  onSelect: (id: string) => void;
  layoutUrl: string | null;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/20 bg-[#0a0a0a] aspect-[3/4] min-h-[320px] md:min-h-[480px] shadow-[inset_0_2px_20px_rgba(0,0,0,0.6)]">
      {layoutUrl && (
        <div className="absolute inset-0">
          <Image
            src={layoutUrl}
            alt="Plano del local"
            fill
            priority
            className="object-contain opacity-80"
            sizes="(max-width: 768px) 100vw, 50vw"
            quality={90}
          />
        </div>
      )}
      <div className="absolute inset-0 z-10">
        {tables.map((t) => {
          const match = t.name.match(/(\d+)/);
          const label = match ? `M${match[1]}` : t.name;
          const isReserved: boolean = !!t.is_reserved;
          const posX = t.pos_x ?? 10;
          const posY = t.pos_y ?? 10;
          const posW = t.pos_w ?? 9;
          const posH = t.pos_h ?? 6;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => !isReserved && onSelect(t.id)}
              disabled={isReserved}
              className={`absolute flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 text-[13px] font-bold transition-all duration-200 ${
                isReserved
                  ? "border-white/10 bg-black/60 text-white/30 cursor-not-allowed backdrop-blur-sm"
                  : selectedId === t.id
                  ? "border-[#e91e63] bg-[#e91e63]/25 text-white shadow-[0_0_25px_rgba(233,30,99,0.5),inset_0_2px_10px_rgba(233,30,99,0.3)] scale-105 z-10"
                  : "border-white/30 bg-black/50 text-white/90 hover:border-white/50 hover:bg-black/70 hover:scale-105 backdrop-blur-sm shadow-[0_4px_15px_rgba(0,0,0,0.5)]"
              }`}
              style={{
                left: `${posX}%`,
                top: `${posY}%`,
                width: `clamp(40px, ${posW}%, 100px)`,
                height: `clamp(40px, ${posH}%, 100px)`,
              }}
            >
              <span className="leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
