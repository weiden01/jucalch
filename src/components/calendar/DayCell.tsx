"use client";

import type { StockEvent } from "@/lib/types";
import { EventChip } from "./EventChip";

const MAX_VISIBLE = 8;

export function DayCell({
  dateISO,
  dayNumber,
  isToday,
  isCurrentMonth,
  weekday,
  events,
  onEventClick,
  onDayClick,
}: {
  dateISO: string;
  dayNumber: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  weekday: number; // 0=Sun ... 6=Sat
  events: StockEvent[];
  onEventClick: (event: StockEvent) => void;
  onDayClick: (dateISO: string) => void;
}) {
  const overflow = events.length - MAX_VISIBLE;
  const visible = events.slice(0, MAX_VISIBLE);

  const weekdayColor =
    weekday === 0
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
