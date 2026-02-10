// apps/backoffice/components/ui/DateTimePicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type DateTimePickerProps = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export default function DateTimePicker({ label, value, onChange, required }: DateTimePickerProps) {
  const initialDate = value ? new Date(value) : new Date();
  const [open, setOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [{ date, time }, setParts] = useState<{ date: string; time: string }>(() => parseIso(value));

  useEffect(() => {
    setParts(parseIso(value));
  }, [value]);

  const displayLabel = useMemo(() => {
    if (!value) return "Selecciona fecha y hora";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Selecciona fecha y hora";
    return d.toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }, [value]);

  const days = useMemo(() => buildMonthDays(monthCursor), [monthCursor]);

  const commit = (nextDate: string, nextTime: string) => {
    setParts({ date: nextDate, time: nextTime });
    if (nextDate && nextTime) {
      const iso = toIso(nextDate, nextTime);
      if (iso) onChange(iso);
    }
  };

  const selectDay = (day: number | null) => {
    if (!day) return;
    const dateStr = formatYmd(monthCursor.getFullYear(), monthCursor.getMonth(), day);
    commit(dateStr, time);
  };

  const selectTime = (h: number, m: number) => {
    const padded = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    commit(date, padded);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-white" htmlFor={`dt-${label}`}>
        {label}
      </label>
      <div className="relative">
        <button
          id={`dt-${label}`}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-[#292929] bg-[#0c0c0c] px-4 py-3 text-left text-sm text-white outline-none transition focus:border-white"
        >
          <span className={value ? "text-white" : "text-white/50"}>{displayLabel}</span>
          <span aria-hidden className="text-white/60">⏷</span>
        </button>

        {open && (
          <div className="absolute z-30 mt-2 w-full max-h-[520px] overflow-y-auto rounded-2xl border border-[#292929] bg-[#0c0c0c] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setMonthCursor(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  className="h-9 w-9 rounded-xl border border-[#292929] text-white/70 transition hover:border-white/40"
                >
                  ‹
                </button>
                <div className="text-sm font-semibold text-white">
                  {monthCursor.toLocaleString("es-PE", { month: "long", year: "numeric" })}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMonthCursor(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  className="h-9 w-9 rounded-xl border border-[#292929] text-white/70 transition hover:border-white/40"
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-white/60">
                {WEEKDAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {days.map((day, idx) => {
                  const isSelected = day && date === formatYmd(monthCursor.getFullYear(), monthCursor.getMonth(), day);
                  return (
                    <button
                      key={`${day}-${idx}`}
                      type="button"
                      onClick={() => selectDay(day)}
                      disabled={!day}
                      className={`h-10 rounded-xl border text-sm transition ${
                        !day
                          ? "border-transparent"
                          : isSelected
                            ? "border-[#a60c2f]/70 bg-[#a60c2f]/15 text-white shadow-[0_12px_26px_rgba(166,12,47,0.30)]"
                            : "border-[#292929] bg-[#0a0a0a] text-white/90 hover:border-white/30"
                      }`}
                    >
                      {day ?? ""}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-[#292929] bg-[#0a0a0a] p-3">
                <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.1em] text-white/60">
                  <span>Hora (24h)</span>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-white/80">
                    {time || "—"}
                  </span>
                </div>
                <div className="flex gap-3">
                  <div className="grid max-h-48 flex-1 grid-cols-3 gap-2 overflow-y-auto pr-1">
                    {HOURS.map((h) => {
                      const label = h.toString().padStart(2, "0");
                      const isSelected = time.startsWith(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => selectTime(h, parseInt(time.split(":")[1] || "0", 10))}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                            isSelected
                              ? "border border-[#a60c2f]/70 bg-[#a60c2f]/15 text-white shadow-[0_8px_18px_rgba(166,12,47,0.28)]"
                              : "border border-[#292929] bg-[#0c0c0c] text-white/80 hover:border-white/30"
                          }`}
                        >
                          {label}:00
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {MINUTES.map((m) => {
                      const currentHour = time ? parseInt(time.split(":")[0], 10) || 0 : 0;
                      const label = `${m.toString().padStart(2, "0")} min`;
                      const isSelected = time.endsWith(`:${m.toString().padStart(2, "0")}`);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => selectTime(currentHour, m)}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                            isSelected
                              ? "border border-[#a60c2f]/70 bg-[#a60c2f]/15 text-white shadow-[0_8px_18px_rgba(166,12,47,0.28)]"
                              : "border border-[#292929] bg-[#0c0c0c] text-white/80 hover:border-white/30"
                          }`}
                        >
                          :{m.toString().padStart(2, "0")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-[#292929] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-white/40"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (date && time) {
                      const iso = toIso(date, time);
                      if (iso) onChange(iso);
                    }
                    setOpen(false);
                  }}
                  className="rounded-xl bg-gradient-to-r from-[#a60c2f] to-[#6f0c25] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(166,12,47,0.42)] transition hover:shadow-[0_14px_34px_rgba(166,12,47,0.5)]"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function parseIso(iso?: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 16);
  return { date, time };
}

function toIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const iso = new Date(`${date}T${time}:00`).toISOString();
  return iso;
}

function buildMonthDays(anchor: Date): Array<number | null> {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Lunes=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: Array<number | null> = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function formatYmd(year: number, monthZeroBased: number, day: number) {
  const m = (monthZeroBased + 1).toString().padStart(2, "0");
  const d = day.toString().padStart(2, "0");
  return `${year}-${m}-${d}`;
}
