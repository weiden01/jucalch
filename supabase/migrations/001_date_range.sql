-- 001: events 테이블에 기간(dateEnd)과 모호 날짜 레이블(dateLabel) 추가
-- 실행: Supabase 대시보드 → SQL Editor → New query → 붙여넣기 → Run
alter table events add column if not exists date_end date;
alter table events add column if not exists date_label text;

-- index 갱신 (선택)
create index if not exists events_date_end_idx on events (date_end);
