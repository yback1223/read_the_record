"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BookshelfLoader from "@/components/BookshelfLoader";

type SearchItem = {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  cover: string;
};

export default function NewBookForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<SearchItem | null>(null);
  const [manualAuthor, setManualAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (picked) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = ++reqIdRef.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/books/search?q=${encodeURIComponent(q)}`,
          { cache: "no-store" },
        );
        if (id !== reqIdRef.current) return;
        if (res.ok) {
          const data = await res.json();
          setResults(data.items ?? []);
        }
      } finally {
        if (id === reqIdRef.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, picked]);

  function pick(item: SearchItem) {
    setPicked(item);
    setQuery(item.title);
    setResults([]);
  }

  function clearPick() {
    setPicked(null);
    setQuery("");
    setManualAuthor("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = picked?.title ?? query.trim();
    if (!title) return;
    setBusy(true);
    setError("");
    const payload = picked
      ? {
          title: picked.title,
          author: picked.author,
          isbn: picked.isbn,
          coverUrl: picked.cover,
          publisher: picked.publisher,
        }
      : {
          title,
          author: manualAuthor.trim() || null,
        };
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "저장 실패");
      setBusy(false);
      return;
    }
    const book = await res.json();
    router.replace(`/books/${book.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="paper-card relative flex flex-col gap-5 px-6 py-8">
      {busy && (
        <div className="fade-up absolute inset-0 z-10 flex items-center justify-center rounded-[14px] bg-[color:var(--paper-2)]/92 backdrop-blur-sm">
          <BookshelfLoader label="책장에 꽂는 중…" />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="q"
          className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]"
        >
          제목 검색
        </label>
        <div className="relative">
          <input
            id="q"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (picked) setPicked(null);
            }}
            placeholder="책 제목을 입력해 보세요"
            className="w-full rounded-lg border hairline bg-[color:var(--paper)] px-4 py-3 text-base"
          />
          {picked && (
            <button
              type="button"
              onClick={clearPick}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border hairline px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--ink-muted)]"
            >
              해제
            </button>
          )}
        </div>

        {!picked && results.length > 0 && (
          <ul className="mt-2 flex max-h-80 flex-col gap-1 overflow-y-auto rounded-lg border hairline bg-[color:var(--paper)] p-1">
            {results.map((r) => (
              <li key={r.isbn || r.title}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-[color:var(--paper-2)]"
                >
                  {r.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.cover}
                      alt=""
                      className="h-14 w-10 shrink-0 rounded-sm object-cover"
                    />
                  ) : (
                    <div className="h-14 w-10 shrink-0 rounded-sm border hairline bg-[color:var(--paper-2)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="serif truncate text-[14px] text-[color:var(--ink)]">
                      {r.title}
                    </p>
                    <p className="truncate text-[11px] text-[color:var(--ink-muted)]">
                      {r.author || "저자 미상"}
                      {r.publisher && ` · ${r.publisher}`}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!picked && searching && (
          <p className="text-[11px] italic text-[color:var(--ink-soft)]">
            검색 중…
          </p>
        )}
      </div>

      {picked && (
        <div className="fade-up flex items-start gap-4 rounded-lg border hairline bg-[color:var(--paper)] p-4">
          {picked.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={picked.cover}
              alt=""
              className="h-24 w-16 shrink-0 rounded-sm object-cover"
            />
          ) : (
            <div className="h-24 w-16 shrink-0 rounded-sm border hairline" />
          )}
          <div className="min-w-0">
            <p className="serif text-[16px] text-[color:var(--ink)]">
              {picked.title}
            </p>
            <p className="text-[12px] text-[color:var(--ink-muted)]">
              {picked.author || "저자 미상"}
              {picked.publisher && ` · ${picked.publisher}`}
            </p>
            {picked.isbn && (
              <p className="mt-1 text-[10px] text-[color:var(--ink-soft)]">
                ISBN {picked.isbn}
              </p>
            )}
          </div>
        </div>
      )}

      {!picked && query.trim().length >= 2 && results.length === 0 && !searching && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="author"
            className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]"
          >
            저자 (검색 결과 없음 — 직접 입력)
          </label>
          <input
            id="author"
            value={manualAuthor}
            onChange={(e) => setManualAuthor(e.target.value)}
            className="rounded-lg border hairline bg-[color:var(--paper)] px-4 py-3 text-base"
          />
        </div>
      )}

      {error && (
        <p
          className="rounded-md px-3 py-2 text-xs"
          style={{
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border hairline px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={busy || (!picked && query.trim().length === 0)}
          className="rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)] disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {busy ? "담는 중…" : "서재에 담기"}
        </button>
      </div>
    </form>
  );
}
