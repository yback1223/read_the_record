"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="fade-up mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
      <h1 className="serif text-2xl text-[color:var(--ink)]">
        잠깐 길을 잃었어요
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-[color:var(--ink-muted)]">
        서재에 작은 문제가 생긴 것 같아요.<br />
        조금 뒤에 다시 와주시겠어요?
      </p>
      {error.digest && (
        <p className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
          참조 코드 · {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)]"
        style={{ background: "var(--accent)" }}
      >
        다시 시도
      </button>
      <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
    </div>
  );
}
