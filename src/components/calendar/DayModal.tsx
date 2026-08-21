"use client";

import { motion } from "framer-motion";
import type { StockEvent } from "@/lib/types";
import { EVENT_TYPE_META } from "@/lib/types";

export function DayModal({
  dateISO,
  events,
  onSelectEvent,
  onClose,
}: {
  dateISO: string;
  events: StockEvent[];
  onSelectEvent: (event: StockEvent) => void;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-md"
      />
      <motion.div
        layoutId={`day-modal-${dateISO}`}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }}
      >
        <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {formatFullDate(dateISO)}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              총 {events.length}개 이벤트
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="닫기"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <ul className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
          {events.map((e) => {
            const meta = EVENT_TYPE_META[e.type];
            return (
              <li key={e.id}>
                <motion.button
                  layoutId={`event-chip-${e.id}`}
                  onClick={() => onSelectEvent(e)}
                  className="flex w-full items-start gap-3 px-6 py-4 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${meta.dotClass}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.chipClass}`}>
                        {meta.label}
                      </span>
                      {e.time && (
                        <span className="text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                          {e.time}
                        </span>
                      )}
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {e.companyName}
                        {e.ticker !== "-" && ` (${e.ticker})`}
                      </span>
                    </div>
                    <h3 className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                      {e.title}
                    </h3>
                    {e.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {e.summary}
                      </p>
                    )}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" className="mt-2 text-zinc-400">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.button>
              </li>
            );
          })}
        </ul>
      </motion.div>
    </>
  );
}

function formatFullDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${y}년 ${Number(m)}월 ${Number(d)}일 (${weekday})`;
}
