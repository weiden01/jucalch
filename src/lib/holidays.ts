export type Country = "KR" | "US";

export interface Holiday {
  date: string;
  name: string;
  country: Country;
  isSubstitute?: boolean;
}

// KR: 한국 법정공휴일 (KRX 휴장일과 동일)
// US: NYSE (뉴욕증권거래소) 휴장일
export const HOLIDAYS: Holiday[] = [
  // ─── 한국 2026 ─────────────────────────────
  { date: "2026-01-01", name: "신정", country: "KR" },
  { date: "2026-02-16", name: "설날 연휴", country: "KR" },
  { date: "2026-02-17", name: "설날", country: "KR" },
  { date: "2026-02-18", name: "설날 연휴", country: "KR" },
  { date: "2026-03-01", name: "삼일절", country: "KR" },
  { date: "2026-03-02", name: "대체공휴일", country: "KR", isSubstitute: true },
  { date: "2026-05-05", name: "어린이날", country: "KR" },
  { date: "2026-05-24", name: "부처님오신날", country: "KR" },
  { date: "2026-05-25", name: "대체공휴일", country: "KR", isSubstitute: true },
  { date: "2026-06-06", name: "현충일", country: "KR" },
  { date: "2026-08-15", name: "광복절", country: "KR" },
  { date: "2026-09-24", name: "추석 연휴", country: "KR" },
  { date: "2026-09-25", name: "추석", country: "KR" },
  { date: "2026-09-26", name: "추석 연휴", country: "KR" },
  { date: "2026-10-03", name: "개천절", country: "KR" },
  { date: "2026-10-09", name: "한글날", country: "KR" },
  { date: "2026-12-25", name: "성탄절", country: "KR" },

  // ─── 한국 2027 ─────────────────────────────
  { date: "2027-01-01", name: "신정", country: "KR" },
  { date: "2027-02-06", name: "설날 연휴", country: "KR" },
  { date: "2027-02-07", name: "설날", country: "KR" },
  { date: "2027-02-08", name: "설날 연휴", country: "KR" },
  { date: "2027-02-09", name: "대체공휴일", country: "KR", isSubstitute: true },
  { date: "2027-03-01", name: "삼일절", country: "KR" },
  { date: "2027-05-05", name: "어린이날", country: "KR" },
  { date: "2027-05-13", name: "부처님오신날", country: "KR" },
  { date: "2027-06-06", name: "현충일", country: "KR" },
  { date: "2027-06-07", name: "대체공휴일", country: "KR", isSubstitute: true },
  { date: "2027-08-15", name: "광복절", country: "KR" },
  { date: "2027-08-16", name: "대체공휴일", country: "KR", isSubstitute: true },
  { date: "2027-09-14", name: "추석 연휴", country: "KR" },
  { date: "2027-09-15", name: "추석", country: "KR" },
  { date: "2027-09-16", name: "추석 연휴", country: "KR" },
  { date: "2027-10-03", name: "개천절", country: "KR" },
  { date: "2027-10-04", name: "대체공휴일", country: "KR", isSubstitute: true },
  { date: "2027-10-09", name: "한글날", country: "KR" },
  { date: "2027-12-25", name: "성탄절", country: "KR" },

  // ─── 미장 (NYSE) 2026 ──────────────────────
  { date: "2026-01-01", name: "New Year's Day", country: "US" },
  { date: "2026-01-19", name: "MLK Day", country: "US" },
  { date: "2026-02-16", name: "Presidents' Day", country: "US" },
  { date: "2026-04-03", name: "Good Friday", country: "US" },
  { date: "2026-05-25", name: "Memorial Day", country: "US" },
  { date: "2026-06-19", name: "Juneteenth", country: "US" },
  { date: "2026-07-03", name: "Independence Day (관측)", country: "US" },
  { date: "2026-09-07", name: "Labor Day", country: "US" },
  { date: "2026-11-26", name: "Thanksgiving", country: "US" },
  { date: "2026-12-25", name: "Christmas", country: "US" },

  // ─── 미장 (NYSE) 2027 ──────────────────────
  { date: "2027-01-01", name: "New Year's Day", country: "US" },
  { date: "2027-01-18", name: "MLK Day", country: "US" },
  { date: "2027-02-15", name: "Presidents' Day", country: "US" },
  { date: "2027-03-26", name: "Good Friday", country: "US" },
  { date: "2027-05-31", name: "Memorial Day", country: "US" },
  { date: "2027-06-18", name: "Juneteenth (관측)", country: "US" },
  { date: "2027-07-05", name: "Independence Day (관측)", country: "US" },
  { date: "2027-09-06", name: "Labor Day", country: "US" },
  { date: "2027-11-25", name: "Thanksgiving", country: "US" },
  { date: "2027-12-24", name: "Christmas (관측)", country: "US" },
];

const _byDate: Map<string, Holiday[]> = (() => {
  const m = new Map<string, Holiday[]>();
  for (const h of HOLIDAYS) {
    const arr = m.get(h.date) ?? [];
    arr.push(h);
    m.set(h.date, arr);
  }
  return m;
})();

export function getHolidays(dateISO: string): Holiday[] {
  return _byDate.get(dateISO) ?? [];
}
