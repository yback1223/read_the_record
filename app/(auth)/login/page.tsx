import { Suspense } from "react";
import LoginForm from "./LoginForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
        <h1 className="serif text-3xl tracking-wide text-[color:var(--ink)]">
          Reading
        </h1>
        <p className="text-sm text-[color:var(--ink-muted)]">
          책에 남기는 목소리
        </p>
      </header>

      <Suspense>
        <LoginForm />
      </Suspense>

      <p className="text-center text-xs text-[color:var(--ink-muted)]">
        아직 없으신가요?{" "}
        <Link
          href="/signup"
          className="border-b border-[color:var(--rule-strong)] pb-px text-[color:var(--ink)] hover:border-[color:var(--accent)]"
        >
          회원가입
        </Link>
      </p>
    </div>
  );
}
