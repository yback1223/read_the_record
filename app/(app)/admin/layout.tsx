import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import AdminNav from "./AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");
  const me = await ensureProfile(user.id, user.email);
  if (me.role !== "super_admin") redirect("/");

  return (
    <div className="fade-up mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
          관리자
        </p>
        <h1 className="serif text-[28px] leading-tight md:text-[34px]">
          대시보드
        </h1>
        <div className="h-px w-full bg-[color:var(--rule)]" />
      </header>

      <AdminNav />

      <div>{children}</div>
    </div>
  );
}
