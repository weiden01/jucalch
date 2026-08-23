-- ==========================================================================
-- jucalch - Supabase 스키마
-- 실행 방법: Supabase 대시보드 → SQL Editor → New query → 붙여넣기 → Run
-- ==========================================================================

-- 이벤트 유형 enum
create type event_type as enum (
  'earnings',    -- 실적 발표
  'disclosure',  -- 공시
  'dividend',    -- 배당
  'ipo',         -- IPO / 신규 상장
  'macro'        -- 매크로 (FOMC, CPI, 금통위 등)
);

-- 시장 enum
create type market_type as enum ('KOSPI', 'KOSDAQ', 'NASDAQ', 'NYSE', 'OTHER', 'NONE');

-- ==========================================================================
-- events : 주식/매크로 이벤트
-- ==========================================================================
create table events (
  id           text primary key,
  date         date not null,
  time         text,                     -- "HH:MM" 형식, null이면 시간 미정
  ticker       text not null default '-',
  company_name text not null,
  market       market_type default 'NONE',
  type         event_type not null,
  title        text not null,
  summary      text default '',
  is_important boolean default false,
  source       text,                     -- 어디서 온 데이터인지 (예: 'telegram', 'dart', 'manual')
  raw_message_id text,                   -- Telegram 메시지 참조 (있는 경우)
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index events_date_idx on events (date);
create index events_type_idx on events (type);
create index events_ticker_idx on events (ticker);
create index events_important_idx on events (is_important, date);

-- ==========================================================================
-- event_articles : 이벤트 관련 기사 (여러 개 가능)
-- ==========================================================================
create table event_articles (
  id           uuid primary key default gen_random_uuid(),
  event_id     text not null references events(id) on delete cascade,
  title        text not null,
  source       text not null,
  url          text,
  excerpt      text,
  published_at date,
  created_at   timestamptz default now()
);

create index event_articles_event_id_idx on event_articles (event_id);

-- ==========================================================================
-- event_macros : 이벤트 관련 매크로 지표
-- ==========================================================================
create table event_macros (
  id        uuid primary key default gen_random_uuid(),
  event_id  text not null references events(id) on delete cascade,
  name      text not null,
  value     text not null,
  change    text,
  note      text,
  created_at timestamptz default now()
);

create index event_macros_event_id_idx on event_macros (event_id);

-- ==========================================================================
-- event_price_points : 과거 주가 데이터 (딥다이브 탭 '과거 무빙')
-- ==========================================================================
create table event_price_points (
  id        uuid primary key default gen_random_uuid(),
  event_id  text not null references events(id) on delete cascade,
  date      date not null,
  close     numeric not null,
  volume    bigint
);

create index event_price_points_event_date_idx on event_price_points (event_id, date);

-- ==========================================================================
-- raw_messages : Telegram 원본 메시지 저장 (파싱 실패 시 재처리용)
-- ==========================================================================
create table raw_messages (
  id             uuid primary key default gen_random_uuid(),
  source         text not null,                -- 'telegram' 등
  external_id    text,                          -- Telegram message_id 등
  user_id        text,                          -- 보낸 사람
  text           text,
  metadata       jsonb,                         -- 원본 payload
  processed      boolean default false,
  error_message  text,
  created_at     timestamptz default now()
);

create index raw_messages_processed_idx on raw_messages (processed);

-- ==========================================================================
-- updated_at 자동 갱신 트리거
-- ==========================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_set_updated_at
before update on events
for each row execute function set_updated_at();

-- ==========================================================================
-- Row Level Security (RLS)
-- 프론트엔드(anon 키)로는 SELECT만 허용. INSERT/UPDATE/DELETE는 서버(service_role)만.
-- ==========================================================================
alter table events enable row level security;
alter table event_articles enable row level security;
alter table event_macros enable row level security;
alter table event_price_points enable row level security;
alter table raw_messages enable row level security;

-- 누구나 이벤트 조회 가능
create policy "public read events"
  on events for select using (true);

create policy "public read articles"
  on event_articles for select using (true);

create policy "public read macros"
  on event_macros for select using (true);

create policy "public read prices"
  on event_price_points for select using (true);

-- raw_messages는 anon으로 읽지 못하게 (개인정보 가능성)
-- INSERT/UPDATE는 서버 함수(service_role)에서만 처리하므로 별도 정책 불필요

-- ==========================================================================
-- Realtime 활성화 (프론트에 새 이벤트 즉시 푸시)
-- ==========================================================================
alter publication supabase_realtime add table events;
