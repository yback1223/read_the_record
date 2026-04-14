import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");
  const me = await ensureProfile(user.id, user.email);
  if (me.role !== "super_admin") redirect("/");

  const profiles = await prisma.profile.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  // counts per user
  const [bookCounts, recordingCounts, lastLogins] = await Promise.all([
    prisma.book.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ userId: string; count: bigint }[]>`
      SELECT b."userId" as "userId", count(r.id)::bigint as count
      FROM "Recording" r JOIN "Book" b ON b.id = r."bookId"
      GROUP BY b."userId"
    `,
    prisma.$queryRaw<{ userId: string; lastAt: Date }[]>`
      SELECT "userId", max("createdAt") as "lastAt"
      FROM "LoginEvent"
      GROUP BY "userId"
    `,
  ]);

  const bookMap = new Map(bookCounts.map((b) => [b.userId, b._count._all]));
  const recMap = new Map(
    recordingCounts.map((r) => [r.userId, Number(r.count)]),
  );
  const lastMap = new Map(lastLogins.map((l) => [l.userId, l.lastAt]));

  const rows = profiles.map((p) => ({
    userId: p.userId,
    email: p.email,
    nickname: p.nickname,
    status: p.status,
    role: p.role,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
    bookCount: bookMap.get(p.userId) ?? 0,
    recordingCount: recMap.get(p.userId) ?? 0,
    lastLoginAt: lastMap.get(p.userId)?.toISOString() ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[12px] text-[color:var(--ink-muted)]">
        가입 승인, 활성화, 사용량을 한 곳에서 관리해요. 사용자 이름을 누르면
        상세 페이지로 이동합니다.
      </p>
      <UsersClient initial={rows} myUserId={me.userId} />
      <div className="text-center">
        <Link
          href="/admin"
          className="text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
        >
          ← 개요로
        </Link>
      </div>
    </div>
  );
}
