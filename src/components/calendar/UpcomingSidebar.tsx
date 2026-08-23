"use client";

import { motion } from "framer-motion";
import type { StockEvent } from "@/lib/types";
import { EVENT_TYPE_META } from "@/lib/types";

export function UpcomingSidebar({
  events,
  onJump,
}: {
  events: StockEvent[];
  onJump: (dateISO: string, eventId?: string) => void;
}) {
  // 각 이벤트는 이미 유니크 (getImportantUpcoming이 event 단위로 반환)
  // 사이드바에서는 이벤트별 카드 형태로 표시
  const sorted = [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time ?? "").localeCompare(b.time ?? "");
  });

  return (
    <aside className="sticky top-32 h-[calc(100vh-9rem)] w-72 flex-shrink-0 overflow-y-auto overscroll-contain rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          주요 일정
        </h2>
        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          {sorted.length}개
        </span>
      </div>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        클릭하면 해당 날짜로 이동
      </p>
      <ol className="relative space-y-2 border-l-2 border-emerald-100 pl-4 dark:border-emerald-900/40">
        {sorted.map((e) => {
          const meta = EVENT_TYPE_META[e.type];
          return (
            <li key={e.id} className="relative">
              <span
                className={`absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900 ${meta.dotClass}`}
              />
              <motion.button
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onJump(e.date, e.id)}
                className="group flex w-full flex-col rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50/60 dark:hover:border-emerald-800/50 dark:hover:bg-emerald-950/30"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-emerald-700 dark:text-emerald-400">
                  {formatEventDate(e)}
                </span>
                <span className="mt-0.5 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {e.title}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {e.time && <span className="tabular-nums font-medium">{e.time}</span>}
                  {e.time && <span>·</span>}
                  <span className="truncate">{e.companyName}</span>
                </span>
              </motion.button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function formatEventDate(e: StockEvent): string {
  const start = fmtShort(e.date);
  if (e.dateLabel && e.dateEnd && e.dateEnd !== e.date) {
    return `${start}~${fmtShortDayOnly(e.dateEnd)} · ${e.dateLabel}`;
  }
  if (e.dateEnd && e.dateEnd !== e.date) {
    return `${start}~${fmtShortDayOnly(e.dateEnd)}`;
  }
  if (e.dateLabel) {
    return `${start} · ${e.dateLabel}`;
  }
  return start;
}

function fmtShort(iso: string): string {
  const [y, m, d] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${y.slice(2)}.${m}.${d} (${weekday})`;
}
function fmtShortDayOnly(iso: string): string {
  const [, , d] = iso.split("-");
  return d;
}
