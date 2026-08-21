"use client";

import type { StockEvent } from "@/lib/types";
import { DayCell } from "./DayCell";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toISO(year: number, month0: number, day: number): string {
  const m = String(month0 + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function MonthGrid({
  year,
  month0, // 0-11
  eventsByDate,
  todayISO,
  onEventClick,
  onDayClick,
}: {
  year: number;
  month0: number;
  eventsByDate: Map<string, StockEvent[]>;
  todayISO: string;
  onEventClick: (event: StockEvent) => void;
  onDayClick: (dateISO: string) => void;
}) {
  const firstOfMonth = new Date(year, month0, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month0, 0).getDate();

  const cells: Array<{
    dateISO: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    weekday: number;
  }> = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevYear = month0 === 0 ? year - 1 : year;
    const prevMonth0 = month0 === 0 ? 11 : month0 - 1;
    cells.push({
      dateISO: toISO(prevYear, prevMonth0, day),
      dayNumber: day,
      isCurrentMonth: false,
      weekday: cells.length % 7,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      dateISO: toISO(year, month0, day),
      dayNumber: day,
      isCurrentMonth: true,
      weekday: cells.length % 7,
    });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= remaining; day++) {
    const nextYear = month0 === 11 ? year + 1 : year;
    const nextMonth0 = month0 === 11 ? 0 : month0 + 1;
    cells.push({
      dateISO: toISO(nextYear, nextMonth0, day),
      dayNumber: day,
      isCurrentMonth: false,
      weekday: cells.length % 7,
    });
  }

  return (
    <section id={`month-${year}-${String(month0 + 1).padStart(2, "0")}`} className="mb-10">
      <header className="mb-3 flex items-baseline gap-3">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {year}년 {month0 + 1}월
        </h2>
      </header>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`pb-1 text-center text-xs font-semibold ${
              i === 0 ? "text-rose-500" : i === 6 ? "text-blue-500" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {w}
          </div>
        ))}
        {cells.map((c) => (
          <DayCell
            key={c.dateISO}
            dateISO={c.dateISO}
            dayNumber={c.dayNumber}
            isCurrentMonth={c.isCurrentMonth}
            weekday={c.weekday}
            isToday={c.dateISO === todayISO}
            events={eventsByDate.get(c.dateISO) ?? []}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
          />
        ))}
      </div>
    </section>
  );
}
