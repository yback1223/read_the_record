"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BookshelfLoader from "@/components/BookshelfLoader";
import { resizeImageToDataURL } from "@/lib/image-resize";
import { consumeOcrFiles } from "@/lib/ocr-store";
import { notify, msg } from "@/lib/toast";

type PageResult = {
  index: number;
  text: string;
  page: number | null;
  error?: string;
};

type Token =
  | { kind: "word"; text: string; idx: number }
  | {
      kind: "space";
      text: string;
      prevWord: number | null;
      nextWord: number | null;
    };

type Range = { start: number; end: number };

function tokenize(text: string): Token[] {
  if (!text) return [];
  const parts = text.split(/(\s+)/g).filter(Boolean);
  const out: Token[] = [];
  let nextIdx = 0;
  let lastWord: number | null = null;
  const pendingSpaces: number[] = [];
  for (const p of parts) {
    if (/^\s+$/.test(p)) {
      out.push({
        kind: "space",
        text: p,
        prevWord: lastWord,
        nextWord: null,
      });
      pendingSpaces.push(out.length - 1);
    } else {
      const wordIdx = nextIdx++;
      for (const sp of pendingSpaces) {
        const s = out[sp];
        if (s.kind === "space") s.nextWord = wordIdx;
      }
      pendingSpaces.length = 0;
      out.push({ kind: "word", text: p, idx: wordIdx });
      lastWord = wordIdx;
    }
  }
  return out;
}

/** Find the initial range: words up to the first sentence terminator. */
function firstSentenceRange(tokens: Token[]): Range | null {
  const words = tokens.filter((t) => t.kind === "word") as Extract<
    Token,
    { kind: "word" }
  >[];
  if (words.length === 0) return null;
  for (let i = 0; i < words.length; i++) {
    if (/[.!?。…]$/.test(words[i].text)) {
      return { start: 0, end: i };
    }
  }
  return { start: 0, end: Math.min(14, words.length - 1) };
}

function buildSelectedText(
  tokens: Token[],
  range: Range | null | undefined,
): string {
  if (!range) return "";
  const parts: string[] = [];
  for (const t of tokens) {
    if (t.kind !== "word") continue;
    if (t.idx >= range.start && t.idx <= range.end) {
      parts.push(t.text);
    }
  }
  return parts.join(" ").trim();
}

