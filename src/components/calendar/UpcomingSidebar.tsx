"use client";

import { motion } from "framer-motion";
import type { StockEvent } from "@/lib/types";
import { EVENT_TYPE_META } from "@/lib/types";

export function UpcomingSidebar({
  events,
  onJump,
}: {
  events: StockEvent[];
  onJump: (dateISO: string) => void;
}) {
  const grouped = new Map<string, StockEvent[]>();
  for (const e of events) {
    const arr = grouped.get(e.date) ?? [];
    arr.push(e);
    grouped.set(e.date, arr);
  }

  return (
    <aside className="sticky top-32 h-[calc(100vh-9rem)] w-72 flex-shrink-0 overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
      <h2 className="mb-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        주요 일정
      </h2>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        클릭하면 해당 날짜로 이동
      </p>
      <ul className="space-y-4">
        {[...grouped.entries()].map(([date, list]) => (
          <li key={date}>
            <div className="mb-1.5 text-xs font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
              {formatDateLabel(date)}
            </div>
            <ul className="space-y-1.5">
              {list.map((e) => {
                const meta = EVENT_TYPE_META[e.type];
                return (
                  <li key={e.id}>
                    <motion.button
                      whileHover={{ x: 3 }}
                      onClick={() => onJump(e.date)}
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
                    >
                      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${meta.dotClass}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {e.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {e.time && <span className="tabular-nums">{e.time}</span>}
                          <span>·</span>
                          <span>{e.companyName}</span>
                        </span>
                      </span>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${y.slice(2)}.${m}.${d} (${weekday})`;
}
