import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export type ParsedEventType =
  | "earnings"
  | "disclosure"
  | "dividend"
  | "ipo"
  | "macro";

export interface ParsedEvent {
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  type: ParsedEventType;
  ticker: string; // 종목코드, 없으면 "-"
  companyName: string; // 회사/주체명
  market?: "KOSPI" | "KOSDAQ" | "NASDAQ" | "NYSE" | "OTHER" | "NONE";
  title: string;
  summary: string;
  isImportant?: boolean;
}

export interface ParseResult {
  events: ParsedEvent[];
  reasoning?: string;
}

const SYSTEM_PROMPT = `너는 한국 주식/글로벌 매크로 이벤트 캘린더 편집자야.
주어진 텍스트(뉴스 기사, 요약, 메모, URL 스크래핑 결과)에서 캘린더에 등록할 이벤트를 추출해.

규칙:
1. 반드시 아래 JSON 스키마로만 응답. 다른 설명/주석 금지.
2. 이벤트가 없으면 { "events": [] } 반환.
3. 날짜가 명시되지 않았거나 추정 불가하면 그 이벤트는 events에서 제외.
4. 시간이 없으면 time 필드 생략.
5. type은 정확히 5개 중 하나: earnings(실적), disclosure(공시), dividend(배당), ipo(IPO/신규상장), macro(FOMC/CPI/금통위 등 매크로).
6. ticker는 실제 종목코드. 없거나 매크로 이벤트면 "-" 사용.
7. summary는 2~3문장, 핵심 관전 포인트 위주로 한국어 작성.
8. isImportant는 다음 중 하나라도 해당하면 true: 대형주 실적, FOMC/금통위/CPI, 시가총액 상위 IPO, 주주환원 관련 대규모 공시.
9. 상대 날짜(오늘, 내일, 다음 주 등)는 오늘이 {TODAY_ISO} 인 기준으로 절대 날짜로 변환.
10. 여러 이벤트가 있으면 배열로 다 뽑아. 애매하면 뽑지 마.

JSON 스키마:
{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM (선택)",
      "type": "earnings | disclosure | dividend | ipo | macro",
      "ticker": "종목코드 또는 -",
      "companyName": "회사명 또는 주체",
      "market": "KOSPI | KOSDAQ | NASDAQ | NYSE | OTHER | NONE",
      "title": "이벤트 제목 (한 줄)",
      "summary": "2~3문장 요약",
      "isImportant": boolean
    }
  ]
}`;

export async function parseMessageToEvents(
  text: string,
  todayISO: string,
): Promise<ParseResult> {
  if (!openai) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const systemPrompt = SYSTEM_PROMPT.replace("{TODAY_ISO}", todayISO);

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
    const parsed = JSON.parse(raw) as { events?: ParsedEvent[] };
    return { events: parsed.events ?? [] };
  } catch (e) {
    console.error("[gptParser] JSON parse failed", raw, e);
    return { events: [] };
  }
}
