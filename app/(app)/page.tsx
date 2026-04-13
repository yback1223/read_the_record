import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import LibraryToolbar from "./LibraryToolbar";

type View = "grid" | "list";

const ALLOWED_SIZES = [12, 24, 48, 96];
const DEFAULT_SIZE = 24;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; size?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const view: View = sp.view === "list" ? "list" : "grid";
  const sizeNum = Number(sp.size);
  const size = ALLOWED_SIZES.includes(sizeNum) ? sizeNum : DEFAULT_SIZE;
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    userId: user.id,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { author: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, books] = await Promise.all([
    prisma.book.count({ where }),
    prisma.book.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { recordings: true } } },
      take: size,
      skip: (page - 1) * size,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / size));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (view !== "grid") params.set("view", view);
    if (size !== DEFAULT_SIZE) params.set("size", String(size));
    if (p !== 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  return (
    <div className="fade-up mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
          나의 서재
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="serif text-[28px] leading-tight md:text-[34px]">
            오늘의 책꽂이
          </h1>
          <Link
            href="/books/new"
            className="rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)]"
            style={{ background: "var(--accent)" }}
          >
            + 새 책 담기
          </Link>
        </div>
      </header>

      <LibraryToolbar initialQ={q} initialView={view} initialSize={size} />

      <div className="flex items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
          {q ? `"${q}" 검색 결과` : "전체"}
        </span>
        <div className="h-px flex-1 bg-[color:var(--rule)]" />
        <span className="text-[11px] text-[color:var(--ink-soft)]">
          {total}권
        </span>
      </div>

      {total === 0 ? (
        <EmptyState search={!!q} />
      ) : view === "grid" ? (
        <GridView
          books={books.map((b) => ({
            id: b.id,
            title: b.title,
            author: b.author,
            coverUrl: b.coverUrl,
            count: b._count.recordings,
          }))}
        />
      ) : (
        <ListView
          books={books.map((b) => ({
            id: b.id,
            title: b.title,
            author: b.author,
            publisher: b.publisher,
            coverUrl: b.coverUrl,
            count: b._count.recordings,
            createdAt: b.createdAt.toISOString(),
          }))}
        />
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} hrefFor={pageHref} />
      )}
    </div>
  );
}

function EmptyState({ search }: { search: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="h-px w-10 bg-[color:var(--rule-strong)]" />
      <p className="serif text-[18px] text-[color:var(--ink)]">
        {search ? "찾는 책이 책꽂이에 없어요" : "아직 비어 있는 책꽂이예요"}
      </p>
      <p className="max-w-sm text-sm leading-relaxed text-[color:var(--ink-muted)]">
        {search
          ? "검색어를 바꿔 보거나 새 책을 담아보세요."
          : "첫 책을 담고, 마음에 닿은 문장을 목소리로 새겨보세요."}
      </p>
      <Link
        href="/books/new"
        className="mt-2 rounded-full px-5 py-2 text-[11px] uppercase tracking-wider text-[color:var(--paper)]"
        style={{ background: "var(--accent)" }}
      >
        새 책 담기
      </Link>
    </div>
  );
}

type GridBook = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  count: number;
};

function GridView({ books }: { books: GridBook[] }) {
  // group books into shelves of 5 to draw a wood-line under each row
  const shelfSize = 5;
  const shelves: GridBook[][] = [];
  for (let i = 0; i < books.length; i += shelfSize) {
    shelves.push(books.slice(i, i + shelfSize));
  }
  return (
    <div className="flex flex-col gap-12">
      {shelves.map((row, idx) => (
        <div key={idx} className="flex flex-col">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {row.map((b) => (
              <li key={b.id}>
                <Link href={`/books/${b.id}`} className="group flex flex-col gap-3">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-sm border hairline bg-[color:var(--paper-2)] shadow-[0_14px_30px_-18px_rgba(70,50,20,0.45)]">
                    {b.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.coverUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
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
                      {b.author ?? "저자 미상"} · 녹음 {b.count}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div
            className="mt-4 h-[6px] rounded-b-[3px]"
            style={{
              background:
                "linear-gradient(180deg, var(--rule-strong), var(--rule))",
              boxShadow: "0 6px 14px -10px rgba(70,50,20,0.45)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

type ListBook = GridBook & {
  publisher: string | null;
  createdAt: string;
};

function ListView({ books }: { books: ListBook[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {books.map((b) => (
        <li key={b.id}>
          <Link
            href={`/books/${b.id}`}
            className="flex items-center gap-4 rounded-lg border hairline bg-[color:var(--paper-2)] px-4 py-3 hover:border-[color:var(--rule-strong)]"
          >
            {b.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.coverUrl}
                alt=""
                className="h-16 w-11 shrink-0 rounded-sm object-cover"
              />
            ) : (
              <div className="h-16 w-11 shrink-0 rounded-sm border hairline bg-[color:var(--paper)]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="serif truncate text-[15px] text-[color:var(--ink)]">
                {b.title}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[color:var(--ink-soft)]">
                {b.author ?? "저자 미상"}
                {b.publisher && ` · ${b.publisher}`}
              </p>
            </div>
            <div className="hidden flex-col items-end gap-0.5 text-right text-[10px] uppercase tracking-wider text-[color:var(--ink-soft)] sm:flex">
              <span>녹음 {b.count}</span>
              <span>{new Date(b.createdAt).toLocaleDateString("ko-KR")}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (p: number) => string;
}) {
  const pages = pageRange(page, totalPages);
  return (
    <nav className="flex items-center justify-center gap-1 pt-2">
      <PageLink disabled={page <= 1} href={hrefFor(page - 1)}>
        이전
      </PageLink>
      {pages.map((p, i) =>
        p === "…" ? (
          <span
            key={`gap-${i}`}
            className="px-2 text-[11px] text-[color:var(--ink-soft)]"
          >
            …
          </span>
        ) : (
          <PageLink key={p} href={hrefFor(p)} active={p === page}>
            {p}
          </PageLink>
        ),
      )}
      <PageLink disabled={page >= totalPages} href={hrefFor(page + 1)}>
        다음
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-full border hairline px-3 py-1 text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)] opacity-40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wider ${
        active
          ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--paper)]"
          : "hairline text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] hover:border-[color:var(--rule-strong)]"
      }`}
    >
      {children}
    </Link>
  );
}

function pageRange(current: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const push = (v: number | "…") => out.push(v);
  const window = 1;
  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - window && i <= current + window)
    ) {
      push(i);
    } else if (out[out.length - 1] !== "…") {
      push("…");
    }
  }
  return out;
}
