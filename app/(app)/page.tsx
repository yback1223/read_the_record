import Link from "next/link";

export default function Home() {
  return (
    <div className="fade-up mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
      <h1 className="serif text-2xl leading-snug text-[color:var(--ink)]">
        오늘은 어떤 문장을 만났나요?
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-[color:var(--ink-muted)]">
        왼쪽 서재에서 책을 고른 뒤, 인상 깊은 문장을 목소리로 남겨보세요.
        녹음은 글로 옮겨져 책 옆에 조용히 쌓입니다.
      </p>
      <Link
        href="/books/new"
        className="mt-2 rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)]"
        style={{ background: "var(--accent)" }}
      >
        + 새 책 담기
      </Link>
      <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
    </div>
  );
}
