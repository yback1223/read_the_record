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

function buildSelectedText(tokens: Token[], selected: Set<number>): string {
  let result = "";
  let lastWasSelected = false;
  let pendingSpace = "";
  for (const t of tokens) {
    if (t.kind === "space") {
      if (lastWasSelected) pendingSpace += t.text;
    } else {
      if (selected.has(t.idx)) {
        if (!lastWasSelected && result.length > 0) {
          result += " ";
        } else {
          result += pendingSpace.replace(/\s+/g, " ");
        }
        result += t.text;
        lastWasSelected = true;
        pendingSpace = "";
      } else {
        lastWasSelected = false;
        pendingSpace = "";
      }
    }
  }
  return result.trim();
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
  const [pageSelections, setPageSelections] = useState<
    Record<number, Set<number>>
  >({});
  const [dragState, setDragState] = useState<{
    pageIdx: number;
    start: number;
    current: number;
    mode: "add" | "remove";
  } | null>(null);
  const [pageOverride, setPageOverride] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [pressingWord, setPressingWord] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<{
    pageIdx: number;
    wordIdx: number;
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);

  // On mount: consume queued files, run OCR
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

  function wordIdxFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const wordEl = el.closest?.("[data-word-idx]") as HTMLElement | null;
    if (!wordEl) return null;
    const n = Number(wordEl.dataset.wordIdx);
    return Number.isFinite(n) ? n : null;
  }

  function startDrag(pageIdx: number, wordIdx: number) {
    const existing = pageSelections[pageIdx] ?? new Set<number>();
    const mode: "add" | "remove" = existing.has(wordIdx) ? "remove" : "add";
    setDragState({ pageIdx, start: wordIdx, current: wordIdx, mode });
  }

  function activateDrag(pointerTarget: Element, pointerId: number) {
    if (!pendingRef.current) return;
    const { pageIdx, wordIdx } = pendingRef.current;
    startDrag(pageIdx, wordIdx);
    try {
      pointerTarget.setPointerCapture?.(pointerId);
    } catch {
      // ignore
    }
    if (viewerRef.current) viewerRef.current.style.touchAction = "none";
    if (navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {
        // ignore
      }
    }
    setPressingWord(null);
  }

  function cancelPending() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pendingRef.current = null;
    setPressingWord(null);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (state.kind !== "done") return;
    const pageIdx = activePage?.index;
    if (pageIdx == null) return;
    const idx = wordIdxFromPoint(e.clientX, e.clientY);
    if (idx == null) return;
    const target = e.target as Element;
    const pointerId = e.pointerId;
    pendingRef.current = {
      pageIdx,
      wordIdx: idx,
      x: e.clientX,
      y: e.clientY,
      pointerId,
    };
    if (e.pointerType === "mouse" || e.pointerType === "pen") {
      activateDrag(target, pointerId);
      return;
    }
    setPressingWord(idx);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      if (pendingRef.current) activateDrag(target, pointerId);
    }, 300);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragState) {
      const idx = wordIdxFromPoint(e.clientX, e.clientY);
      if (idx != null && idx !== dragState.current) {
        setDragState({ ...dragState, current: idx });
      }
      e.preventDefault();
      return;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    const dx = e.clientX - pending.x;
    const dy = e.clientY - pending.y;
    if (Math.hypot(dx, dy) > 8) cancelPending();
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    cancelPending();
    if (viewerRef.current) viewerRef.current.style.touchAction = "";
    if (!dragState) return;
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    const { pageIdx, start, current, mode } = dragState;
    const lo = Math.min(start, current);
    const hi = Math.max(start, current);
    setPageSelections((prev) => {
      const cur = new Set(prev[pageIdx] ?? []);
      for (let i = lo; i <= hi; i++) {
        if (mode === "add") cur.add(i);
        else cur.delete(i);
      }
      return { ...prev, [pageIdx]: cur };
    });
    setDragState(null);
  }

  function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    cancelPending();
    if (viewerRef.current) viewerRef.current.style.touchAction = "";
    if (dragState) onPointerUp(e);
  }

  function clearCurrentPageSelection() {
    const pageIdx = activePage?.index;
    if (pageIdx == null) return;
    setPageSelections((prev) => {
      const next = { ...prev };
      delete next[pageIdx];
      return next;
    });
  }

  function clearAllSelections() {
    setPageSelections({});
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
      const sel = pageSelections[page.index];
      if (!tokens || !sel || sel.size === 0) continue;
      const s = buildSelectedText(tokens, sel);
      if (s) parts.push(s);
    }
    return parts.join("\n\n");
  }, [state, tokensByPage, pageSelections]);

  const totalSelectedCount = useMemo(() => {
    let n = 0;
    for (const k of Object.keys(pageSelections)) {
      n += pageSelections[Number(k)]?.size ?? 0;
    }
    return n;
  }, [pageSelections]);

  const effectivePage = useMemo(() => {
    const override = pageOverride.trim();
    if (override) {
      const n = Number(override);
      return Number.isInteger(n) && n >= 0 ? n : null;
    }
    if (state.kind === "done") {
      for (const p of state.pages) {
        const sel = pageSelections[p.index];
        if (sel && sel.size > 0 && p.page != null) return p.page;
      }
    }
    return activePage?.page ?? null;
  }, [pageOverride, activePage, state, pageSelections]);

  function isHighlighted(pageIdx: number, wordIdx: number): boolean {
    const committed = pageSelections[pageIdx]?.has(wordIdx) ?? false;
    if (!dragState || dragState.pageIdx !== pageIdx) return committed;
    const lo = Math.min(dragState.start, dragState.current);
    const hi = Math.max(dragState.start, dragState.current);
    const inRange = wordIdx >= lo && wordIdx <= hi;
    if (dragState.mode === "add") return committed || inRange;
    return committed && !inRange;
  }

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
            {state.kind !== "done" ? "잠시만요" : "꾹 눌러 드래그"}
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
                  const count = pageSelections[p.index]?.size ?? 0;
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
                      {count > 0 && (
                        <span className="ml-1 opacity-80">· {count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              ref={viewerRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
              style={{
                WebkitUserSelect: "none",
                userSelect: "none",
                WebkitTouchCallout: "none",
                touchAction: "pan-y",
              }}
            >
              {activePage?.error ? (
                <p className="text-center text-sm italic text-[color:var(--danger)]">
                  이 사진은 읽지 못했어요 · {activePage.error}
                </p>
              ) : activePage && tokensByPage[activePage.index]?.length ? (
                <div
                  className="prose-reading whitespace-pre-wrap break-keep leading-8"
                  style={{
                    fontFamily: "var(--font-serif-book), Georgia, serif",
                  }}
                >
                  {tokensByPage[activePage.index].map((tok, i) => {
                    if (tok.kind === "space") {
                      const bothOn =
                        tok.prevWord != null &&
                        tok.nextWord != null &&
                        isHighlighted(activePage.index, tok.prevWord) &&
                        isHighlighted(activePage.index, tok.nextWord);
                      return (
                        <span
                          key={`s${i}`}
                          className={bothOn ? "ocr-space--on" : undefined}
                        >
                          {tok.text}
                        </span>
                      );
                    }
                    const on = isHighlighted(activePage.index, tok.idx);
                    const prevOn =
                      tok.idx > 0 &&
                      isHighlighted(activePage.index, tok.idx - 1);
                    const nextOn = isHighlighted(
                      activePage.index,
                      tok.idx + 1,
                    );
                    const isStart = on && !prevOn;
                    const isEnd = on && !nextOn;
                    const isPressing = pressingWord === tok.idx;
                    return (
                      <span
                        key={`w${tok.idx}`}
                        data-word-idx={tok.idx}
                        className={`ocr-word ocr-word--selectable ${
                          on ? "ocr-word--on" : ""
                        } ${isStart ? "ocr-word--start" : ""} ${
                          isEnd ? "ocr-word--end" : ""
                        } ${isPressing ? "ocr-word--press" : ""}`}
                      >
                        {tok.text}
                      </span>
                    );
                  })}
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
        <footer className="flex shrink-0 flex-col gap-2.5 border-t hairline bg-[color:var(--paper-2)] px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
              담긴 문장
            </span>
            <div className="h-px flex-1 bg-[color:var(--rule)]" />
            {totalSelectedCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearCurrentPageSelection}
                  className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
                >
                  이 페이지 지우기
                </button>
                <button
                  type="button"
                  onClick={clearAllSelections}
                  className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] hover:text-[color:var(--danger)]"
                >
                  전부 지우기
                </button>
              </div>
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
              단어 위를 꾹 누른 뒤 드래그해서 담을 부분을 고르세요.
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
                      color 160ms cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ocr-word--selectable { cursor: pointer; }
        .ocr-word--press {
          background-color: color-mix(in oklab, var(--accent) 14%, transparent);
          animation: word-press 300ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes word-press {
          from { background-color: transparent; }
          to { background-color: color-mix(in oklab, var(--accent) 14%, transparent); }
        }
        .ocr-word--on,
        .ocr-space--on {
          background-color: color-mix(in oklab, var(--accent) 24%, transparent);
          color: var(--ink);
        }
        .ocr-word--start {
          box-shadow: inset 3px 0 0 0 var(--accent);
          border-top-left-radius: 4px;
          border-bottom-left-radius: 4px;
        }
        .ocr-word--end {
          box-shadow: inset -3px 0 0 0 var(--accent);
          border-top-right-radius: 4px;
          border-bottom-right-radius: 4px;
        }
        .ocr-word--start.ocr-word--end {
          box-shadow: inset 3px 0 0 0 var(--accent),
                      inset -3px 0 0 0 var(--accent);
        }
      `}</style>
    </div>
  );
}
