"use client"

import * as React from "react"
import { DayPicker, DateRange } from "react-day-picker"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "lucide-react"
import { Button } from "./button"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export type DatePickerProps = {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Seleccionar fecha",
  disabled = false,
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal ${
            !date && "text-muted-foreground"
          } ${className}`}
          disabled={disabled}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP", { locale: es }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg" align="start">
        <DayPicker
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            onDateChange?.(selectedDate)
            setOpen(false)
          }}
          locale={es}
          className="p-3"
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium text-gray-900 dark:text-gray-100",
            nav: "space-x-1 flex items-center",
            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-gray-100/50 dark:[&:has([aria-selected].day-outside)]:bg-gray-800/50 [&:has([aria-selected])]:bg-gray-100 dark:[&:has([aria-selected])]:bg-gray-800 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md",
            day_range_end: "day-range-end",
            day_selected: "bg-purple-600 text-white hover:bg-purple-600 hover:text-white focus:bg-purple-600 focus:text-white",
            day_today: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
            day_outside: "day-outside text-gray-500 opacity-50 aria-selected:bg-gray-100/50 dark:aria-selected:bg-gray-800/50 aria-selected:text-gray-500 aria-selected:opacity-30",
            day_disabled: "text-gray-500 opacity-50",
            day_range_middle: "aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800 aria-selected:text-gray-900 dark:aria-selected:text-gray-100",
            day_hidden: "invisible",
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export type DateRangePickerProps = {
  dateRange?: DateRange
  onDateRangeChange?: (range: DateRange | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  placeholder = "Seleccionar rango de fechas",
  disabled = false,
  className = "",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal ${
            !dateRange?.from && "text-muted-foreground"
          } ${className}`}
          disabled={disabled}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "dd MMM", { locale: es })} -{" "}
                {format(dateRange.to, "dd MMM yyyy", { locale: es })}
              </>
            ) : (
              format(dateRange.from, "dd MMM yyyy", { locale: es })
            )
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg" align="start">
        <DayPicker
          mode="range"
          selected={dateRange}
          onSelect={onDateRangeChange}
          numberOfMonths={2}
          locale={es}
          className="p-3"
          classNames={{
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium text-gray-900 dark:text-gray-100",
            nav: "space-x-1 flex items-center",
            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-gray-100/50 dark:[&:has([aria-selected].day-outside)]:bg-gray-800/50 [&:has([aria-selected])]:bg-gray-100 dark:[&:has([aria-selected])]:bg-gray-800 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md",
            day_range_end: "day-range-end",
            day_selected: "bg-purple-600 text-white hover:bg-purple-600 hover:text-white focus:bg-purple-600 focus:text-white",
            day_today: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
            day_outside: "day-outside text-gray-500 opacity-50 aria-selected:bg-gray-100/50 dark:aria-selected:bg-gray-800/50 aria-selected:text-gray-500 aria-selected:opacity-30",
            day_disabled: "text-gray-500 opacity-50",
            day_range_middle: "aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800 aria-selected:text-gray-900 dark:aria-selected:text-gray-100",
            day_hidden: "invisible",
          }}
        />
      </PopoverContent>
    </Popover>
  )
}