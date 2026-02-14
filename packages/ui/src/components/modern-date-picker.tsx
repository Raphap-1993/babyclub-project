"use client";

import { useEffect, useState } from "react";
import { Calendar, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, parse } from "date-fns";
import { es } from "date-fns/locale";

export interface ModernDatePickerProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  name?: string;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
}

export default function ModernDatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  name,
  disabled,
}: ModernDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.date-picker-container')) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;

  const displayValue = selectedDate 
    ? format(selectedDate, 'dd/MM/yyyy', { locale: es })
    : placeholder;

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
  };

  const selectDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    onChange(dateString);
    setOpen(false);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Agregar días del mes anterior para completar la primera semana
  const startDate = new Date(monthStart);
  const dayOfWeek = startDate.getDay();
  const daysFromPrevMonth = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Lunes = 0
  
  for (let i = daysFromPrevMonth; i > 0; i--) {
    const prevDate = new Date(monthStart);
    prevDate.setDate(prevDate.getDate() - i);
    days.unshift(prevDate);
  }

  // Agregar días del siguiente mes para completar la última semana
  while (days.length % 7 !== 0) {
    const nextDate = new Date(monthEnd);
    nextDate.setDate(nextDate.getDate() + (days.length - days.findIndex(d => !isSameMonth(d, currentMonth)) + 1));
    days.push(nextDate);
  }

  return (
    <div className="relative date-picker-container">
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className="w-full pl-10 pr-10 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 text-sm text-left transition-colors hover:bg-neutral-800/70 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={value ? "text-neutral-200" : "text-neutral-400"}>
            {displayValue}
          </span>
        </button>
        {value && !disabled && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <div className="bg-neutral-800/95 backdrop-blur-md border border-neutral-700/50 rounded-lg p-4 shadow-2xl w-72">
            {/* Header del calendario */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors rounded"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="text-sm font-semibold text-neutral-200 capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </h3>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors rounded"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                <div key={day} className="text-xs font-medium text-neutral-400 text-center py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid de días */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectDate(day)}
                    disabled={!isCurrentMonth}
                    className={`
                      w-8 h-8 text-xs rounded-md transition-colors relative
                      ${isSelected 
                        ? 'bg-rose-500 text-white font-semibold' 
                        : isCurrentMonth 
                          ? 'text-neutral-200 hover:bg-neutral-700/50' 
                          : 'text-neutral-600 cursor-not-allowed'
                      }
                      ${isTodayDate && !isSelected ? 'bg-rose-500/20 text-rose-300' : ''}
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
            
            {/* Quick actions */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-700/50">
              <button
                type="button"
                onClick={() => selectDate(new Date())}
                className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {name && <input type="hidden" name={name} value={value || ""} />}
    </div>
  );
}