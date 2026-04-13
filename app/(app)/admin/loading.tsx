import BookshelfLoader from "@/components/BookshelfLoader";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-6 py-10">
      <BookshelfLoader label="명단을 모으는 중…" />
    </div>
  );
}
