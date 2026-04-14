import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminOverviewPage() {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);

  const [
    totalUsers,
    pendingUsers,
    activeUsers,
    totalBooks,
    totalRecordings,
    recordingsLast7,
    loginsLast7,
    recentLogins,
    topUsers,
    dailyRecordings,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({ where: { status: "pending" } }),
    prisma.profile.count({
      where: { status: "approved", active: true },
    }),
    prisma.book.count(),
    prisma.recording.count(),
    prisma.recording.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.loginEvent.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.loginEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        profile: {
          select: { email: true, nickname: true },
        },
      },
    }),
    prisma.recording.groupBy({
      by: ["bookId"],
      _count: { _all: true },
      orderBy: { _count: { bookId: "desc" } },
      take: 20,
    }),
    prisma.$queryRaw<
      { day: Date; n: bigint }[]
    >`SELECT date_trunc('day', "createdAt") as day, count(*)::bigint as n
      FROM "Recording"
      WHERE "createdAt" >= ${sevenDaysAgo}
      GROUP BY day
      ORDER BY day ASC`,
  ]);

  // Resolve top users: group recordings by book.userId via a raw join
  const topUsersByRecording = await prisma.$queryRaw<
    { userId: string; email: string; nickname: string | null; count: bigint }[]
  >`SELECT p."userId", p.email, p.nickname, count(r.id)::bigint as count
    FROM "Recording" r
    JOIN "Book" b ON b.id = r."bookId"
    JOIN "Profile" p ON p."userId" = b."userId"
    GROUP BY p."userId", p.email, p.nickname
    ORDER BY count DESC
    LIMIT 5`;

  void topUsers;

  // normalize chart data: 7 buckets
  const chart: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * dayMs);
    const dayKey = d.toISOString().slice(0, 10);
    const found = dailyRecordings.find(
      (r) => r.day.toISOString().slice(0, 10) === dayKey,
    );
    chart.push({
      label: d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
      count: found ? Number(found.n) : 0,
    });
  }
  const maxCount = Math.max(1, ...chart.map((c) => c.count));

  return (
    <div className="flex flex-col gap-10">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="전체 사용자" value={totalUsers} />
        <StatCard label="대기 중" value={pendingUsers} tone="warn" />
        <StatCard label="활성 사용자" value={activeUsers} />
        <StatCard label="이번 주 로그인" value={loginsLast7} />
        <StatCard label="전체 책" value={totalBooks} />
        <StatCard label="전체 녹음" value={totalRecordings} />
        <StatCard label="이번 주 녹음" value={recordingsLast7} accent />
        <StatCard
          label="이번 주 활성도"
          value={
            activeUsers === 0
              ? "0%"
              : `${Math.round((recordingsLast7 / Math.max(1, activeUsers)) * 10) / 10}건/인`
          }
        />
      </section>

      <section className="paper-card flex flex-col gap-5 px-6 py-6">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
            최근 7일 · 녹음 사용 추이
          </h2>
          <div className="h-px flex-1 bg-[color:var(--rule)]" />
          <span className="text-[11px] text-[color:var(--ink-soft)]">
            총 {recordingsLast7}건
          </span>
        </div>
        <div className="flex h-40 items-end gap-3">
          {chart.map((c) => (
            <div
              key={c.label}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div className="relative flex h-full w-full items-end">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${(c.count / maxCount) * 100}%`,
                    background:
                      "linear-gradient(180deg, var(--accent-soft), var(--accent))",
                    transitionProperty: "height",
                    transitionDuration: "500ms",
                    minHeight: c.count > 0 ? "4px" : "0",
                  }}
                />
              </div>
              <span className="text-[10px] text-[color:var(--ink-soft)]">
                {c.label}
              </span>
              <span className="text-[11px] font-medium text-[color:var(--ink)]">
                {c.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="paper-card flex flex-col gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              최근 로그인
            </h2>
            <div className="h-px flex-1 bg-[color:var(--rule)]" />
            <Link
              href="/admin/activity"
              className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
            >
              전체 →
            </Link>
          </div>
          {recentLogins.length === 0 ? (
            <p className="py-4 text-center text-sm italic text-[color:var(--ink-soft)]">
              아직 기록이 없어요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentLogins.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-4 rounded-md border hairline bg-[color:var(--paper)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="serif truncate text-[13px]">
                      {l.profile.nickname || l.profile.email}
                    </p>
                    <p className="truncate text-[10px] text-[color:var(--ink-soft)]">
                      {l.profile.email}
                    </p>
                  </div>
                  <time className="shrink-0 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                    {formatRelative(l.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="paper-card flex flex-col gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              녹음 많은 사용자 Top 5
            </h2>
            <div className="h-px flex-1 bg-[color:var(--rule)]" />
          </div>
          {topUsersByRecording.length === 0 ? (
            <p className="py-4 text-center text-sm italic text-[color:var(--ink-soft)]">
              아직 없어요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {topUsersByRecording.map((u, idx) => (
                <li key={u.userId}>
                  <Link
                    href={`/admin/users/${u.userId}`}
                    className="flex items-center justify-between gap-4 rounded-md border hairline bg-[color:var(--paper)] px-3 py-2 hover:border-[color:var(--rule-strong)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="serif text-[14px] text-[color:var(--ink-soft)]">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="serif truncate text-[13px]">
                          {u.nickname || u.email}
                        </p>
                        <p className="truncate text-[10px] text-[color:var(--ink-soft)]">
                          {u.email}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-[color:var(--accent)]">
                      {Number(u.count)} 건
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  accent,
}: {
  label: string;
  value: number | string;
  tone?: "warn";
  accent?: boolean;
}) {
  return (
    <div className="paper-card flex flex-col items-center gap-1 px-3 py-5">
      <span
        className="serif text-[28px]"
        style={{
          color: accent
            ? "var(--accent)"
            : tone === "warn"
              ? "var(--danger)"
              : "var(--ink)",
        }}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
        {label}
      </span>
    </div>
  );
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "방금";
  if (diff < hour) return `${Math.floor(diff / min)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}
