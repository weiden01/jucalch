export type EventType = "earnings" | "disclosure" | "dividend" | "ipo" | "macro";

export const EVENT_TYPE_META: Record<
  EventType,
  { label: string; chipClass: string; dotClass: string }
> = {
  earnings: {
    label: "실적",
    chipClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-200",
    dotClass: "bg-blue-500",
  },
  disclosure: {
    label: "공시",
    chipClass:
      "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-200",
    dotClass: "bg-purple-500",
  },
  dividend: {
    label: "배당",
    chipClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200",
    dotClass: "bg-emerald-500",
  },
  ipo: {
    label: "IPO",
    chipClass:
      "bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-200",
    dotClass: "bg-orange-500",
  },
  macro: {
    label: "매크로",
    chipClass:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200",
    dotClass: "bg-rose-500",
  },
};

export interface Article {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
  excerpt?: string;
}

export interface MacroIndicator {
  id: string;
  name: string;
  value: string;
  change?: string;
  note?: string;
}

export interface PricePoint {
  date: string;
  close: number;
  volume?: number;
}

export interface EventDetail {
  articles: Article[];
  macros: MacroIndicator[];
  priceHistory: PricePoint[];
  breakingNews: unknown[];
  flowData: unknown[];
  [key: string]: unknown;
}

export interface StockEvent {
  id: string;
  date: string;
  time?: string;
  ticker: string;
  companyName: string;
  market?: "KOSPI" | "KOSDAQ" | "-";
  type: EventType;
  title: string;
  summary: string;
  isImportant?: boolean;
  detail: EventDetail;
}
