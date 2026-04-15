import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user && user.email) {
    const profile = await ensureProfile(user.id, user.email);
    if (profile.status === "approved" && profile.active) redirect("/");
    if (profile.status === "pending" || !profile.active || profile.status === "rejected") {
      redirect("/pending");
    }
  }

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
