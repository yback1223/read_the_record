import { Suspense } from "react";
import LoginForm from "./LoginForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="Read The Record" className="h-24 w-24" />
        <p className="text-sm leading-relaxed text-[color:var(--ink-muted)]">
          오늘 마음에 닿은 문장을,<br />
          잊기 전에 목소리로 새겨두세요.
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
