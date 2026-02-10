"use client";

import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Clock, X } from "lucide-react";

export interface ModernTimePickerProps {
  value: string; // formato "HH:mm" (24h)
  onChange: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ModernTimePicker({
  value,
  onChange,
  placeholder = "Seleccionar hora",
  disabled = false,
}: ModernTimePickerProps) {
  // Convertir string HH:mm a Date object
  const timeToDate = (timeStr: string): Date | null => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Convertir Date object a string HH:mm
  const dateToTime = (date: Date | null): string => {
    if (!date) return "";
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const selectedDate = timeToDate(value);

  const CustomInput = forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(({ value: inputValue, onClick }, ref) => (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-left transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
      }`}
    >
      <span className={inputValue ? "text-white" : "text-slate-400"}>
        {inputValue || placeholder}
      </span>
      <div className="flex items-center gap-2">
        {inputValue && !disabled && (
          <X
            className="h-4 w-4 text-slate-400 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          />
        )}
        <Clock className="h-4 w-4 text-slate-400" />
      </div>
    </button>
  ));

  CustomInput.displayName = "CustomInput";

  return (
    <div className="modern-time-picker">
      <style suppressHydrationWarning>{`
        .modern-time-picker .react-datepicker-popper {
          z-index: 9999 !important;
        }
        .modern-time-picker .react-datepicker {
          background-color: rgb(30 41 59) !important;
          border: 1px solid rgb(71 85 105) !important;
          border-radius: 0.5rem !important;
          font-family: inherit !important;
        }
        .modern-time-picker .react-datepicker__header {
          background-color: rgb(30 41 59) !important;
          border-bottom: 1px solid rgb(71 85 105) !important;
          padding: 8px 0 !important;
        }
        .modern-time-picker .react-datepicker-time__header {
          color: rgb(203 213 225) !important;
          font-size: 0.875rem !important;
          font-weight: 500 !important;
        }
        .modern-time-picker .react-datepicker__time-container {
          border-left: 1px solid rgb(71 85 105) !important;
        }
        .modern-time-picker .react-datepicker__time {
          background-color: rgb(30 41 59) !important;
        }
        .modern-time-picker .react-datepicker__time-box {
          width: 100% !important;
        }
        .modern-time-picker .react-datepicker__time-list {
          scrollbar-width: thin !important;
          scrollbar-color: rgb(71 85 105) rgb(30 41 59) !important;
        }
        .modern-time-picker .react-datepicker__time-list::-webkit-scrollbar {
          width: 8px !important;
        }
        .modern-time-picker .react-datepicker__time-list::-webkit-scrollbar-track {
          background: rgb(30 41 59) !important;
        }
        .modern-time-picker .react-datepicker__time-list::-webkit-scrollbar-thumb {
          background: rgb(71 85 105) !important;
          border-radius: 4px !important;
        }
        .modern-time-picker .react-datepicker__time-list-item {
          color: rgb(203 213 225) !important;
          padding: 8px 10px !important;
        }
        .modern-time-picker .react-datepicker__time-list-item:hover {
          background-color: rgb(51 65 85) !important;
        }
        .modern-time-picker .react-datepicker__time-list-item--selected {
          background-color: rgb(59 130 246) !important;
          color: white !important;
          font-weight: 500 !important;
        }
      `}</style>
      <DatePicker
        selected={selectedDate}
        onChange={(date: Date | null) => onChange(dateToTime(date))}
        showTimeSelect
        showTimeSelectOnly
        timeIntervals={15}
        timeCaption="Hora"
        dateFormat="h:mm aa"
        customInput={<CustomInput />}
        disabled={disabled}
      />
    </div>
  );
}
