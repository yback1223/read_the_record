import SignupForm from "./SignupForm";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="Read The Record" className="h-20 w-20" />
        <p className="text-sm text-[color:var(--ink-muted)]">
          서재를 엽니다 · 이메일로 시작해요
        </p>
      </header>

      <SignupForm />

      <p className="text-center text-xs text-[color:var(--ink-muted)]">
        이미 있으신가요?{" "}
        <Link
          href="/login"
          className="border-b border-[color:var(--rule-strong)] pb-px text-[color:var(--ink)] hover:border-[color:var(--accent)]"
        >
          로그인
        </Link>
      </p>
    </div>
  );
}
