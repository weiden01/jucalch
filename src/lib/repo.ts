import type { StockEvent, EventType } from "./types";
import { MOCK_EVENTS } from "./mockEvents";
import { supabase, isSupabaseEnabled } from "./supabase";

export interface EventRepo {
  getRange(fromISO: string, toISO: string): Promise<StockEvent[]>;
  getById(id: string): Promise<StockEvent | null>;
  getImportantUpcoming(fromISO: string, limit?: number): Promise<StockEvent[]>;
}

// ============================================================
// Mock Repository (env 없을 때 폴백)
// ============================================================
class MockEventRepo implements EventRepo {
  private sorted = [...MOCK_EVENTS].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time ?? "").localeCompare(b.time ?? "");
  });

  async getRange(fromISO: string, toISO: string) {
    return this.sorted.filter((e) => e.date >= fromISO && e.date <= toISO);
  }
  async getById(id: string) {
    return this.sorted.find((e) => e.id === id) ?? null;
  }
  async getImportantUpcoming(fromISO: string, limit = 50) {
    return this.sorted
      .filter((e) => e.date >= fromISO && e.isImportant)
      .slice(0, limit);
  }
}

// ============================================================
// Supabase Repository (env 있을 때 사용)
// ============================================================
interface EventRow {
  id: string;
  date: string;
  date_end: string | null;
  date_label: string | null;
  time: string | null;
  ticker: string;
  company_name: string;
  market: string | null;
  type: EventType;
  title: string;
  summary: string | null;
  is_important: boolean | null;
}
interface ArticleRow {
  id: string;
  event_id: string;
  title: string;
  source: string;
  url: string | null;
  excerpt: string | null;
  published_at: string | null;
}
interface MacroRow {
  id: string;
  event_id: string;
  name: string;
  value: string;
  change: string | null;
  note: string | null;
}
interface PriceRow {
  event_id: string;
  date: string;
  close: number;
  volume: number | null;
}

function rowToEvent(
  row: EventRow,
  articles: ArticleRow[] = [],
  macros: MacroRow[] = [],
  prices: PriceRow[] = [],
): StockEvent {
  return {
    id: row.id,
    date: row.date,
    dateEnd: row.date_end ?? undefined,
    dateLabel: row.date_label ?? undefined,
    time: row.time ?? undefined,
    ticker: row.ticker,
    companyName: row.company_name,
    market: (row.market as StockEvent["market"]) ?? "-",
    type: row.type,
    title: row.title,
    summary: row.summary ?? "",
    isImportant: row.is_important ?? false,
    detail: {
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        source: a.source,
        url: a.url ?? undefined,
        excerpt: a.excerpt ?? undefined,
        publishedAt: a.published_at ?? "",
      })),
      macros: macros.map((m) => ({
        id: m.id,
        name: m.name,
        value: m.value,
        change: m.change ?? undefined,
        note: m.note ?? undefined,
      })),
      priceHistory: prices.map((p) => ({
        date: p.date,
        close: Number(p.close),
        volume: p.volume ?? undefined,
      })),
      breakingNews: [],
      flowData: [],
    },
  };
}

class SupabaseEventRepo implements EventRepo {
  async getRange(fromISO: string, toISO: string) {
    if (!supabase) return [];
    const { data: rows, error } = await supabase
      .from("events")
      .select("*")
      .gte("date", fromISO)
      .lte("date", toISO)
      .order("date", { ascending: true })
      .order("time", { ascending: true, nullsFirst: true });
    if (error) {
      console.error("[repo] getRange", error);
      return [];
    }
    return (rows as EventRow[]).map((r) => rowToEvent(r));
  }

  async getById(id: string) {
    if (!supabase) return null;
    const [ev, arts, macs, prcs] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).maybeSingle(),
      supabase.from("event_articles").select("*").eq("event_id", id),
      supabase.from("event_macros").select("*").eq("event_id", id),
      supabase
        .from("event_price_points")
        .select("*")
        .eq("event_id", id)
        .order("date", { ascending: true }),
    ]);
    if (ev.error || !ev.data) return null;
    return rowToEvent(
      ev.data as EventRow,
      (arts.data ?? []) as ArticleRow[],
      (macs.data ?? []) as MacroRow[],
      (prcs.data ?? []) as PriceRow[],
    );
  }

  async getImportantUpcoming(fromISO: string, limit = 50) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .gte("date", fromISO)
      .eq("is_important", true)
      .order("date", { ascending: true })
      .order("time", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (error) {
      console.error("[repo] getImportantUpcoming", error);
      return [];
    }
    return (data as EventRow[]).map((r) => rowToEvent(r));
  }
}

// ============================================================
// 활성 리포지토리 선택
// ============================================================
export const eventRepo: EventRepo = isSupabaseEnabled
  ? new SupabaseEventRepo()
  : new MockEventRepo();

export function groupEventsByDate(events: StockEvent[]): Map<string, StockEvent[]> {
  const map = new Map<string, StockEvent[]>();
  for (const e of events) {
    const start = e.date;
    const end = e.dateEnd && e.dateEnd >= e.date ? e.dateEnd : e.date;
    if (start === end) {
      const arr = map.get(start) ?? [];
      arr.push(e);
      map.set(start, arr);
      continue;
    }
    // 기간 이벤트: 시작~종료 각 날짜에 chip 노출
    const [sy, sm, sd] = start.split("-").map(Number);
    const [ey, em, ed] = end.split("-").map(Number);
    const startD = new Date(sy, sm - 1, sd);
    const endD = new Date(ey, em - 1, ed);
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = map.get(iso) ?? [];
      arr.push(e);
      map.set(iso, arr);
    }
  }
  return map;
}
