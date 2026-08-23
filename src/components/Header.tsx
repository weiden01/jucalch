import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-emerald-100/60 bg-white/80 backdrop-blur dark:border-emerald-900/40 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-xs font-black text-white">
            j
          </span>
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            jucalch
          </span>
          <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">
            · 주식 이벤트 캘린더
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink href="/">홈</NavLink>
          <NavLink href="/calendar">캘린더</NavLink>
          <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
    >
      {children}
    </Link>
  );
}
