"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[auth-error]", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--paper)] px-6 py-12">
      <div className="fade-up flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
        <h1 className="serif text-2xl text-[color:var(--ink)]">
          문이 잠겨 있어요
        </h1>
        <p className="text-sm leading-relaxed text-[color:var(--ink-muted)]">
          로그인 중에 문제가 생겼어요.<br />
          다시 시도해 주세요.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border hairline px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]"
          >
            다시 시도
          </button>
          <Link
            href="/login"
            className="rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)]"
            style={{ background: "var(--accent)" }}
          >
            로그인으로
          </Link>
        </div>
      </div>
    </main>
  );
}