export default function OcrPage({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "processing"; step: string }
    | { kind: "done"; pages: PageResult[] }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [activeIdx, setActiveIdx] = useState(0);
  const [ranges, setRanges] = useState<Record<number, Range>>({});
  const [dragging, setDragging] = useState<null | "start" | "end">(null);
  const [pageOverride, setPageOverride] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const files = consumeOcrFiles(bookId);
    if (!files || files.length === 0) {
      router.replace(`/books/${bookId}`);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setState({ kind: "processing", step: "사진 준비 중…" });
        const dataUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          if (cancelled) return;
          setState({
            kind: "processing",
            step: `사진 ${i + 1}/${files.length} 준비 중…`,
          });
          const url = await resizeImageToDataURL(files[i]);
          dataUrls.push(url);
        }
        if (cancelled) return;
        setState({ kind: "processing", step: "글자를 읽는 중…" });
        const res = await fetch(`/api/books/${bookId}/ocr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: dataUrls }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "OCR 실패");
        }
        const json = (await res.json()) as { results: PageResult[] };
        if (cancelled) return;
        setState({ kind: "done", pages: json.results });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "OCR 실패",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, router]);

  const tokensByPage = useMemo(() => {
    if (state.kind !== "done") return {} as Record<number, Token[]>;
    const map: Record<number, Token[]> = {};
    state.pages.forEach((p) => {
      map[p.index] = tokenize(p.text);
    });
    return map;
  }, [state]);

  // Initialize ranges once tokens are ready
  useEffect(() => {
    if (state.kind !== "done") return;
    const init: Record<number, Range> = {};
    for (const p of state.pages) {
      const tokens = tokensByPage[p.index];
      if (!tokens) continue;
      const r = firstSentenceRange(tokens);
      if (r) init[p.index] = r;
    }
    setRanges(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, tokensByPage]);

  function wordIdxFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const wordEl = el.closest?.("[data-word-idx]") as HTMLElement | null;
    if (!wordEl) return null;
    const n = Number(wordEl.dataset.wordIdx);
    return Number.isFinite(n) ? n : null;
  }

  // Global pointer tracking while dragging a handle
  useEffect(() => {
    if (!dragging) return;
    const pageIdx = activePage?.index;
    if (pageIdx == null) return;
    const lockedPageIdx: number = pageIdx;

    function onMove(e: PointerEvent) {
      const idx = wordIdxFromPoint(e.clientX, e.clientY);
      if (idx == null) return;
      setRanges((prev) => {
        const cur = prev[lockedPageIdx];
        if (!cur) return prev;
        if (dragging === "start") {
          const start = Math.max(0, Math.min(idx, cur.end));
          if (start === cur.start) return prev;
          return { ...prev, [lockedPageIdx]: { ...cur, start } };
        }
        const end = Math.max(cur.start, idx);
        if (end === cur.end) return prev;
        return { ...prev, [lockedPageIdx]: { ...cur, end } };
      });
      e.preventDefault();
    }
    function onUp() {
      setDragging(null);
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  function handleDown(which: "start" | "end") {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(which);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(6);
        } catch {
          // ignore
        }
      }
    };
  }

  function clearCurrentPage() {
    const pageIdx = activePage?.index;
    if (pageIdx == null) return;
    setRanges((prev) => {
      const next = { ...prev };
      delete next[pageIdx];
      return next;
    });
  }

  function resetCurrentPage() {
    const pageIdx = activePage?.index;
    if (pageIdx == null) return;
    const tokens = tokensByPage[pageIdx];
    if (!tokens) return;
    const r = firstSentenceRange(tokens);
    if (r) setRanges((prev) => ({ ...prev, [pageIdx]: r }));
  }

  const activePage = useMemo(() => {
    if (state.kind !== "done") return null;
    return state.pages[activeIdx];
  }, [state, activeIdx]);

  const combinedText = useMemo(() => {
    if (state.kind !== "done") return "";
    const parts: string[] = [];
    for (const page of state.pages) {
      const tokens = tokensByPage[page.index];
      const r = ranges[page.index];
      if (!tokens || !r) continue;
      const s = buildSelectedText(tokens, r);
      if (s) parts.push(s);
    }
    return parts.join("\n\n");
  }, [state, tokensByPage, ranges]);

  const selectedPagesCount = useMemo(
    () => Object.keys(ranges).length,
    [ranges],
  );

  const effectivePage = useMemo(() => {
    const override = pageOverride.trim();
    if (override) {
      const n = Number(override);
      return Number.isInteger(n) && n >= 0 ? n : null;
    }
    if (state.kind === "done") {
      for (const p of state.pages) {
        if (ranges[p.index] && p.page != null) return p.page;
      }
    }
    return activePage?.page ?? null;
  }, [pageOverride, activePage, state, ranges]);

  async function handleSave() {
    if (!combinedText) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${bookId}/recordings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: combinedText,
          type: "underline",
          page: effectivePage,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "저장 실패");
      }
      notify.success(msg.saved);
      router.replace(`/books/${bookId}`);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : msg.saveFailed);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[color:var(--paper)]"
      style={{ height: "100dvh" }}
    >
      <header className="flex shrink-0 items-center justify-between border-b hairline bg-[color:var(--paper)] px-5 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="돌아가기"
          className="flex h-9 w-9 items-center justify-center rounded-full border hairline text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 3 L4 8 L10 13" />
          </svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
            사진에서 문장 담기
          </span>
          <span className="serif text-[13px] text-[color:var(--ink)]">
            {state.kind !== "done"
              ? "잠시만요"
              : "양 끝을 잡고 늘리거나 줄이세요"}
          </span>
        </div>
        <div className="h-9 w-9" />
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {(state.kind === "idle" || state.kind === "processing") && (
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <BookshelfLoader
              label={state.kind === "processing" ? state.step : "준비 중…"}
            />
          </div>
        )}

        {state.kind === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <p className="serif text-[16px]">글자를 읽지 못했어요</p>
            <p className="text-[12px] text-[color:var(--ink-muted)]">
              {state.message}
            </p>
            <button
              type="button"
              onClick={() => router.back()}
              className="mt-2 rounded-full border hairline px-4 py-1.5 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
            >
              돌아가기
            </button>
          </div>
        )}

        {state.kind === "done" && state.pages.length > 0 && (
          <>
            {state.pages.length > 1 && (
              <div className="flex shrink-0 gap-2 overflow-x-auto border-b hairline bg-[color:var(--paper-2)] px-5 py-3">
                {state.pages.map((p, i) => {
                  const selected = !!ranges[p.index];
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-[11px] uppercase tracking-wider ${
                        i === activeIdx
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--paper)]"
                          : "hairline text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
                      }`}
                    >
                      <span>
                        {p.page != null ? `p. ${p.page}` : `사진 ${i + 1}`}
                      </span>
                      {selected && <span className="ml-1 opacity-80">·</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              ref={viewerRef}
              className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
              style={{
                WebkitUserSelect: "none",
                userSelect: "none",
                WebkitTouchCallout: "none",
                touchAction: dragging ? "none" : "pan-y",
              }}
            >
              {activePage?.error ? (
                <p className="text-center text-sm italic text-[color:var(--danger)]">
                  이 사진은 읽지 못했어요 · {activePage.error}
                </p>
              ) : activePage && tokensByPage[activePage.index]?.length ? (
                <div
                  className="prose-reading whitespace-pre-wrap break-keep leading-9"
                  style={{
                    fontFamily: "var(--font-serif-book), Georgia, serif",
                  }}
                >
                  {renderTokens(
                    tokensByPage[activePage.index],
                    ranges[activePage.index],
                    handleDown,
                  )}
                </div>
              ) : (
                <p className="text-center text-sm italic text-[color:var(--ink-soft)]">
                  이 사진에서는 글자를 찾지 못했어요
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {state.kind === "done" && (
        <footer className="flex shrink-0 flex-col gap-2 border-t hairline bg-[color:var(--paper-2)] px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
              담긴 문장 · {selectedPagesCount}페이지
            </span>
            <div className="h-px flex-1 bg-[color:var(--rule)]" />
            {activePage && ranges[activePage.index] && (
              <button
                type="button"
                onClick={resetCurrentPage}
                className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
              >
                첫 문장으로
              </button>
            )}
            {activePage && ranges[activePage.index] && (
              <button
                type="button"
                onClick={clearCurrentPage}
                className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] hover:text-[color:var(--danger)]"
              >
                이 페이지 빼기
              </button>
            )}
          </div>

          {combinedText ? (
            <blockquote
              className="prose-reading max-h-24 overflow-y-auto rounded-lg border-l-2 bg-[color:var(--paper)] px-4 py-2 text-[13px]"
              style={{ borderColor: "var(--accent)" }}
            >
              {combinedText}
            </blockquote>
          ) : (
            <p className="px-1 text-[12px] italic text-[color:var(--ink-soft)]">
              담긴 문장이 없어요. 탭에서 페이지를 골라 양 끝을 잡고 늘려 보세요.
            </p>
          )}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)]">
              <span>페이지</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={pageOverride}
                onChange={(e) => setPageOverride(e.target.value)}
                placeholder={
                  effectivePage != null ? String(effectivePage) : "-"
                }
                className="w-16 rounded-md border hairline bg-[color:var(--paper)] px-2 py-1 text-center text-[13px] text-[color:var(--ink)] outline-none"
              />
            </label>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleSave}
              disabled={!combinedText || saving}
              className="rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)] disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {saving ? "담는 중…" : "이 문장 담기"}
            </button>
          </div>
        </footer>
      )}

      <style>{`
        .ocr-word {
          display: inline;
          background-color: transparent;
          transition: background-color 160ms cubic-bezier(0.22, 1, 0.36, 1),
                      color 160ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ocr-word--on,
        .ocr-space--on {
          background-color: color-mix(in oklab, var(--accent) 24%, transparent);
          color: var(--ink);
        }

        .ocr-handle {
          position: relative;
          display: inline-block;
          width: 18px;
          height: 1.5em;
          vertical-align: middle;
          cursor: grab;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        }
        .ocr-handle:active { cursor: grabbing; }
        .ocr-handle::before {
          /* vertical line at the boundary */
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2.5px;
          background: var(--accent);
          border-radius: 1.25px;
        }
        .ocr-handle::after {
          /* round pull grip */
          content: "";
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow:
            0 2px 8px -2px rgba(70, 50, 20, 0.55),
            inset 0 1px 1px rgba(255, 255, 255, 0.2);
        }
        .ocr-handle--start::before {
          left: 8px;
        }
        .ocr-handle--start::after {
          left: 1px;
          top: -8px;
          animation: handle-pulse 2s ease-in-out infinite;
        }
        .ocr-handle--end::before {
          right: 8px;
        }
        .ocr-handle--end::after {
          right: 1px;
          bottom: -8px;
          animation: handle-pulse 2s ease-in-out 1s infinite;
        }
        @keyframes handle-pulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 35%, transparent),
                                 0 2px 8px -2px rgba(70, 50, 20, 0.55),
                                 inset 0 1px 1px rgba(255, 255, 255, 0.2); }
          50%      { box-shadow: 0 0 0 7px color-mix(in oklab, var(--accent) 0%, transparent),
                                 0 2px 8px -2px rgba(70, 50, 20, 0.55),
                                 inset 0 1px 1px rgba(255, 255, 255, 0.2); }
        }
      `}</style>
    </div>
  );
}

