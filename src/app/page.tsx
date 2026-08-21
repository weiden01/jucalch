import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          주식 이벤트 캘린더
        </h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          실적 발표 · 공시 · 배당 · IPO 일정을 한눈에
        </p>
        <div className="mt-6">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            캘린더 열기
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "오늘의 실적", desc: "장 마감 후 발표 예정 종목", tag: "실적" },
          { title: "이번 주 공시", desc: "주요 공시 일정 요약", tag: "공시" },
          { title: "배당 캘린더", desc: "배당락일 · 지급일 정리", tag: "배당" },
          { title: "IPO 일정", desc: "신규 상장 · 청약 일정", tag: "IPO" },
          { title: "실시간 시세", desc: "키움 API 연동 예정", tag: "실시간" },
          { title: "관심 종목", desc: "내가 담은 종목 알림", tag: "즐겨찾기" },
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {card.tag}
            </span>
            <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {card.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {card.desc}
            </p>
          </article>
        ))}
      </section>

      <footer className="mt-16 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        © {new Date().getFullYear()} jucalch · 개발 중
      </footer>
    </main>
  );
}
