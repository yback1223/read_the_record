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
  const [selection, setSelection] = useState("");
  const [pageOverride, setPageOverride] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);

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

  // Track text selection in the viewer
  useEffect(() => {
    if (!open) return;
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        return;
      }
      const text = sel.toString().trim();
      if (!text) return;
      // Only track selections inside the viewer
      const range = sel.getRangeAt(0);
      if (
        viewerRef.current &&
        viewerRef.current.contains(range.commonAncestorContainer)
      ) {
        setSelection(text);
      }
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [open]);

  // Reset when closing
  useEffect(() => {
    if (!open) {
      setSelection("");
      setPageOverride("");
      setState({ kind: "idle" });
    }
  }, [open]);

  const activePage = useMemo(() => {
    if (state.kind !== "done") return null;
    return state.pages[activeIdx];
  }, [state, activeIdx]);

  const effectivePage = useMemo(() => {
    const override = pageOverride.trim();
    if (override) {
      const n = Number(override);
      return Number.isInteger(n) && n >= 0 ? n : null;
    }
    return activePage?.page ?? null;
  }, [pageOverride, activePage]);

  async function handleSave() {
    if (!selection.trim()) return;
    setSaving(true);
    try {
      await onPicked({
        text: selection.trim(),
        page: effectivePage,
      });
      notify.success(msg.saved);
      onClose();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : msg.saveFailed);
    } finally {
      setSaving(false);
    }
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
        className="fade-up paper-card relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl md:rounded-3xl"
        style={{
          animation:
            "ocr-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <header className="flex items-center justify-between border-b hairline px-5 py-4">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              사진에서 문장 담기
            </span>
            <span className="serif text-[15px] text-[color:var(--ink)]">
              드래그해서 담고 싶은 부분을 고르세요
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

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {(state.kind === "idle" || state.kind === "processing") && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-10">
              <BookshelfLoader
                label={
                  state.kind === "processing" ? state.step : "준비 중…"
                }
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
                  {state.pages.map((p, i) => (
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
                      {p.page != null ? `p. ${p.page}` : `사진 ${i + 1}`}
                    </button>
                  ))}
                </div>
              )}

              <div ref={viewerRef} className="px-5 py-6">
                {activePage?.error ? (
                  <p className="text-center text-sm italic text-[color:var(--danger)]">
                    이 사진은 읽지 못했어요 · {activePage.error}
                  </p>
                ) : activePage?.text ? (
                  <pre
                    className="prose-reading selection:bg-[color:var(--accent)]/25 whitespace-pre-wrap break-keep"
                    style={{
                      fontFamily:
                        "var(--font-serif-book), Georgia, serif",
                    }}
                  >
                    {activePage.text}
                  </pre>
                ) : (
                  <p className="text-center text-sm italic text-[color:var(--ink-soft)]">
                    이 사진에서는 글자를 찾지 못했어요
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        {state.kind === "done" && (
          <footer className="flex flex-col gap-3 border-t hairline bg-[color:var(--paper-2)] px-5 py-4">
            {selection ? (
              <blockquote
                className="prose-reading rounded-lg border-l-2 bg-[color:var(--paper)] px-4 py-2 text-[13px]"
                style={{ borderColor: "var(--accent)" }}
              >
                {selection.length > 220
                  ? selection.slice(0, 220) + "…"
                  : selection}
              </blockquote>
            ) : (
              <p className="px-1 text-[12px] italic text-[color:var(--ink-soft)]">
                위에서 담고 싶은 문장을 드래그해 주세요.
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
                    activePage?.page != null ? String(activePage.page) : "-"
                  }
                  className="w-16 rounded-md border hairline bg-[color:var(--paper)] px-2 py-1 text-center text-[13px] text-[color:var(--ink)] outline-none"
                />
              </label>
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleSave}
                disabled={!selection.trim() || saving}
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
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
