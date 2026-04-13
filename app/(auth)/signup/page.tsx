import SignupForm from "./SignupForm";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
        <h1 className="serif text-3xl tracking-wide text-[color:var(--ink)]">
          서재를 엽니다
        </h1>
        <p className="text-sm text-[color:var(--ink-muted)]">
          이메일과 비밀번호로 시작해요
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
