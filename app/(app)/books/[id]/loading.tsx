import BookshelfLoader from "@/components/BookshelfLoader";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center px-6 py-10">
      <BookshelfLoader label="책장에서 꺼내는 중…" />
    </div>
  );
}
