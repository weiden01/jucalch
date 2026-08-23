"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { eventRepo, groupEventsByDate } from "@/lib/repo";
import { supabase, isSupabaseEnabled } from "@/lib/supabase";
import type { StockEvent } from "@/lib/types";
import { WeekRow } from "./WeekRow";
import { UpcomingSidebar } from "./UpcomingSidebar";
import { DayModal } from "./DayModal";
import { EventDeepDive } from "./EventDeepDive";
import { DateNav, type ViewMode } from "./DateNav";
import { AgendaView } from "./AgendaView";

const INITIAL_WEEKS_BEFORE = 4;
const INITIAL_WEEKS_AFTER = 12;
const LOAD_CHUNK_WEEKS = 8;

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function startOfWeek(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  c.setDate(c.getDate() - c.getDay());
  return c;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function CalendarView() {
  const today = useMemo(todayDate, []);
  const todayISO = fmtISO(today);
  const todayWeek = useMemo(() => startOfWeek(today), [today]);

  const [rangeStart, setRangeStart] = useState<Date>(
    () => addDays(todayWeek, -INITIAL_WEEKS_BEFORE * 7),
  );
  const [rangeEnd, setRangeEnd] = useState<Date>(
    () => addDays(todayWeek, INITIAL_WEEKS_AFTER * 7),
  );

  const [events, setEvents] = useState<StockEvent[]>([]);
  const [important, setImportant] = useState<StockEvent[]>([]);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<StockEvent | null>(null);
  const [mode, setMode] = useState<ViewMode>("month");

  const weeks = useMemo(() => {
    const arr: Date[] = [];
    for (let cur = new Date(rangeStart); cur < rangeEnd; cur = addDays(cur, 7)) {
      arr.push(new Date(cur));
    }
    return arr;
  }, [rangeStart, rangeEnd]);

  const [liveTick, setLiveTick] = useState(0);
  const [flashRecent, setFlashRecent] = useState(false);

  useEffect(() => {
    void eventRepo
      .getRange(fmtISO(rangeStart), fmtISO(rangeEnd))
      .then(setEvents);
  }, [rangeStart, rangeEnd, liveTick]);

  useEffect(() => {
    void eventRepo.getImportantUpcoming(todayISO, 100).then(setImportant);
  }, [todayISO, liveTick]);

  useEffect(() => {
    if (!isSupabaseEnabled) return;
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          setLiveTick((n) => n + 1);
          setFlashRecent(true);
          window.setTimeout(() => setFlashRecent(false), 2500);
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
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

  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const prependHeightRef = useRef<number | null>(null);
  const infiniteScrollEnabledRef = useRef(false);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!infiniteScrollEnabledRef.current) return;
        if (entry.isIntersecting) {
          setRangeEnd((prev) => addDays(prev, LOAD_CHUNK_WEEKS * 7));
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!infiniteScrollEnabledRef.current) return;
        if (entry.isIntersecting) {
          prependHeightRef.current = document.documentElement.scrollHeight;
          setRangeStart((prev) => addDays(prev, -LOAD_CHUNK_WEEKS * 7));
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (prependHeightRef.current !== null) {
      const delta =
        document.documentElement.scrollHeight - prependHeightRef.current;
      window.scrollTo({ top: window.scrollY + delta, behavior: "instant" as ScrollBehavior });
      prependHeightRef.current = null;
    }
  }, [rangeStart]);

  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current) return;
    if (weeks.length === 0) return;
    const doScroll = () => {
      const el = document.querySelector<HTMLElement>(`[data-date="${todayISO}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
      didInitialScroll.current = true;
      window.setTimeout(() => {
        infiniteScrollEnabledRef.current = true;
      }, 300);
    };
    const t = window.setTimeout(doScroll, 50);
    return () => window.clearTimeout(t);
  }, [weeks, todayISO]);

  const jumpToDate = useCallback(
    (dateISO: string, eventId?: string) => {
      const [y, m, d] = dateISO.split("-").map(Number);
      const target = new Date(y, m - 1, d);
      target.setHours(0, 0, 0, 0);
      const targetWeek = startOfWeek(target);

      // 아젠다 뷰(week/twoweek)면 target이 표시 범위 안에 있는지 확인.
      // 벗어나면 month 뷰로 전환 후 스크롤 (아젠다 뷰는 오늘로부터 8/15일만 표시)
      if (mode !== "month") {
        const dayCount = mode === "week" ? 8 : 15;
        const agendaEnd = new Date(today);
        agendaEnd.setDate(agendaEnd.getDate() + dayCount - 1);
        if (target < today || target > agendaEnd) {
          setMode("month");
        }
      }

      if (targetWeek < rangeStart) {
        prependHeightRef.current = document.documentElement.scrollHeight;
        setRangeStart(addDays(targetWeek, -LOAD_CHUNK_WEEKS * 7));
      }
      if (targetWeek >= rangeEnd) {
        setRangeEnd(addDays(targetWeek, (LOAD_CHUNK_WEEKS + 1) * 7));
      }

      let tries = 0;
      const doScroll = () => {
        // 1순위: event chip/row에 정확히 하이라이트
        let el: HTMLElement | null = null;
        if (eventId) {
          const matches = document.querySelectorAll<HTMLElement>(
            `[data-event-id="${eventId}"]`,
          );
          // 여러 개(기간 이벤트가 여러 날짜에 확장된 경우) 중 target 날짜 셀 안의 것 우선
          for (const cand of matches) {
            if (cand.closest(`[data-date="${dateISO}"]`)) {
              el = cand;
              break;
            }
          }
          if (!el && matches.length > 0) el = matches[0];
        }
        // 2순위: 날짜 셀
        if (!el) {
          el = document.querySelector<HTMLElement>(`[data-date="${dateISO}"]`);
        }
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.dataset.highlight = "true";
          window.setTimeout(() => delete el!.dataset.highlight, 1800);
        } else if (tries++ < 30) {
          requestAnimationFrame(doScroll);
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(doScroll));
    },
    [rangeStart, rangeEnd, mode, today],
  );

  const openDateEvents = openDate ? eventsByDate.get(openDate) ?? [] : [];

  const agendaDayCount = mode === "week" ? 8 : mode === "twoweek" ? 15 : 0;

  return (
    <LayoutGroup>
      <DateNav
        todayISO={todayISO}
        onJump={jumpToDate}
        mode={mode}
        onModeChange={setMode}
      />

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-8">
        <main className="min-w-0 flex-1">
          {mode === "month" ? (
            <>
              <WeekdayHeader />
              <div ref={topRef} className="h-1" />
              {weeks.map((weekStart, idx) => {
                const prev = idx > 0 ? weeks[idx - 1] : null;
                const showMonthLabel =
                  !prev ||
                  prev.getMonth() !== weekStart.getMonth() ||
                  prev.getFullYear() !== weekStart.getFullYear();
                return (
                  <Fragment key={fmtISO(weekStart)}>
                    <WeekRow
                      weekStart={weekStart}
                      todayISO={todayISO}
                      eventsByDate={eventsByDate}
                      onEventClick={handleEventClick}
                      onDayClick={handleDayClick}
                      showMonthLabel={showMonthLabel}
                    />
                  </Fragment>
                );
              })}
              <div ref={bottomRef} className="h-1" />
              <div className="py-4 text-center text-xs text-zinc-400 dark:text-zinc-600">
                아래로 스크롤하면 다음 주가 계속 로드됩니다
              </div>
            </>
          ) : (
            <AgendaView
              startDate={today}
              dayCount={agendaDayCount}
              eventsByDate={eventsByDate}
              onEventClick={handleEventClick}
            />
          )}
        </main>
        <div className="hidden lg:block">
          <UpcomingSidebar events={important} onJump={jumpToDate} />
        </div>
      </div>

      <AnimatePresence>
        {flashRecent && (
          <motion.div
            key="realtime-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            새 이벤트 반영됨
          </motion.div>
        )}
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

function WeekdayHeader() {
  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  return (
    <div className="sticky top-28 z-10 mb-2 grid grid-cols-[52px_1fr] gap-2 border-b border-zinc-200 bg-zinc-50/90 pb-2 backdrop-blur sm:grid-cols-[64px_1fr] dark:border-zinc-800 dark:bg-zinc-950/90">
      <div />
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {labels.map((w, i) => (
          <div
            key={w}
            className={`text-center text-xs font-semibold ${
              i === 0
                ? "text-rose-500"
                : i === 6
                ? "text-blue-500"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {w}
          </div>
        ))}
      </div>
    </div>
  );
}
