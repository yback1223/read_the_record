import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const me = await getCurrentUser();
  if (!me || !me.email) redirect("/login");
  const meProfile = await ensureProfile(me.id, me.email);
  if (meProfile.role !== "super_admin") redirect("/");

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) notFound();

  const [books, totalRecordings, recentLogins, recentRecordings] =
    await Promise.all([
      prisma.book.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          author: true,
          coverUrl: true,
          createdAt: true,
          _count: { select: { recordings: true } },
        },
      }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(r.id)::bigint as count
        FROM "Recording" r JOIN "Book" b ON b.id = r."bookId"
        WHERE b."userId" = ${userId}
      `,
      prisma.loginEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.recording.findMany({
        where: { book: { userId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          transcript: true,
          createdAt: true,
          page: true,
          book: { select: { id: true, title: true } },
        },
      }),
    ]);

  const recCount = Number(totalRecordings[0]?.count ?? 0);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/admin/users"
        className="text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
      >
        ← 사용자 목록
      </Link>

      <section className="paper-card flex flex-col gap-2 px-6 py-6">
        <p className="serif text-[22px] leading-tight">
          {profile.nickname || profile.email}
        </p>
        <p className="text-[12px] text-[color:var(--ink-soft)]">
          {profile.email}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
          <span>
            상태 ·{" "}
            <span className="text-[color:var(--ink)]">
              {profile.status}
              {profile.active ? "" : " / 비활성"}
            </span>
          </span>
          <span>
            권한 ·{" "}
            <span className="text-[color:var(--ink)]">{profile.role}</span>
          </span>
          <span>
            가입 ·{" "}
            <span className="text-[color:var(--ink)]">
              {profile.createdAt.toLocaleDateString("ko-KR")}
            </span>
          </span>
          {profile.approvedAt && (
            <span>
              승인 ·{" "}
              <span className="text-[color:var(--ink)]">
                {profile.approvedAt.toLocaleDateString("ko-KR")}
              </span>
            </span>
          )}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="책" value={books.length} />
        <Stat label="녹음" value={recCount} accent />
        <Stat label="로그인" value={recentLogins.length === 12 ? "12+" : recentLogins.length} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="paper-card flex flex-col gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              최근 로그인 ({recentLogins.length})
            </h2>
            <div className="h-px flex-1 bg-[color:var(--rule)]" />
          </div>
          {recentLogins.length === 0 ? (
            <p className="py-4 text-center text-sm italic text-[color:var(--ink-soft)]">
              기록 없음
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentLogins.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-md border hairline bg-[color:var(--paper)] px-3 py-2"
                >
                  <span className="text-[11px] uppercase tracking-wider text-[color:var(--ink-muted)]">
                    {l.kind}
                  </span>
                  <time className="text-[11px] text-[color:var(--ink-soft)]">
                    {l.createdAt.toLocaleString("ko-KR")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="paper-card flex flex-col gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
              최근 녹음 ({recentRecordings.length})
            </h2>
            <div className="h-px flex-1 bg-[color:var(--rule)]" />
          </div>
          {recentRecordings.length === 0 ? (
            <p className="py-4 text-center text-sm italic text-[color:var(--ink-soft)]">
              기록 없음
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recentRecordings.map((r) => (
                <li
                  key={r.id}
                  className="rounded-md border hairline bg-[color:var(--paper)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="serif truncate text-[12px]">{r.book.title}</p>
                    <time className="shrink-0 text-[10px] text-[color:var(--ink-soft)]">
                      {r.createdAt.toLocaleDateString("ko-KR")}
                    </time>
                  </div>
                  {r.transcript && (
                    <p className="mt-1 line-clamp-2 text-[11px] italic text-[color:var(--ink-muted)]">
                      {r.transcript}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
            담은 책 ({books.length})
          </h2>
          <div className="h-px flex-1 bg-[color:var(--rule)]" />
        </div>
        {books.length === 0 ? (
          <p className="py-4 text-center text-sm italic text-[color:var(--ink-soft)]">
            아직 없음
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {books.map((b) => (
              <li key={b.id}>
                <div className="flex flex-col gap-2">
                  <div className="aspect-[2/3] overflow-hidden rounded-sm border hairline bg-[color:var(--paper-2)]">
                    {b.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.coverUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-2 text-center">
                        <span className="serif text-[11px] text-[color:var(--ink-muted)]">
                          {b.title}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="serif truncate text-[12px]">{b.title}</p>
                  <p className="truncate text-[10px] text-[color:var(--ink-soft)]">
                    {b.author ?? "—"} · 녹음 {b._count.recordings}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="paper-card flex flex-col items-center gap-1 py-5">
      <span
        className="serif text-[26px]"
        style={{ color: accent ? "var(--accent)" : "var(--ink)" }}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
        {label}
      </span>
    </div>
  );
}
