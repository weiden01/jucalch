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
  date: string; // YYYY-MM-DD
  dateEnd?: string; // 기간 종료 (YYYY-MM-DD), 단일 날짜면 생략
  dateLabel?: string; // 모호 시점 텍스트 ("8월 말", "3분기 초" 등)
  time?: string; // HH:MM (한국시간 기준)
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

**핵심 원칙**

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
     예) "8월 초 IPO 예정" → date: 2026-08-05 (추정), dateLabel: "8월 초"
     예) "8월 중순 배당락" → date: 2026-08-15 (추정), dateLabel: "8월 중순"
     예) "3분기 말 실적" → date: 2026-09-25 (추정), dateLabel: "3분기 말"
     예) "3분기 초" → date: 2026-07-05 (추정), dateLabel: "3분기 초"
     예) "3분기 중" → date: 2026-08-15 (추정), dateLabel: "3분기 중"
   - dateLabel과 dateEnd가 동시에 있을 수도 있음 (예: "3분기 말경 실적 발표 시즌" → date + dateLabel + dateEnd 조합 가능).
   - 시점이 완전히 불명(연도조차 모호)이면 events에서 제외.

3) 시간 (time, HH:MM) — 한국시간(KST) 기준으로 통일
   - 한국 이벤트는 원문의 한국시간 그대로.
     예) "장 마감 후 실적" → 16:00, "장 시작 전" → 08:30
   - **미국 이벤트는 반드시 한국시간(KST)으로 변환 후 저장**:
     * 미국 동부 서머타임(EDT, 대략 3월 둘째 일요일 ~ 11월 첫째 일요일): ET + 13시간 = KST
       예) FOMC 발표 14:00 ET (여름) → 03:00 KST **다음 날짜**
       예) NYSE 정규장 개장 09:30 ET → 22:30 KST 같은 날
       예) NYSE 정규장 마감 16:00 ET → 05:00 KST **다음 날짜**
       예) 엔비디아 실적 장마감 후 (통상 16:20 ET) → 05:20 KST **다음 날짜**
     * 미국 동부 표준시(EST, 11월 첫째 일 ~ 3월 둘째 일): ET + 14시간 = KST
       예) FOMC 발표 14:00 ET (겨울) → 04:00 KST 다음 날짜
     * 미국 서부 시간(PT)이면 EDT/EST 대비 -3시간 후 KST 변환 (여름 +16, 겨울 +17).
     * 시간대 명시 없이 "미국 시간"이라고만 있으면 동부 기준으로 계산.
   - **UTC 오프셋으로 인해 미국 밤 시간이 KST에서는 다음 날이 될 수 있음 — 그럴 땐 date도 함께 하루 뒤로 이동시켜야 함.**
   - 상황상 시간 확정 불가하면 time 필드 생략 (null).

4) 제목 (title) — 캘린더에 보일 핵심
   - 한 줄, 핵심만. "회사명/주체 + 무슨 이벤트인지" 형식.
   - 예) "삼성전자 3분기 확정실적 발표", "9월 FOMC 금리 결정", "노바메디텍 코스닥 상장"

5) 이벤트 유형 (type) — 정확히 5개 중 하나
   - earnings: 실적 발표 (분기·연간·잠정·확정 포함)
   - disclosure: 공시 (자사주 소각, 유상·무상증자, M&A 발표, 주주총회 소집공고 등)
   - dividend: 배당 (배당락일, 배당 지급일, 배당 발표)
   - ipo: 신규 상장 / 청약 / 수요예측
   - macro: FOMC, ECB, CPI, PPI, 고용, 금통위, 잭슨홀 등 매크로

6) 기타 필드
   - ticker: 실제 종목코드 (예: 005930). 없거나 매크로 이벤트면 "-".
   - companyName: 회사명 또는 이벤트 주체 (예: "美 FOMC", "한국은행 금통위").
   - market: KOSPI/KOSDAQ/NASDAQ/NYSE/OTHER/NONE 중 하나.
   - summary: 2~3문장, 왜 중요한지·관전 포인트 위주 한국어.
   - isImportant: 대형주(시총 상위) 실적, FOMC/CPI/금통위/PPI, 시가총액 상위 IPO, 대규모 주주환원 공시 등이면 true.

**응답 형식**
반드시 아래 JSON 스키마로만 응답. 다른 설명·주석·마크다운 코드블록 없이 순수 JSON.

{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "dateEnd": "YYYY-MM-DD (선택, 기간 이벤트만)",
      "dateLabel": "8월 말 / 3분기 초 등 (선택, 모호 시점만)",
      "time": "HH:MM (선택, 한국시간)",
      "type": "earnings | disclosure | dividend | ipo | macro",
      "ticker": "종목코드 또는 -",
      "companyName": "회사명 또는 주체",
      "market": "KOSPI | KOSDAQ | NASDAQ | NYSE | OTHER | NONE",
      "title": "이벤트 제목 (한 줄, 핵심만)",
      "summary": "2~3문장 요약",
      "isImportant": true|false
    }
  ]
}

이벤트가 하나도 없으면 { "events": [] }.`;

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
