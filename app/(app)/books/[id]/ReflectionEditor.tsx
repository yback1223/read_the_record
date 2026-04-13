"use client";

import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (text === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState("idle");
    timerRef.current = setTimeout(async () => {
      setState("saving");
      setErrorMsg("");
      try {
        const res = await fetch(`/api/books/${bookId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reflection: text }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "저장 실패");
        }
        lastSavedRef.current = text;
        setState("saved");
        setTimeout(() => {
          setState((s) => (s === "saved" ? "idle" : s));
        }, 1600);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "저장 실패");
        setState("error");
      }
    }, 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, bookId]);

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

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <section className="paper-card flex flex-col gap-3 px-6 py-6">
      <div className="flex items-center gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
          독후감
        </h2>
        <div className="h-px flex-1 bg-[color:var(--rule)]" />
        <SaveBadge state={state} error={errorMsg} />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.max(8, text.split("\n").length + 2)}
        placeholder="이 책을 읽으며 떠오른 생각을 자유롭게 적어보세요. 자동으로 저장됩니다."
        className="prose-reading w-full resize-y rounded-md bg-transparent p-2 outline-none placeholder:italic placeholder:text-[color:var(--ink-soft)]"
        style={{
          minHeight: "12rem",
          lineHeight: 1.85,
        }}
      />

      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
        <span>
          {wordCount}단어 · {charCount}자
        </span>
        <span className="italic normal-case tracking-normal">
          쓰는 동안 자동으로 보관돼요
        </span>
      </div>
    </section>
  );
}

function SaveBadge({ state, error }: { state: SaveState; error: string }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
        <Dot pulse /> 저장 중…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[color:var(--accent)]">
        <Dot color="var(--accent)" /> 저장됨
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
  return null;
}

function Dot({ pulse, color }: { pulse?: boolean; color?: string }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`}
      style={{ background: color ?? "var(--ink-soft)" }}
    />
  );
}
