"use client";

import type { StockEvent } from "@/lib/types";
import { DayCell } from "./DayCell";

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function WeekRow({
  weekStart,
  todayISO,
  eventsByDate,
  onEventClick,
  onDayClick,
  showMonthLabel,
}: {
  weekStart: Date;
  todayISO: string;
  eventsByDate: Map<string, StockEvent[]>;
  onEventClick: (event: StockEvent) => void;
  onDayClick: (dateISO: string) => void;
  showMonthLabel: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return {
      dateISO: fmtISO(d),
      dayNumber: d.getDate(),
      month0: d.getMonth(),
      year: d.getFullYear(),
      weekday: i,
    };
  });

  return (
    <div className="mb-1 grid grid-cols-[52px_1fr] gap-2 sm:grid-cols-[64px_1fr]">
      <div className="pt-2 text-right">
        {showMonthLabel ? (
          <div className="sticky top-32">
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {days[0].month0 + 1}월
            </div>
            <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-500">
              {days[0].year}
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-zinc-400 dark:text-zinc-600">
            {days[0].dayNumber}~{days[6].dayNumber}
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((d) => (
          <DayCell
            key={d.dateISO}
            dateISO={d.dateISO}
            dayNumber={d.dayNumber}
            weekday={d.weekday}
            isToday={d.dateISO === todayISO}
            isCurrentMonth={true}
            events={eventsByDate.get(d.dateISO) ?? []}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
          />
        ))}
      </div>
    </div>
  );
}
