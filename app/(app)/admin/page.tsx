import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import AdminTable from "./AdminTable";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");
  const me = await ensureProfile(user.id, user.email);
  if (me.role !== "super_admin") redirect("/");

  const rows = await prisma.profile.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const profiles = rows.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
  }));

  const myUserId = me.userId;

  return (
    <div className="fade-up mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
          관리자
        </p>
        <h1 className="serif text-[28px] leading-tight md:text-[34px]">
          가입 신청
        </h1>
        <div className="h-px w-full bg-[color:var(--rule)]" />
      </header>

      <AdminTable initial={profiles} myUserId={myUserId} />
    </div>
  );
}