function renderTokens(
  tokens: Token[],
  range: Range | undefined,
  handleDown: (which: "start" | "end") => (e: React.PointerEvent) => void,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.kind === "space") {
      const bothOn =
        range != null &&
        tok.prevWord != null &&
        tok.nextWord != null &&
        tok.prevWord >= range.start &&
        tok.prevWord <= range.end &&
        tok.nextWord >= range.start &&
        tok.nextWord <= range.end;
      out.push(
        <span key={`s${i}`} className={bothOn ? "ocr-space--on" : undefined}>
          {tok.text}
        </span>,
      );
      continue;
    }
    const on = range != null && tok.idx >= range.start && tok.idx <= range.end;
    // start handle goes BEFORE the start word
    if (range && tok.idx === range.start) {
      out.push(
        <span
          key={`hs-${tok.idx}`}
          className="ocr-handle ocr-handle--start"
          role="slider"
          aria-label="시작 위치"
          onPointerDown={handleDown("start")}
        />,
      );
    }
    out.push(
      <span
        key={`w${tok.idx}`}
        data-word-idx={tok.idx}
        className={`ocr-word ${on ? "ocr-word--on" : ""}`}
      >
        {tok.text}
      </span>,
    );
    // end handle goes AFTER the end word
    if (range && tok.idx === range.end) {
      out.push(
        <span
          key={`he-${tok.idx}`}
          className="ocr-handle ocr-handle--end"
          role="slider"
          aria-label="끝 위치"
          onPointerDown={handleDown("end")}
        />,
      );
    }
  }
  return out;
}
