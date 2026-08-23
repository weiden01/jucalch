import OpenAI from "openai";

const rawKey = process.env.OPENAI_API_KEY ?? "";
// eslint-disable-next-line no-control-regex
const apiKey = rawKey.replace(/[^\x20-\x7e]/g, "").trim();
if (rawKey && apiKey !== rawKey) {
  console.warn("[gptParser] OPENAI_API_KEY had non-ASCII characters — sanitized");
}
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export type ParsedEventType =
  | "earnings"
  | "disclosure"
  | "dividend"
  | "ipo"
  | "macro";

export interface ParsedEvent {
  date: string;
  dateEnd?: string;
  dateLabel?: string;
  time?: string;
  type: ParsedEventType;
  ticker: string;
  companyName: string;
  market?: "KOSPI" | "KOSDAQ" | "NASDAQ" | "NYSE" | "OTHER" | "NONE";
  title: string;
  summary: string;
  isImportant?: boolean;
}

export interface LinkedEvent {
  existingId: string;
  reason: string;
  updateDateEnd?: string;
  updateDateLabel?: string;
  updateSummary?: string;
  updateIsImportant?: boolean;
}

export interface ParseResult {
  events: ParsedEvent[];
  linkedEvents: LinkedEvent[];
}

export interface ExistingEventContext {
  id: string;
  date: string;
  dateEnd?: string | null;
  dateLabel?: string | null;
  companyName: string;
  ticker: string;
  type: string;
  title: string;
}

