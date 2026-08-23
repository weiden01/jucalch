"use client";

import type { StockEvent } from "@/lib/types";
import type { Holiday } from "@/lib/holidays";
import { EventChip } from "./EventChip";

const MAX_VISIBLE = 8;

export function DayCell({
  dateISO,
  dayNumber,
  isToday,
  isCurrentMonth,
  weekday,
  events,
  holidays,
  onEventClick,
  onDayClick,
}: {
  dateISO: string;
  dayNumber: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  weekday: number;
  events: StockEvent[];
  holidays: Holiday[];
  onEventClick: (event: StockEvent) => void;
  onDayClick: (dateISO: string) => void;
}) {
  const overflow = events.length - MAX_VISIBLE;
  const visible = events.slice(0, MAX_VISIBLE);

  const krHolidays = holidays.filter((h) => h.country === "KR");
  const usHolidays = holidays.filter((h) => h.country === "US");

  const hasKrHoliday = krHolidays.length > 0;
  const weekdayColor = hasKrHoliday
    ? "text-rose-500"
    : weekday === 0
    ? "text-rose-500"
    : weekday === 6
    ? "text-blue-500"
    : "text-zinc-500 dark:text-zinc-400";

  return (
    <div
      data-date={dateISO}
      className={`group relative flex min-h-32 flex-col rounded-lg border p-1.5 transition-colors ${
        isCurrentMonth
          ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50"
          : "border-zinc-100 bg-zinc-50/40 dark:border-zinc-900 dark:bg-zinc-950/40"
      } data-[highlight=true]:ring-2 data-[highlight=true]:ring-emerald-400 data-[highlight=true]:ring-offset-2 data-[highlight=true]:ring-offset-white dark:data-[highlight=true]:ring-offset-zinc-950`}
    >
      <button
        onClick={() => events.length > 0 && onDayClick(dateISO)}
        disabled={events.length === 0}
        className={`mb-1 flex items-center justify-between rounded px-1 text-xs font-semibold ${
          events.length > 0
            ? "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
            : "cursor-default"
        }`}
      >
        <span className={`${isCurrentMonth ? weekdayColor : "text-zinc-300 dark:text-zinc-700"}`}>
          {dayNumber}
        </span>
        {isToday && (
          <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
            TODAY
          </span>
        )}
      </button>

      {(krHolidays.length > 0 || usHolidays.length > 0) && (
        <div className="mb-1 space-y-0.5 px-0.5">
          {krHolidays.map((h) => (
            <div
              key={`kr-${h.name}`}
              className="truncate text-[10px] font-semibold text-rose-600 dark:text-rose-400"
              title={h.name}
            >
              {h.name}
            </div>
          ))}
          {usHolidays.map((h) => (
            <div
              key={`us-${h.name}`}
              className="flex items-center gap-1 truncate text-[10px] text-zinc-500 dark:text-zinc-500"
              title={`미장 휴장 · ${h.name}`}
            >
              <span className="rounded bg-zinc-200 px-1 py-px text-[8px] font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                미장
              </span>
              <span className="truncate">{h.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-0.5">
        {visible.map((e) => (
          <EventChip key={e.id} event={e} onClick={() => onEventClick(e)} />
        ))}
        {overflow > 0 && (
          <button
            onClick={() => onDayClick(dateISO)}
            className="mt-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            +{overflow}개 더
          </button>
        )}
      </div>
    </div>
  );
}
