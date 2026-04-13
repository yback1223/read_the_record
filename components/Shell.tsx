"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import SignOutButton from "@/components/SignOutButton";

type BookListItem = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  _count: { recordings: number };
};

export default function Shell({
  children,
  userEmail,
  isSuperAdmin = false,
}: {
  children: React.ReactNode;
  userEmail?: string;
  isSuperAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [books, setBooks] = useState<BookListItem[]>([]);
  const pathname = usePathname();

  const load = useCallback(async () => {
    const res = await fetch("/api/books", { cache: "no-store" });
    if (res.ok) setBooks(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const currentBookId =
    pathname?.startsWith("/books/") && !pathname.startsWith("/books/new")
      ? pathname.split("/")[2]
      : null;

  return (
    <div className="flex min-h-dvh">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r hairline bg-[color:var(--paper-2)] md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:!translate-x-0`}
        style={{
          transitionProperty: "transform",
          transitionDuration: "360ms",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <Link
            href="/"
            className="serif text-lg tracking-wide text-[color:var(--ink)]"
          >
            서재
          </Link>
          <Link
            href="/books/new"
            className={`rounded-full border hairline px-3 py-1 text-xs ${
              pathname === "/books/new"
                ? "border-[color:var(--accent)] text-[color:var(--accent)]"
                : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)]"
            }`}
          >
            + 책 추가
          </Link>
        </div>

        {isSuperAdmin && (
          <Link
            href="/admin"
            className={`mx-4 mb-2 flex items-center justify-between rounded-lg border hairline px-4 py-2.5 text-[12px] tracking-wide ${
              pathname?.startsWith("/admin")
                ? "border-[color:var(--accent)] text-[color:var(--accent)]"
                : "text-[color:var(--ink)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            }`}
            style={{ background: "color-mix(in oklab, var(--accent) 6%, transparent)" }}
          >
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1.5l6 2.5v4.5c0 3.5-2.4 5.7-6 6-3.6-.3-6-2.5-6-6V4l6-2.5z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
              관리자 페이지
            </span>
            <span aria-hidden>→</span>
          </Link>
        )}

        <div className="mx-6 my-2 h-px bg-[color:var(--rule)]" />

        <nav className="flex flex-col gap-0.5 overflow-y-auto px-3 pb-3">
          {books.length === 0 && (
            <p className="px-3 py-4 text-xs italic text-[color:var(--ink-soft)]">
              아직 서재에 책이 없어요.
            </p>
          )}
          {books.map((b) => {
            const active = b.id === currentBookId;
            return (
              <Link
                key={b.id}
                href={`/books/${b.id}`}
                className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 ${
                  active
                    ? "bg-[color:var(--paper)] shadow-[inset_2px_0_0_0_var(--accent)]"
                    : "hover:bg-[color:var(--paper)]"
                }`}
              >
                {b.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.coverUrl}
                    alt=""
                    className="h-12 w-8 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <div className="h-12 w-8 shrink-0 rounded-sm border hairline bg-[color:var(--paper)]" />
                )}
                <div className="min-w-0 flex-1">
                <span className="serif block truncate text-[15px] leading-snug text-[color:var(--ink)]">
                  {b.title}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-[color:var(--ink-soft)]">
                  {b.author ?? "저자 미상"} · 녹음 {b._count.recordings}
                </span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t hairline px-5 py-4">
          <p className="truncate text-[11px] text-[color:var(--ink-soft)]">
            {userEmail}
          </p>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-30 bg-black/30 md:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        style={{ transitionProperty: "opacity", transitionDuration: "300ms" }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b hairline bg-[color:var(--paper)]/85 px-5 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border hairline text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
            aria-label="메뉴"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4h12M2 8h12M2 12h12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className="serif text-base tracking-wide">서재</span>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