const SYSTEM_PROMPT = `너는 한국 주식/글로벌 매크로 이벤트 캘린더 편집자야.
주어진 텍스트(뉴스 기사, 요약, 메모, URL 스크래핑 결과)에서 캘린더에 등록할 이벤트를 추출해.

**핵심 원칙**

0) 기존 이벤트와의 중복/연결 판단 (매우 중요)
   - 시스템 메시지 하단에 최근 등록된 이벤트 목록이 제공됨.
   - 새 메시지 내용이 아래 중 하나이면 **linkedEvents**로 반환하고 events에 넣지 마:
     * 기존 이벤트와 완전히 같은 이벤트 (같은 날/같은 주체/같은 이벤트 종류)
     * 기존 이벤트의 세부/속보 (예: 잭슨홀 미팅 기간 중 개별 연사, FOMC 발표 후속 해설)
     * 기존 이벤트의 관련 배경·전망 기사 (별도 이벤트가 아니라 참고자료)
   - 위 경우 linkedEvent에는:
     * existingId: 기존 이벤트 id
     * reason: 왜 연결로 판단했는지 한 문장
     * (선택) updateDateEnd: 새 정보로 이벤트 기간이 확장/명시되면 종료일 YYYY-MM-DD (예: "잭슨홀 8/27" 기존에 있는데 "잭슨홀 27~29" 새 정보가 오면 updateDateEnd: "2026-08-29")
     * (선택) updateDateLabel: 모호 표현이 새로 밝혀진 경우
     * (선택) updateSummary: 요약을 개선할 수 있으면 (기존 summary 유지가 나은 경우 생략)
     * (선택) updateIsImportant: 중요도가 명확해졌으면
   - 완전히 새로운 이벤트만 events 배열에 넣어라.

1) 여러 이벤트가 섞여 있을 때 — 문맥 정밀 파악
   - 텍스트에 여러 일정이 들어 있으면 각각을 개별 이벤트로 분리해서 뽑아.
   - 앞뒤 문맥을 정밀히 살펴서 "어느 날짜/시간이 어느 회사/이벤트에 속하는지" 정확히 매핑.
   - 같은 회사/주체에 여러 이벤트가 있으면 각각 분리 (예: 실적발표와 배당락이 같이 언급).
   - 애매하거나 날짜가 불분명한 이벤트는 뽑지 마. 확실한 것만.
   - 조건절/추측성 표현("~할 수도 있다", "예상된다") 이면서 날짜가 확정 안 됐으면 제외.

2) 날짜 (date, dateEnd, dateLabel)
   - **date**: 반드시 YYYY-MM-DD 형식. 단일 날짜든 기간이든 이 필드는 필수 (기간이면 시작일).
   - 상대 날짜(오늘, 내일, 이번주 금요일, 다음 주 화 등)는 오늘이 {TODAY_ISO} 기준으로 절대 날짜로 변환.
   - 요일만 있고 날짜 없으면 문맥에서 가장 가까운 미래 해당 요일로 추정.

   - **dateEnd** (선택): 이벤트가 기간(며칠~몇 주)에 걸치면 종료일을 YYYY-MM-DD로. 단일 날짜면 생략.
     예) "9월 24~26일 추석 연휴" → date: 2026-09-24, dateEnd: 2026-09-26
     예) "IPO 청약 8월 18~20일" → date: 2026-08-18, dateEnd: 2026-08-20
     예) "잭슨홀 심포지엄 8/22~24" → date: 2026-08-22, dateEnd: 2026-08-24

   - **dateLabel** (선택): 정확한 일자가 없고 "말/초/중순/분기말" 같은 모호 표현이면 한국어 라벨을 그대로 담아라. date에는 추정 날짜를 넣고, dateLabel에 원문 표현 유지.
     예) "8월 말 발표 예정" → date: 2026-08-28 (추정), dateLabel: "8월 말"
     예) "3분기 말 실적" → date: 2026-09-25 (추정), dateLabel: "3분기 말"
   - 시점이 완전히 불명(연도조차 모호)이면 events에서 제외.

3) 시간 (time, HH:MM) — 한국시간(KST) 기준으로 통일
   - 한국 이벤트는 원문의 한국시간 그대로.
   - **미국 이벤트는 반드시 한국시간(KST)으로 변환 후 저장**:
     * EDT(대략 3월 둘째 일 ~ 11월 첫째 일): ET + 13시간 = KST
     * EST(11월 첫째 일 ~ 3월 둘째 일): ET + 14시간 = KST
     * PT는 ET-3 기준.
   - **미국 밤 시간이 KST 다음 날이 될 수 있음 — 그럴 땐 date도 하루 뒤로 이동.**
   - 시간 확정 불가하면 time 생략.

4) 제목 (title) — 캘린더에 보일 핵심 한 줄. "주체 + 무슨 이벤트인지".

5) 이벤트 유형 (type)
   - earnings / disclosure / dividend / ipo / macro 중 하나.

6) 기타
   - ticker: 종목코드 또는 "-".
   - market: KOSPI/KOSDAQ/NASDAQ/NYSE/OTHER/NONE.
   - summary: 2~3문장, 관전 포인트 위주 한국어.
   - isImportant: 대형주 실적, FOMC/CPI/금통위, 시총 상위 IPO 등이면 true.

**응답 형식**
반드시 아래 JSON 스키마로만 응답. 다른 설명 없이 순수 JSON.

{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "dateEnd": "YYYY-MM-DD (선택)",
      "dateLabel": "선택",
      "time": "HH:MM (선택, KST)",
      "type": "earnings | disclosure | dividend | ipo | macro",
      "ticker": "종목코드 또는 -",
      "companyName": "회사명 또는 주체",
      "market": "KOSPI | KOSDAQ | NASDAQ | NYSE | OTHER | NONE",
      "title": "이벤트 제목",
      "summary": "2~3문장",
      "isImportant": true|false
    }
  ],
  "linkedEvents": [
    {
      "existingId": "기존 id",
      "reason": "왜 연결로 판단했는지 한 문장",
      "updateDateEnd": "YYYY-MM-DD (선택)",
      "updateDateLabel": "선택",
      "updateSummary": "선택",
      "updateIsImportant": true|false
    }
  ]
}

새 이벤트가 없으면 events: []. 연결 대상이 없으면 linkedEvents: [].`;

function formatExistingEvents(existing: ExistingEventContext[]): string {
  if (existing.length === 0) return "기존 이벤트: (없음)";
  const lines = existing.slice(0, 100).map((e) => {
    const range = e.dateEnd && e.dateEnd !== e.date ? `~${e.dateEnd}` : "";
    const label = e.dateLabel ? ` [${e.dateLabel}]` : "";
    return `- [id: ${e.id}] ${e.date}${range}${label} · ${e.type} · ${e.title} (${e.companyName}${e.ticker && e.ticker !== "-" ? " " + e.ticker : ""})`;
  });
  return `\n\n**기존 등록 이벤트 목록 (중복/연결 판단용)**\n${lines.join("\n")}`;
}

export async function parseMessageToEvents(
  text: string,
  todayISO: string,
  existingEvents: ExistingEventContext[] = [],
): Promise<ParseResult> {
  if (!openai) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const systemPrompt =
    SYSTEM_PROMPT.replace("{TODAY_ISO}", todayISO) + formatExistingEvents(existingEvents);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text.slice(0, 12000) },
    ],
    temperature: 0.2,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as {
      events?: ParsedEvent[];
      linkedEvents?: LinkedEvent[];
    };
    return {
      events: parsed.events ?? [],
      linkedEvents: parsed.linkedEvents ?? [],
    };
  } catch (e) {
    console.error("[gptParser] JSON parse failed", raw, e);
    return { events: [], linkedEvents: [] };
  }
}
