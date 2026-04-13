"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookshelfLoader from "@/components/BookshelfLoader";

const PLACEHOLDER_HINTS = [
  "데미안",
  "한강",
  "사피엔스",
  "헤르만 헤세",
  "코스모스",
  "무라카미 하루키",
  "어린 왕자",
];

function useTypewriterPlaceholder(words: string[], paused: boolean) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (paused) return;
    let wordIdx = 0;
    let charIdx = 0;
    let typing = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const word = words[wordIdx];
      if (typing) {
        charIdx += 1;
        setText(word.slice(0, charIdx));
        if (charIdx >= word.length) {
          typing = false;
          timer = setTimeout(tick, 1400);
          return;
        }
        timer = setTimeout(tick, 110);
      } else {
        charIdx -= 1;
        setText(word.slice(0, charIdx));
        if (charIdx <= 0) {
          typing = true;
          wordIdx = (wordIdx + 1) % words.length;
          timer = setTimeout(tick, 280);
          return;
        }
        timer = setTimeout(tick, 55);
      }
    };

    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [words, paused]);

  return text;
}

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
  const [lastSearched, setLastSearched] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [picked, setPicked] = useState<SearchItem | null>(null);
  const [manualAuthor, setManualAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const typewriter = useTypewriterPlaceholder(
    PLACEHOLDER_HINTS,
    query.length > 0,
  );

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2 || searching) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    setPicked(null);
    setLastSearched(q);
    try {
      const res = await fetch(
        `/api/books/search?q=${encodeURIComponent(q)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSearchError(data.error ?? "검색 실패");
        return;
      }
      const data = await res.json();
      setResults(data.items ?? []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "검색 실패");
    } finally {
      setSearching(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  }

  function pick(item: SearchItem) {
    setPicked(item);
  }

  function clearPick() {
    setPicked(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = picked?.title ?? "";
    if (!title) return;
    setBusy(true);
    setError("");
    const payload = {
      title: picked!.title,
      author: picked!.author,
      isbn: picked!.isbn,
      coverUrl: picked!.cover,
      publisher: picked!.publisher,
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

  async function saveManual() {
    if (!manualAuthor && !lastSearched) return;
    const title = lastSearched.trim();
    if (!title) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        author: manualAuthor.trim() || null,
      }),
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

  const noResults =
    !searching && lastSearched && results.length === 0 && !searchError;

  return (
    <form
      onSubmit={onSubmit}
      className="paper-card relative flex flex-col gap-5 px-6 py-8"
    >
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
          책 검색 · 제목 또는 작가
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={typewriter ? `${typewriter}|` : "|"}
            className="flex-1 rounded-lg border hairline bg-[color:var(--paper)] px-4 py-3 text-base placeholder:text-[color:var(--ink-soft)]"
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={searching || query.trim().length < 2}
            className="shrink-0 rounded-lg px-5 text-[11px] uppercase tracking-wider text-[color:var(--paper)] disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {searching ? "찾는 중" : "검색"}
          </button>
        </div>
        <p className="text-[11px] text-[color:var(--ink-soft)]">
          두 글자 이상 · Enter 또는 검색
        </p>
      </div>

      {searching && (
        <div className="fade-up flex items-center justify-center rounded-lg border hairline bg-[color:var(--paper)] py-6">
          <BookshelfLoader size="sm" label="서가를 뒤지는 중…" />
        </div>
      )}

      {searchError && (
        <p
          className="rounded-md px-3 py-2 text-xs"
          style={{
            background: "color-mix(in oklab, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {searchError}
        </p>
      )}

      {!picked && !searching && results.length > 0 && (
        <ul className="fade-up flex max-h-96 flex-col gap-1 overflow-y-auto rounded-lg border hairline bg-[color:var(--paper)] p-1">
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
                    className="h-16 w-11 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <div className="h-16 w-11 shrink-0 rounded-sm border hairline bg-[color:var(--paper-2)]" />
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
          <div className="min-w-0 flex-1">
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
          <button
            type="button"
            onClick={clearPick}
            className="shrink-0 rounded-full border hairline px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--ink-muted)]"
          >
            해제
          </button>
        </div>
      )}

      {noResults && (
        <div className="fade-up flex flex-col gap-3 rounded-lg border hairline bg-[color:var(--paper)] p-4">
          <p className="text-[12px] text-[color:var(--ink-muted)]">
            검색 결과가 없어요. 직접 입력해서 담아도 돼요.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
              저자 (선택)
            </span>
            <input
              value={manualAuthor}
              onChange={(e) => setManualAuthor(e.target.value)}
              className="rounded-lg border hairline bg-[color:var(--paper-2)] px-4 py-3 text-base"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={saveManual}
              disabled={busy}
              className="rounded-full border hairline px-4 py-1.5 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
            >
              그대로 담기
            </button>
          </div>
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
          disabled={busy || !picked}
          className="rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)] disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {busy ? "담는 중…" : "서재에 담기"}
        </button>
      </div>
    </form>
  );
}
