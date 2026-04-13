import BookshelfLoader from "@/components/BookshelfLoader";

export default function Loading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-10">
      <BookshelfLoader label="서재를 여는 중…" />
    </div>
  );
}
