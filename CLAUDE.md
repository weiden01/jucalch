@AGENTS.md

# jucalch 프로젝트 지침

## 프로젝트 개요
- **주식 이벤트 캘린더** 웹사이트 (실적 발표, 공시, 배당, IPO 등)
- 배포 URL: https://jucalch.vercel.app/
- GitHub: https://github.com/weiden01/jucalch
- 스택: Next.js (App Router, TypeScript, Tailwind) → Vercel 배포 → 추후 Supabase DB → 추후 키움 REST OpenAPI+ (백엔드 별도)

## 워크플로우 (사용자와 합의됨)

사용자는 페이지에 뭐가 들어갈지만 말해준다. 나머지는 전부 Claude가 자동 처리.

1. 사용자가 원하는 UI/기능을 말함
2. Claude가 코드 수정 (Edit/Write)
3. Claude가 `git add` + `git commit` + `git push origin main` 실행
4. Vercel이 push를 감지해서 1~2분 내 자동 재배포
5. Claude가 사용자에게 "배포됐음, https://jucalch.vercel.app/ 확인" 고지

**중요**: 사용자에게 배포 관련 클릭이나 명령 실행을 요구하지 않는다. push까지 Claude가 다 한다.

## 앞으로의 로드맵
- A. 페이지 UI 채우기 (완료 수준: 캘린더 뷰/아젠다/모달/공휴일 등)
- B. Supabase DB 연결 (이벤트 데이터 저장/조회) ← 현재 진행 예정
- B+. Telegram → GPT 파이프라인 (구축 완료)
  - Telegram 봇에 텍스트/URL/HTML파일/이미지 DM 전송
  - Vercel serverless(/api/telegram)가 webhook 수신
  - 텍스트/URL/HTML: 파싱해서 GPT-4o-mini로 이벤트 추출
  - 이미지: GPT-4o-mini Vision으로 스크린샷·차트 텍스트화 후 파이프라인 연결
  - 중복 방지: 최근 60일~+120일 이벤트 컨텍스트를 GPT에 제공 (linkedEvents 판정) + 규칙 기반 안전망
  - Supabase events INSERT → Realtime으로 프론트 자동 반영
  - 화이트리스트로 사용자 Telegram user_id만 허용
  - 명령어: /list, /delete, /clear yes, /help
- C. 외부 데이터 수집 (DART 공시 API 등, Vercel Cron으로 폴링)
- D. FastAPI 백엔드 세팅 (Railway 서울 리전) — 키움 API 중계용
- E. 키움 REST OpenAPI+ 연동
- F. WebSocket 실시간 시세 스트리밍

## 커뮤니케이션
- 한국어로 대답한다.
- 초등학생도 이해할 정도로 상세하게 설명한다 (특히 계정 만들기, 외부 서비스 세팅 등).
- 코드 변경 시 "왜 이렇게 바꿨는지" 한 줄 요약을 곁들인다.
