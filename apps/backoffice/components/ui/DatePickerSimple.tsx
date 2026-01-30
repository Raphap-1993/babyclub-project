"use client";

import { useEffect, useMemo, useState } from "react";

export default function DatePickerSimple({
  value,
  onChange,
  label,
  placeholder = "dd/mm/aaaa",
  name,
  minYear,
  maxYear,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  placeholder?: string;
  name?: string;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");

  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split("-");
      if (y && m && d) {
        setYear(y);
        setMonth(m);
        setDay(d);
        return;
      }
    }
    setYear("");
    setMonth("");
    setDay("");
  }, [value]);

  const years = useMemo(() => {
    const today = new Date();
    const max = maxYear ?? today.getFullYear() + 3;
    const min = minYear ?? max - 80;
    const list: string[] = [];
    for (let y = max; y >= min; y--) list.push(String(y));
    return list;
  }, [maxYear, minYear]);

  const months = [
    { label: "Enero", value: "01" },
    { label: "Febrero", value: "02" },
    { label: "Marzo", value: "03" },
    { label: "Abril", value: "04" },
    { label: "Mayo", value: "05" },
    { label: "Junio", value: "06" },
    { label: "Julio", value: "07" },
    { label: "Agosto", value: "08" },
    { label: "Septiembre", value: "09" },
    { label: "Octubre", value: "10" },
    { label: "Noviembre", value: "11" },
    { label: "Diciembre", value: "12" },
  ];

  const days = Array.from({ length: 31 }, (_, idx) => String(idx + 1).padStart(2, "0"));

  const displayValue = (() => {
    if (year && month && day) return `${day}/${month}/${year}`;
    if (!value) return placeholder;
    const [y, m, d] = value.split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
    return placeholder;
  })();

  const updateValue = (y: string, m: string, d: string) => {
    if (!y || !m || !d) return;
    onChange(`${y}-${m}-${d}`);
  };

  const clear = () => {
    setYear("");
    setMonth("");
    setDay("");
    onChange("");
  };

  const Select = ({
    value: val,
    onChange: onSel,
    options,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { label: string; value: string }[] | string[];
  }) => {
    const normalized =
      typeof options[0] === "string"
        ? (options as string[]).map((v) => ({ label: v, value: v }))
        : (options as { label: string; value: string }[]);
    return (
      <select
        value={val}
        onChange={(e) => onSel(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-white"
      >
        <option value="">—</option>
        {normalized.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="space-y-2 text-sm font-semibold text-white">
      {label && <span>{label}</span>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0f0f0f] px-4 py-3 text-left text-base text-white transition hover:border-white/30 focus:border-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={value ? "text-white" : "text-white/40"}>{displayValue}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white/60">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M16 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {value && (
          <button
            type="button"
            onClick={clear}
            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white"
          >
            Limpiar
          </button>
        )}
      </div>
      {open && (
        <div className="relative z-10">
          <div className="mt-2 grid gap-3 rounded-2xl border border-white/10 bg-[#0c0c0c] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.4)] md:grid-cols-3">
            <Select value={day} onChange={(v) => { setDay(v); updateValue(year, month, v); }} options={days} />
            <Select
              value={month}
              onChange={(v) => { setMonth(v); updateValue(year, v, day); }}
              options={months}
            />
            <Select value={year} onChange={(v) => { setYear(v); updateValue(v, month, day); }} options={years} />
          </div>
        </div>
      )}
      {name && <input type="hidden" name={name} value={value || ""} />}
    </div>
  );
}
