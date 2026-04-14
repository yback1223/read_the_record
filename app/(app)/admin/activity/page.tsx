import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import Link from "next/link";

type Event =
  | {
      kind: "login" | "signup";
      at: Date;
      userId: string;
      label: string;
      sub: string;
    }
  | {
      kind: "recording";
      at: Date;
      userId: string;
      label: string;
      sub: string;
    };

export default async function AdminActivityPage() {
  const me = await getCurrentUser();
  if (!me || !me.email) redirect("/login");
  const meProfile = await ensureProfile(me.id, me.email);
  if (meProfile.role !== "super_admin") redirect("/");

  const [logins, recordings] = await Promise.all([
    prisma.loginEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        profile: { select: { email: true, nickname: true } },
      },
    }),
    prisma.recording.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        createdAt: true,
        page: true,
        book: {
          select: {
            title: true,
            userId: true,
          },
        },
      },
    }),
  ]);

  // Fetch profile info for recordings' owners
  const userIds = Array.from(new Set(recordings.map((r) => r.book.userId)));
  const owners = await prisma.profile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, email: true, nickname: true },
  });
  const ownerMap = new Map(owners.map((o) => [o.userId, o]));

  const events: Event[] = [
    ...logins.map((l) => ({
      kind: (l.kind === "signup" ? "signup" : "login") as "signup" | "login",
      at: l.createdAt,
      userId: l.userId,
      label: l.profile.nickname || l.profile.email,
      sub: l.profile.email,
    })),
    ...recordings.map((r) => {
      const owner = ownerMap.get(r.book.userId);
      return {
        kind: "recording" as const,
        at: r.createdAt,
        userId: r.book.userId,
        label: owner?.nickname || owner?.email || "알 수 없음",
        sub: `${r.book.title}${r.page != null ? ` · p. ${r.page}` : ""}`,
      };
    }),
  ];
  events.sort((a, b) => b.at.getTime() - a.at.getTime());

  // group by day
  const groups = new Map<string, Event[]>();
  for (const e of events) {
    const key = e.at.toISOString().slice(0, 10);
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }

  const days = Array.from(groups.entries()).map(([day, items]) => ({
    day,
    items,
  }));

  return (
    <div className="flex flex-col gap-8">
      <p className="text-[12px] text-[color:var(--ink-muted)]">
        최근 로그인, 가입, 녹음을 시간순으로 볼 수 있어요.
      </p>

      {days.length === 0 ? (
        <p className="py-10 text-center italic text-[color:var(--ink-soft)]">
          아직 활동이 없어요.
        </p>
      ) : (
        days.map(({ day, items }) => (
          <section key={day} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="serif text-[16px]">
                {new Date(day).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })}
              </h2>
              <div className="h-px flex-1 bg-[color:var(--rule)]" />
              <span className="text-[11px] text-[color:var(--ink-soft)]">
                {items.length}건
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {items.map((e, idx) => (
                <li key={idx}>
                  <Link
                    href={`/admin/users/${e.userId}`}
                    className="flex items-center gap-3 rounded-lg border hairline bg-[color:var(--paper-2)] px-4 py-2.5 hover:border-[color:var(--rule-strong)]"
                  >
                    <EventDot kind={e.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]">
                        <span className="serif">{e.label}</span>
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                          {e.kind === "signup"
                            ? "가입"
                            : e.kind === "login"
                              ? "로그인"
                              : "녹음"}
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-[color:var(--ink-soft)]">
                        {e.sub}
                      </p>
                    </div>
                    <time className="shrink-0 text-[11px] text-[color:var(--ink-soft)]">
                      {e.at.toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function EventDot({ kind }: { kind: "login" | "signup" | "recording" }) {
  const color =
    kind === "signup"
      ? "var(--accent)"
      : kind === "recording"
        ? "var(--accent-soft)"
        : "var(--ink-muted)";
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}
