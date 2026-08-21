"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { eventRepo, groupEventsByDate } from "@/lib/repo";
import type { StockEvent } from "@/lib/types";
import { MonthGrid } from "./MonthGrid";
import { UpcomingSidebar } from "./UpcomingSidebar";
import { DayModal } from "./DayModal";
import { EventDeepDive } from "./EventDeepDive";

const MONTHS_FORWARD = 5;
const MONTHS_BACKWARD = 1;

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function buildMonthList(): Array<{ year: number; month0: number }> {
  const today = new Date();
  const list: Array<{ year: number; month0: number }> = [];
  const start = new Date(today.getFullYear(), today.getMonth() - MONTHS_BACKWARD, 1);
  for (let i = 0; i < MONTHS_BACKWARD + 1 + MONTHS_FORWARD; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    list.push({ year: d.getFullYear(), month0: d.getMonth() });
  }
  return list;
}

function rangeISO(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - MONTHS_BACKWARD, 1);
  const toDate = new Date(today.getFullYear(), today.getMonth() + MONTHS_FORWARD + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(toDate) };
}

export function CalendarView() {
  const [events, setEvents] = useState<StockEvent[]>([]);
  const [important, setImportant] = useState<StockEvent[]>([]);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<StockEvent | null>(null);

  const today = useMemo(todayISO, []);
  const months = useMemo(buildMonthList, []);

  useEffect(() => {
    const { from, to } = rangeISO();
    void eventRepo.getRange(from, to).then(setEvents);
    void eventRepo.getImportantUpcoming(from, 100).then(setImportant);
  }, []);

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);

  const handleEventClick = useCallback((event: StockEvent) => {
    setOpenEvent(event);
    setOpenDate(null);
  }, []);
  const handleDayClick = useCallback((dateISO: string) => {
    setOpenDate(dateISO);
    setOpenEvent(null);
  }, []);
  const handleClose = useCallback(() => {
    setOpenEvent(null);
    setOpenDate(null);
  }, []);

  const jumpToDate = useCallback((dateISO: string) => {
    const el = document.querySelector<HTMLElement>(`[data-date="${dateISO}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.dataset.highlight = "true";
    window.setTimeout(() => {
      delete el.dataset.highlight;
    }, 1800);
  }, []);

  const openDateEvents = openDate ? eventsByDate.get(openDate) ?? [] : [];

  return (
    <LayoutGroup>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-8">
        <main className="min-w-0 flex-1">
          {months.map((m) => (
            <MonthGrid
              key={`${m.year}-${m.month0}`}
              year={m.year}
              month0={m.month0}
              todayISO={today}
              eventsByDate={eventsByDate}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
            />
          ))}
        </main>
        <div className="hidden lg:block">
          <UpcomingSidebar events={important} onJump={jumpToDate} />
        </div>
      </div>

      <AnimatePresence>
        {openDate && (
          <DayModal
            key={`day-${openDate}`}
            dateISO={openDate}
            events={openDateEvents}
            onSelectEvent={handleEventClick}
            onClose={handleClose}
          />
        )}
        {openEvent && (
          <EventDeepDive
            key={`evt-${openEvent.id}`}
            event={openEvent}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
