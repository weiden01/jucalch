import type { StockEvent } from "@/lib/types";

export function MacroTab({ event }: { event: StockEvent }) {
  const macros = event.detail.macros;
  if (macros.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
        관련 매크로 지표가 아직 없습니다.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {macros.map((m) => (
        <div
          key={m.id}
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{m.name}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{m.value}</span>
            {m.change && (
              <span
                className={
                  m.change.startsWith("-")
                    ? "text-sm font-medium text-blue-600 dark:text-blue-400"
                    : "text-sm font-medium text-rose-600 dark:text-rose-400"
                }
              >
                {m.change}
              </span>
            )}
          </div>
          {m.note && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{m.note}</p>}
        </div>
      ))}
    </div>
  );
}
