import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--paper)] px-6 py-12">
      <div className="fade-up flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
        <h1 className="serif text-5xl text-[color:var(--ink)]">404</h1>
        <p className="text-sm leading-relaxed text-[color:var(--ink-muted)]">
          이 서가에는 아무것도 놓여 있지 않아요.<br />
          혹시 주소가 맞는지 한 번 확인해 보세요.
        </p>
        <Link
          href="/"
          className="rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)]"
          style={{ background: "var(--accent)" }}
        >
          서재로 돌아가기
        </Link>
        <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
      </div>
    </main>
  );
}
