import { Suspense } from "react";
import Link from "next/link";
import BookshelfLoader from "@/components/BookshelfLoader";
import LibraryContent from "./LibraryContent";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; size?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const size = sp.size;
  const page = sp.page;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 md:py-14">
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

      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <BookshelfLoader label="서가를 정리하는 중…" size="sm" />
          </div>
        }
      >
        <LibraryContent q={q} size={size} page={page} />
      </Suspense>
    </div>
  );
}
