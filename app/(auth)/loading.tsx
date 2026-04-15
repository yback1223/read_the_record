import BookshelfLoader from "@/components/BookshelfLoader";

export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--paper)] px-6 py-12">
      <BookshelfLoader label="문을 여는 중…" />
    </main>
  );
}
