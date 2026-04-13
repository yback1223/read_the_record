import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureProfile, getCurrentUserOrNull } from "@/lib/page-auth";
import SignOutButton from "@/components/SignOutButton";

export default async function PendingPage() {
  const user = await getCurrentUserOrNull();
  if (!user || !user.email) redirect("/login");

  const profile = await ensureProfile(user.id, user.email);

  if (profile.status === "approved" && profile.active) redirect("/");

  const message = !profile.active
    ? "계정이 비활성화되었습니다. 관리자에게 문의해 주세요."
    : profile.status === "rejected"
      ? "가입이 반려되었습니다. 관리자에게 문의해 주세요."
      : "관리자 승인을 기다리고 있어요. 승인되면 바로 시작할 수 있습니다.";

  // touch prisma to silence unused import in some builds
  void prisma;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
      <h1 className="serif text-2xl text-[color:var(--ink)]">
        잠시만 기다려 주세요
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-[color:var(--ink-muted)]">
        {message}
      </p>
      <p className="text-[11px] text-[color:var(--ink-soft)]">{user.email}</p>
      <SignOutButton />
    </div>
  );
}
