import React from "react";

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
    <div
      className="relative min-h-[520px] overflow-hidden rounded-xl border border-white/10 bg-black"
      style={{
        backgroundImage: layoutUrl ? `url(${layoutUrl})` : undefined,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0">
        {tables.map((t) => {
          const match = t.name.match(/(\d+)/);
          const label = match ? `M${match[1]}` : t.name;
          const isReserved: boolean = !!t.is_reserved;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => !isReserved && onSelect(t.id)}
              disabled={isReserved}
              className={`absolute flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-semibold ${
                isReserved
                  ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                  : selectedId === t.id
                  ? "border-[#e91e63] bg-[#e91e63] text-white shadow-[0_10px_25px_rgba(233,30,99,0.3)]"
                  : "border-white/50 bg-white/10 text-white"
              }`}
              style={{
                left: `${t.pos_x ?? 10}%`,
                top: `${t.pos_y ?? 10}%`,
                width: `${t.pos_w ?? 9}%`,
                height: `${t.pos_h ?? 6}%`,
              }}
            >
              <span className="leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
