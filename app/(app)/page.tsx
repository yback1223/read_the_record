import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const books = await prisma.book.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { recordings: true } } },
  });

  return (
    <div className="fade-up mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10 md:py-14">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
            나의 서재
          </p>
          <h1 className="serif mt-2 text-[28px] leading-tight md:text-[34px]">
            오늘의 책꽂이
          </h1>
        </div>
        <Link
          href="/books/new"
          className="rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)]"
          style={{ background: "var(--accent)" }}
        >
          + 새 책 담기
        </Link>
      </header>
      <div className="h-px w-full bg-[color:var(--rule)]" />

      {books.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
          <p className="serif text-[18px] text-[color:var(--ink)]">
            아직 비어 있는 책꽂이예요
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-[color:var(--ink-muted)]">
            첫 책을 담고, 마음에 닿은 문장을 목소리로 새겨보세요.
          </p>
          <Link
            href="/books/new"
            className="mt-2 rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)]"
            style={{ background: "var(--accent)" }}
          >
            첫 책 담기
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((b) => (
            <li key={b.id}>
              <Link
                href={`/books/${b.id}`}
                className="group flex flex-col gap-3"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-sm border hairline bg-[color:var(--paper-2)] shadow-[0_10px_30px_-18px_rgba(70,50,20,0.35)]">
                  {b.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.coverUrl}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-3 text-center">
                      <span className="serif text-[13px] leading-snug text-[color:var(--ink-muted)]">
                        {b.title}
                      </span>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="serif truncate text-[14px] leading-snug text-[color:var(--ink)]">
                    {b.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[color:var(--ink-soft)]">
                    {b.author ?? "저자 미상"} · 녹음 {b._count.recordings}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
