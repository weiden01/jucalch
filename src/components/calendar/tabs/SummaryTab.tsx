import type { StockEvent } from "@/lib/types";
import { EVENT_TYPE_META } from "@/lib/types";

export function SummaryTab({ event }: { event: StockEvent }) {
  const meta = EVENT_TYPE_META[event.type];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoField label="날짜" value={event.date} />
        <InfoField label="시간" value={event.time ?? "-"} />
        <InfoField label="종목/주체" value={`${event.companyName}${event.ticker !== "-" ? ` (${event.ticker})` : ""}`} />
        <InfoField label="시장/유형" value={`${event.market ?? "-"} · ${meta.label}`} />
      </div>
      {event.summary && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            요약
          </h3>
          <p className="text-zinc-800 leading-relaxed dark:text-zinc-200">
            {event.summary}
          </p>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}
