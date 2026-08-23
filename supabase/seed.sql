-- ==========================================================================
-- jucalch - 초기 시드 데이터 (검증용)
-- 실행 방법: schema.sql 실행 후, Supabase 대시보드 SQL Editor에 붙여넣고 Run
-- ==========================================================================

insert into events (id, date, time, ticker, company_name, market, type, title, summary, is_important, source) values
  ('seed-2026-08-27-nvda',       '2026-08-27', '05:00', '-',      '엔비디아',        'NONE',   'earnings',   '엔비디아 FY26 2Q 실적발표',    'Blackwell 램프업 속도 및 데이터센터 매출 주목.', true,  'seed'),
  ('seed-2026-08-28-kt-div',     '2026-08-28', null,    '030200', 'KT',              'KOSPI',  'dividend',   'KT 반기배당 배당락',           '주당 500원. 시가배당률 약 1.3%.',              false, 'seed'),
  ('seed-2026-09-02-ipo',        '2026-09-02', null,    '-',      '뉴로링크바이오',    'KOSDAQ', 'ipo',        '뉴로링크바이오 상장',          '공모가 32,000원. BCI 첫 국내 상장사.',          true,  'seed'),
  ('seed-2026-09-05-payroll',    '2026-09-05', '21:30', '-',      '美 노동통계국',    'NONE',   'macro',      '미국 8월 비농업 고용',          '9월 FOMC 직전 마지막 고용 데이터.',            true,  'seed'),
  ('seed-2026-09-17-fomc',       '2026-09-17', '03:00', '-',      '美 FOMC',         'NONE',   'macro',      '9월 FOMC 금리 결정',           '25bp 인하 vs 동결. 점도표 업데이트.',           true,  'seed'),
  ('seed-2026-10-10-samsung-pre','2026-10-10', '08:00', '005930', '삼성전자',        'KOSPI',  'earnings',   '삼성전자 3분기 잠정실적',       'HBM3E 12단 매출 첫 온기 반영.',                true,  'seed'),
  ('seed-2026-10-28-fomc',       '2026-10-28', '03:00', '-',      '美 FOMC',         'NONE',   'macro',      '10월 FOMC 금리 결정',          '연속 인하 여부 결정.',                        true,  'seed'),
  ('seed-2026-11-12-nvda',       '2026-11-12', '05:00', '-',      '엔비디아',        'NONE',   'earnings',   '엔비디아 FY26 3Q 실적',        'Blackwell 첫 온기 반영 실적.',                true,  'seed'),
  ('seed-2026-11-27-bok',        '2026-11-27', '10:00', '-',      '한국은행 금통위',  'NONE',   'macro',      '한은 11월 기준금리 결정',       '올해 마지막 금통위, 수정경제전망 함께 발표.',    true,  'seed');

-- 관련 기사 (예시)
insert into event_articles (event_id, title, source, published_at, excerpt) values
  ('seed-2026-08-27-nvda', '엔비디아 어닝... 국내 시장에 미칠 영향', '이데일리', '2026-08-26', 'HBM 공급망 파트너인 SK하이닉스·삼성전자 주가에 직접 영향.'),
  ('seed-2026-09-17-fomc', '9월 FOMC 프리뷰 - 인하 개시 원년', '한국경제', '2026-09-16', 'CME 페드워치 인하 확률 78%. 관건은 점도표.');

-- 매크로 지표
insert into event_macros (event_id, name, value, change) values
  ('seed-2026-09-17-fomc', 'CME 인하 확률', '78%', null),
  ('seed-2026-09-17-fomc', '10년물 국채금리', '4.12%', '-0.03%p');
