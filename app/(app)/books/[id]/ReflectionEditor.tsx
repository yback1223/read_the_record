"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ReflectionEditor({
  bookId,
  initial,
}: {
  bookId: string;
  initial: string;
}) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const lastSavedRef = useRef(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const doSave = useCallback(
    async (value: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setState("saving");
      setErrorMsg("");
      try {
        const res = await fetch(`/api/books/${bookId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reflection: value }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "저장 실패");
        }
        lastSavedRef.current = value;
        setState("saved");
        setTimeout(() => {
          setState((s) => (s === "saved" ? "idle" : s));
        }, 1800);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "저장 실패");
        setState("error");
      } finally {
        inFlightRef.current = false;
      }
    },
    [bookId],
  );

  useEffect(() => {
    if (text === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState("idle");
    timerRef.current = setTimeout(() => {
      doSave(text);
    }, 1200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, doSave]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (text !== lastSavedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [text]);

  function manualSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    doSave(text);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      manualSave();
    }
  }

  const dirty = text !== lastSavedRef.current;
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <section className="paper-card flex flex-col gap-3 px-6 py-6">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
          독후감
        </h2>
        <div className="h-px flex-1 bg-[color:var(--rule)]" />
        <SaveBadge state={state} error={errorMsg} dirty={dirty} />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={Math.max(8, text.split("\n").length + 2)}
        placeholder="이 책을 읽으며 떠오른 생각을 자유롭게 적어보세요."
        className="prose-reading w-full resize-y rounded-md bg-transparent p-2 outline-none placeholder:italic placeholder:text-[color:var(--ink-soft)]"
        style={{
          minHeight: "12rem",
          lineHeight: 1.85,
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
        <span>
          {wordCount}단어 · {charCount}자
        </span>
        <div className="flex items-center gap-3">
          <span className="italic normal-case tracking-normal">
            쓰는 동안 자동으로도 보관돼요 · ⌘S
          </span>
          <button
            type="button"
            onClick={manualSave}
            disabled={!dirty || state === "saving"}
            className="rounded-full px-4 py-1.5 text-[11px] uppercase tracking-wider text-[color:var(--paper)] disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {state === "saving"
              ? "저장 중…"
              : dirty
                ? "저장"
                : "저장됨"}
          </button>
        </div>
      </div>
    </section>
  );
}

function SaveBadge({
  state,
  error,
  dirty,
}: {
  state: SaveState;
  error: string;
  dirty: boolean;
}) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
        <Dot pulse /> 저장 중…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--danger)]">
        {error || "저장 실패"}
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[color:var(--ink-muted)]">
        <Dot color="var(--ink-muted)" /> 변경됨
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[color:var(--accent)]">
      <Dot color="var(--accent)" /> 저장됨
    </span>
  );
}

function Dot({ pulse, color }: { pulse?: boolean; color?: string }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`}
      style={{ background: color ?? "var(--ink-soft)" }}
    />
  );
}
