"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LibraryToolbar from "./LibraryToolbar";

type GridBook = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  publisher: string | null;
  count: number;
  createdAt: string;
};

export type View = "grid" | "list";

const STORAGE_KEY = "reading:view";

export default function LibraryClient({
  books,
  initialQ,
  initialSize,
}: {
  books: GridBook[];
  initialQ: string;
  initialSize: number;
}) {
  const [view, setView] = useState<View>("grid");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "list" || saved === "grid") setView(saved);
    setMounted(true);
  }, []);

  function changeView(v: View) {
    setView(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <LibraryToolbar
        initialQ={initialQ}
        initialSize={initialSize}
        view={view}
        onChangeView={changeView}
      />

      <div className="flex items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
          {initialQ ? `"${initialQ}" 검색 결과` : "전체"}
        </span>
        <div className="h-px flex-1 bg-[color:var(--rule)]" />
        <span className="text-[11px] text-[color:var(--ink-soft)]">
          {books.length}권
        </span>
      </div>

      {mounted && view === "list" ? (
        <ListView books={books} />
      ) : (
        <GridView books={books} />
      )}
    </>
  );
}

function GridView({ books }: { books: GridBook[] }) {
  const shelfSize = 5;
  const shelves: GridBook[][] = [];
  for (let i = 0; i < books.length; i += shelfSize) {
    shelves.push(books.slice(i, i + shelfSize));
  }
  return (
    <div className="flex flex-col gap-12">
      {shelves.map((row, idx) => (
        <div key={idx} className="flex flex-col">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {row.map((b) => (
              <li key={b.id}>
                <Link href={`/books/${b.id}`} className="group flex flex-col gap-3">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-sm border hairline bg-[color:var(--paper-2)] shadow-[0_14px_30px_-18px_rgba(70,50,20,0.45)]">
                    {b.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.coverUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-3 text-center">
                        <span className="serif text-[13px] leading-snug text-[color:var(--ink-muted)]">
                          {b.title}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="serif truncate text-[14px] leading-snug text-[color:var(--ink)]">
                      {b.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[color:var(--ink-soft)]">
                      {b.author ?? "저자 미상"} · 녹음 {b.count}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div
            className="mt-4 h-[6px] rounded-b-[3px]"
            style={{
              background:
                "linear-gradient(180deg, var(--rule-strong), var(--rule))",
              boxShadow: "0 6px 14px -10px rgba(70,50,20,0.45)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ListView({ books }: { books: GridBook[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {books.map((b) => (
        <li key={b.id}>
          <Link
            href={`/books/${b.id}`}
            className="flex items-center gap-4 rounded-lg border hairline bg-[color:var(--paper-2)] px-4 py-3 hover:border-[color:var(--rule-strong)]"
          >
            {b.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.coverUrl}
                alt=""
                className="h-16 w-11 shrink-0 rounded-sm object-cover"
              />
            ) : (
              <div className="h-16 w-11 shrink-0 rounded-sm border hairline bg-[color:var(--paper)]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="serif truncate text-[15px] text-[color:var(--ink)]">
                {b.title}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[color:var(--ink-soft)]">
                {b.author ?? "저자 미상"}
                {b.publisher && ` · ${b.publisher}`}
              </p>
            </div>
            <div className="hidden flex-col items-end gap-0.5 text-right text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] sm:flex">
              <span>녹음 {b.count}</span>
              <span>{new Date(b.createdAt).toLocaleDateString("ko-KR")}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
