import type { StockEvent } from "@/lib/types";

export function ArticlesTab({ event }: { event: StockEvent }) {
  const articles = event.detail.articles;
  if (articles.length === 0) {
    return <EmptyState text="아직 등록된 관련 기사가 없습니다." />;
  }
  return (
    <ul className="space-y-3">
      {articles.map((a) => {
        const clickable = !!a.url;
        const Wrapper = clickable ? "a" : "div";
        const wrapperProps = clickable
          ? {
              href: a.url,
              target: "_blank",
              rel: "noopener noreferrer",
              className:
                "block rounded-lg border border-zinc-200 bg-white/60 p-4 backdrop-blur transition hover:border-zinc-400 hover:bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-600 dark:hover:bg-zinc-900",
            }
          : {
              className:
                "rounded-lg border border-zinc-200 bg-white/60 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60",
            };

        return (
          <li key={a.id}>
            <Wrapper {...wrapperProps}>
              <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-medium">{a.source}</span>
                {a.publishedAt && (
                  <>
                    <span>·</span>
                    <span>{a.publishedAt}</span>
                  </>
                )}
                {clickable && (
                  <span className="ml-auto flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    링크 열기
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M3 1h6v6M9 1L1 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              </div>
              <h4
                className={`font-semibold ${
                  clickable
                    ? "text-zinc-900 group-hover:underline dark:text-zinc-100"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {a.title}
              </h4>
              {a.excerpt && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{a.excerpt}</p>
              )}
            </Wrapper>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
      {text}
    </div>
  );
}
