import type { ComponentType } from "react";
import type { StockEvent } from "@/lib/types";
import { SummaryTab } from "./tabs/SummaryTab";
import { ArticlesTab } from "./tabs/ArticlesTab";
import { MacroTab } from "./tabs/MacroTab";
import { PriceHistoryTab } from "./tabs/PriceHistoryTab";

export interface DetailTabDef {
  key: string;
  label: string;
  Component: ComponentType<{ event: StockEvent }>;
}

// 새 탭을 추가하려면 이 배열에 한 줄만 추가하면 됨.
// 예: { key: "flow", label: "수급 추이", Component: FlowTab },
export const DETAIL_TABS: DetailTabDef[] = [
  { key: "summary", label: "요약", Component: SummaryTab },
  { key: "articles", label: "관련 기사", Component: ArticlesTab },
  { key: "macros", label: "매크로", Component: MacroTab },
  { key: "history", label: "과거 무빙", Component: PriceHistoryTab },
];
