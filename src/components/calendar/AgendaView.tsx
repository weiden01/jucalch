"use client";

import { motion } from "framer-motion";
import type { StockEvent } from "@/lib/types";
import { EVENT_TYPE_META } from "@/lib/types";
import { getHolidays, type Holiday } from "@/lib/holidays";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function relativeLabel(offset: number): string | null {
  if (offset === 0) return "오늘";
  if (offset === 1) return "내일";
  if (offset === 2) return "모레";
  return null;
}

export function AgendaView({
  startDate,
  dayCount,
  eventsByDate,
  onEventClick,
}: {
  startDate: Date;
  dayCount: number;
  eventsByDate: Map<string, StockEvent[]>;
  onEventClick: (event: StockEvent) => void;
}) {
  const days = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return { date: d, offset: i };
  });

  return (
    <div className="space-y-4">
      {days.map(({ date, offset }) => {
        const iso = fmtISO(date);
        const events = eventsByDate.get(iso) ?? [];
        return (
          <DaySection
            key={iso}
            date={date}
            offset={offset}
            events={events}
            onEventClick={onEventClick}
          />
        );
      })}
    </div>
  );
}

function DaySection({
  date,
  offset,
  events,
  onEventClick,
}: {
  date: Date;
  offset: number;
  events: StockEvent[];
  onEventClick: (event: StockEvent) => void;
}) {
  const weekday = WEEKDAY[date.getDay()];
  const isToday = offset === 0;
  const relLabel = relativeLabel(offset);
  const iso = fmtISO(date);
  const holidays = getHolidays(iso);
  const krHolidays = holidays.filter((h) => h.country === "KR");
  const usHolidays = holidays.filter((h) => h.country === "US");
  const hasKrHoliday = krHolidays.length > 0;
  const weekendClass =
    hasKrHoliday
      ? "text-rose-500 dark:text-rose-400"
      : date.getDay() === 0
      ? "text-rose-500 dark:text-rose-400"
      : date.getDay() === 6
      ? "text-blue-500 dark:text-blue-400"
      : "text-zinc-900 dark:text-zinc-100";

  return (
    <section
      data-date={iso}
      className={`rounded-2xl border p-5 transition data-[highlight=true]:ring-2 data-[highlight=true]:ring-emerald-400 data-[highlight=true]:ring-offset-2 data-[highlight=true]:ring-offset-white dark:data-[highlight=true]:ring-offset-zinc-950 ${
        isToday
          ? "border-emerald-400 bg-emerald-50/50 dark:border-emerald-600/60 dark:bg-emerald-950/20"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60"
      }`}
    >
      <header className="mb-4 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className={`text-xl font-bold ${weekendClass}`}>
              {date.getMonth() + 1}월 {date.getDate()}일
            </h2>
            <span className={`text-sm font-semibold ${weekendClass}`}>({weekday})</span>
            {relLabel && (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {relLabel}
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {events.length}개 이벤트
          </span>
        </div>
        {(krHolidays.length > 0 || usHolidays.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {krHolidays.map((h) => (
              <HolidayBadge key={`kr-${h.name}`} holiday={h} />
            ))}
            {usHolidays.map((h) => (
              <HolidayBadge key={`us-${h.name}`} holiday={h} />
            ))}
          </div>
        )}
      </header>
      {events.length === 0 ? (
        <div className="py-4 text-center text-sm text-zinc-400 dark:text-zinc-600">
          등록된 이벤트가 없습니다
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <EventRow key={e.id} event={e} onClick={() => onEventClick(e)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HolidayBadge({ holiday }: { holiday: Holiday }) {
  if (holiday.country === "KR") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
        <span className="text-[10px] opacity-70">한국</span>
        <span>{holiday.name}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      <span className="text-[10px] opacity-70">미장</span>
      <span>{holiday.name}</span>
    </span>
  );
}

function EventRow({
  event,
  onClick,
}: {
  event: StockEvent;
  onClick: () => void;
}) {
  const meta = EVENT_TYPE_META[event.type];
  return (
    <li>
      <motion.button
        layoutId={`event-chip-${event.id}`}
        onClick={onClick}
        whileHover={{ x: 3 }}
        className="group flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60"
      >
        <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${meta.dotClass}`} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.chipClass}`}>
              {meta.label}
            </span>
            {event.time && (
              <span className="text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
                {event.time}
              </span>
            )}
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {event.companyName}
              {event.ticker !== "-" && ` · ${event.ticker}`}
              {event.market && event.market !== "-" && ` · ${event.market}`}
            </span>
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {event.title}
          </h3>
          {event.summary && (
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {event.summary}
            </p>
          )}
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          className="mt-2 text-zinc-300 transition group-hover:text-zinc-500 dark:text-zinc-700 dark:group-hover:text-zinc-400"
        >
          <path
            d="M6 3l5 5-5 5"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.button>
    </li>
  );
}
