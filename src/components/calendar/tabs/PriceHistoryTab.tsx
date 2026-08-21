import type { StockEvent } from "@/lib/types";

export function PriceHistoryTab({ event }: { event: StockEvent }) {
  const history = event.detail.priceHistory;
  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
        과거 주가 데이터가 없습니다. (매크로/일정 이벤트는 표시 대상 아님)
      </div>
    );
  }

  const closes = history.map((h) => h.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = Math.max(1, max - min);
  const width = 600;
  const height = 180;
  const stepX = width / (history.length - 1);
  const points = history
    .map((h, i) => {
      const x = i * stepX;
      const y = height - ((h.close - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  const first = history[0].close;
  const last = history[history.length - 1].close;
  const changePct = ((last - first) / first) * 100;
  const positive = changePct >= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {last.toLocaleString()}원
        </div>
        <div
          className={
            positive
              ? "text-sm font-medium text-rose-600 dark:text-rose-400"
              : "text-sm font-medium text-blue-600 dark:text-blue-400"
          }
        >
          {positive ? "+" : ""}
          {changePct.toFixed(2)}% ({history.length}일 기준)
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
          <polyline
            points={points}
            fill="none"
            stroke={positive ? "rgb(244 63 94)" : "rgb(37 99 235)"}
            strokeWidth={2}
          />
        </svg>
        <div className="mt-2 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{history[0].date}</span>
          <span>{history[history.length - 1].date}</span>
        </div>
      </div>
    </div>
  );
}
