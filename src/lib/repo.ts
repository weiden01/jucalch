import type { StockEvent } from "./types";
import { MOCK_EVENTS } from "./mockEvents";

export interface EventRepo {
  getRange(fromISO: string, toISO: string): Promise<StockEvent[]>;
  getById(id: string): Promise<StockEvent | null>;
  getImportantUpcoming(fromISO: string, limit?: number): Promise<StockEvent[]>;
}

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

export const eventRepo: EventRepo = new MockEventRepo();

export function groupEventsByDate(events: StockEvent[]): Map<string, StockEvent[]> {
  const map = new Map<string, StockEvent[]>();
  for (const e of events) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  return map;
}
