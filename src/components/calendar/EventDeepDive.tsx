"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StockEvent } from "@/lib/types";
import { EVENT_TYPE_META } from "@/lib/types";
import { eventRepo } from "@/lib/repo";
import { DETAIL_TABS } from "./detailTabs";

export function EventDeepDive({
  event,
  onClose,
}: {
  event: StockEvent;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState(DETAIL_TABS[0].key);
  const [enriched, setEnriched] = useState<StockEvent>(event);

  useEffect(() => {
    let cancelled = false;
    void eventRepo.getById(event.id).then((full) => {
      if (!cancelled && full) setEnriched(full);
    });
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  const meta = EVENT_TYPE_META[enriched.type];
  const ActiveComponent =
    DETAIL_TABS.find((t) => t.key === activeTab)?.Component ?? DETAIL_TABS[0].Component;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-md"
      />
      <motion.div
        layoutId={`event-chip-${event.id}`}
        initial={{ opacity: 0, scale: 0.85, rotateX: -8 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
        exit={{ opacity: 0, scale: 0.85, rotateX: -8 }}
        transition={{ type: "spring", damping: 24, stiffness: 220 }}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        style={{
          boxShadow: "0 40px 100px rgba(0,0,0,0.45)",
          transformStyle: "preserve-3d",
        }}
      >
        <header className="border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <div className="mb-2 flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${meta.chipClass}`}>
              {meta.label}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {event.date}
              {event.time && ` · ${event.time}`}
            </span>
            <div className="ml-auto">
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="닫기"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {event.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {event.companyName}
            {event.ticker !== "-" && ` · ${event.ticker}`}
            {event.market && event.market !== "-" && ` · ${event.market}`}
          </p>
        </header>

        <nav className="flex gap-1 border-b border-zinc-100 px-4 dark:border-zinc-800">
          {DETAIL_TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {tab.label}
                {active && (
                  <motion.div
                    layoutId="detail-tab-underline"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-emerald-500"
                    transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <ActiveComponent event={enriched} />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
