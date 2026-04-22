"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BookshelfLoader from "@/components/BookshelfLoader";
import { resizeImageToDataURL } from "@/lib/image-resize";
import { notify, msg } from "@/lib/toast";

type PageResult = {
  index: number;
  text: string;
  page: number | null;
  error?: string;
};

type Token =
  | { kind: "word"; text: string; idx: number }
  | { kind: "space"; text: string };

function tokenize(text: string): Token[] {
  if (!text) return [];
  const parts = text.split(/(\s+|(?<=[.!?])\s*)/g).filter(Boolean);
  const out: Token[] = [];
  let nextIdx = 0;
  for (const p of parts) {
    if (/^\s*$/.test(p)) {
      out.push({ kind: "space", text: p });
    } else {
      out.push({ kind: "word", text: p, idx: nextIdx++ });
    }
  }
  return out;
}

/** Rebuild a selection text from a page's tokens + selected word indices, preserving original spacing. */
function buildSelectedText(
  tokens: Token[],
  selected: Set<number>,
): string {
  // Walk tokens; whenever a word is selected, emit it. Also emit preceding space
  // if the last emitted word and this one are contiguous in the original (i.e. only
  // whitespace tokens between them). Otherwise, join separated runs with a single newline.
  let result = "";
  let lastWasSelected = false;
  let pendingSpace = "";
  for (const t of tokens) {
    if (t.kind === "space") {
      if (lastWasSelected) pendingSpace += t.text;
    } else {
      if (selected.has(t.idx)) {
        if (!lastWasSelected && result.length > 0) {
          result += " "; // gap between non-contiguous runs
        } else {
          // contiguous: flush pending whitespace as a single space to normalize
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

export default function OcrSheet({
  open,
  bookId,
  files,
  onClose,
  onPicked,
}: {
  open: boolean;
  bookId: string;
  files: File[];
  onClose: () => void;
  onPicked: (args: { text: string; page: number | null }) => Promise<void>;
}) {
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
  const viewerRef = useRef<HTMLDivElement | null>(null);

  // Tokenize pages once per result set
  const tokensByPage = useMemo(() => {
    if (state.kind !== "done") return {} as Record<number, Token[]>;
    const map: Record<number, Token[]> = {};
    state.pages.forEach((p) => {
      map[p.index] = tokenize(p.text);
    });
    return map;
  }, [state]);

  // Run OCR when sheet opens with files
  useEffect(() => {
    if (!open || files.length === 0) return;
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
        setActiveIdx(0);
        setPageSelections({});
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
  }, [open, files, bookId]);

  useEffect(() => {
    if (!open) {
      setPageSelections({});
      setPageOverride("");
      setDragState(null);
      setState({ kind: "idle" });
    }
  }, [open]);

  // Find word index under a pointer using DOM dataset
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

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (state.kind !== "done") return;
    const pageIdx = activePage?.index;
    if (pageIdx == null) return;
    const idx = wordIdxFromPoint(e.clientX, e.clientY);
    if (idx == null) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.preventDefault();
    startDrag(pageIdx, idx);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    const idx = wordIdxFromPoint(e.clientX, e.clientY);
    if (idx == null) return;
    if (idx !== dragState.current) {
      setDragState({ ...dragState, current: idx });
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
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
    // Default: first page with a selection that has a detected page number
    if (state.kind === "done") {
      for (const p of state.pages) {
        const sel = pageSelections[p.index];
        if (sel && sel.size > 0 && p.page != null) return p.page;
      }
    }
    return activePage?.page ?? null;
  }, [pageOverride, activePage, state, pageSelections]);

  async function handleSave() {
    if (!combinedText) return;
    setSaving(true);
    try {
      await onPicked({ text: combinedText, page: effectivePage });
      notify.success(msg.saved);
      onClose();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : msg.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  // Helper: is a word highlighted (committed or in active drag range)?
  function isHighlighted(pageIdx: number, wordIdx: number): boolean {
    const committed = pageSelections[pageIdx]?.has(wordIdx) ?? false;
    if (!dragState || dragState.pageIdx !== pageIdx) return committed;
    const lo = Math.min(dragState.start, dragState.current);
    const hi = Math.max(dragState.start, dragState.current);
    const inRange = wordIdx >= lo && wordIdx <= hi;
    if (dragState.mode === "add") {
      return committed || inRange;
    }
    return committed && !inRange;
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center md:items-center"
      style={{
        background:
          "radial-gradient(120% 80% at 30% 30%, rgba(20,12,4,0.45), rgba(20,12,4,0.2))",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="fade-up paper-card relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl md:rounded-3xl"
        style={{
          animation: "ocr-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <header className="flex items-center justify-between border-b hairline px-5 py-4">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              사진에서 문장 담기
            </span>
            <span className="serif text-[15px] text-[color:var(--ink)]">
              {state.kind === "done"
                ? "단어 위를 드래그해서 담을 문장을 고르세요"
                : "잠시만요"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full border hairline text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {(state.kind === "idle" || state.kind === "processing") && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-10">
              <BookshelfLoader
                label={state.kind === "processing" ? state.step : "준비 중…"}
              />
            </div>
          )}

          {state.kind === "error" && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <p className="serif text-[16px]">글자를 읽지 못했어요</p>
              <p className="text-[12px] text-[color:var(--ink-muted)]">
                {state.message}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded-full border hairline px-4 py-1.5 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
              >
                닫기
              </button>
            </div>
          )}

          {state.kind === "done" && state.pages.length > 0 && (
            <div className="flex flex-col">
              {state.pages.length > 1 && (
                <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b hairline bg-[color:var(--paper-2)] px-5 py-3">
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
                onPointerCancel={onPointerUp}
                className="select-none px-5 py-6 touch-none"
                style={{ WebkitUserSelect: "none", userSelect: "none" }}
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
                    {tokensByPage[activePage.index].map((tok, i) =>
                      tok.kind === "space" ? (
                        <span key={`s${i}`}>{tok.text}</span>
                      ) : (
                        <span
                          key={`w${tok.idx}`}
                          data-word-idx={tok.idx}
                          className={`ocr-word rounded-[4px] ${
                            isHighlighted(activePage.index, tok.idx)
                              ? "ocr-word--on"
                              : ""
                          }`}
                        >
                          {tok.text}
                        </span>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-center text-sm italic text-[color:var(--ink-soft)]">
                    이 사진에서는 글자를 찾지 못했어요
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {state.kind === "done" && (
          <footer className="flex flex-col gap-3 border-t hairline bg-[color:var(--paper-2)] px-5 py-4">
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
                className="prose-reading max-h-32 overflow-y-auto rounded-lg border-l-2 bg-[color:var(--paper)] px-4 py-2 text-[13px]"
                style={{ borderColor: "var(--accent)" }}
              >
                {combinedText}
              </blockquote>
            ) : (
              <p className="px-1 text-[12px] italic text-[color:var(--ink-soft)]">
                글자 위를 드래그해서 담을 부분을 고르세요. 여러 페이지를
                오가며 이어 고를 수 있어요.
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
          @keyframes ocr-in {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .ocr-word {
            display: inline;
            padding: 1px 1px;
            background-color: transparent;
            transition: background-color 140ms cubic-bezier(0.22, 1, 0.36, 1),
                        color 140ms cubic-bezier(0.22, 1, 0.36, 1);
            cursor: pointer;
          }
          .ocr-word--on {
            background-color: color-mix(in oklab, var(--accent) 28%, transparent);
            box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent) 28%, transparent);
            color: var(--ink);
          }
        `}</style>
      </div>
    </div>
  );
}
