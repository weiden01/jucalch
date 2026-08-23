"use client";

import { useMemo, useState } from "react";

export type ViewMode = "month" | "week" | "twoweek";

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

export function DateNav({
  todayISO,
  onJump,
  mode,
  onModeChange,
}: {
  todayISO: string;
  onJump: (dateISO: string) => void;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}) {
  const [ty, tm, td] = todayISO.split("-").map(Number);
  const [year, setYear] = useState(ty);
  const [month, setMonth] = useState(tm);
  const [day, setDay] = useState(td);

  const years = useMemo(() => {
    const base = ty;
    const arr: number[] = [];
    for (let y = base - 10; y <= base + 10; y++) arr.push(y);
    return arr;
  }, [ty]);

  const dim = daysInMonth(year, month);
  const safeDay = Math.min(day, dim);

  const submit = () => {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
    onJump(iso);
  };

  const goToday = () => {
    setYear(ty);
    setMonth(tm);
    setDay(td);
    onJump(todayISO);
  };

  return (
    <div className="sticky top-14 z-20 border-b border-zinc-200/70 bg-white/85 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/85">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 lg:px-8">
        <Select
          value={year}
          onChange={(v) => setYear(Number(v))}
          options={years.map((y) => ({ label: `${y}년`, value: y }))}
        />
        <Select
          value={month}
          onChange={(v) => setMonth(Number(v))}
          options={Array.from({ length: 12 }, (_, i) => ({
            label: `${i + 1}월`,
            value: i + 1,
          }))}
        />
        <Select
          value={safeDay}
          onChange={(v) => setDay(Number(v))}
          options={Array.from({ length: dim }, (_, i) => ({
            label: `${i + 1}일`,
            value: i + 1,
          }))}
        />
        <button
          onClick={submit}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          이동
        </button>
        <button
          onClick={goToday}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          오늘로
        </button>

        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-100/70 p-0.5 dark:border-zinc-700 dark:bg-zinc-800/70">
          <ModeBtn active={mode === "month"} onClick={() => onModeChange("month")}>
            월단위
          </ModeBtn>
          <ModeBtn active={mode === "week"} onClick={() => onModeChange("week")}>
            주단위
          </ModeBtn>
          <ModeBtn active={mode === "twoweek"} onClick={() => onModeChange("twoweek")}>
            2주단위
          </ModeBtn>
        </div>
      </div>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function Select<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: string) => void;
  options: Array<{ label: string; value: T }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
