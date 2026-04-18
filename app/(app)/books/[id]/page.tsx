import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import BookView from "./BookView";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const book = await prisma.book.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
      publisher: true,
      reflection: true,
      recordings: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          audioPath: true,
          mimeType: true,
          transcript: true,
          memo: true,
          type: true,
          page: true,
          createdAt: true,
        },
      },
    },
  });

  if (!book) notFound();

  const initial = {
    ...book,
    recordings: book.recordings.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  };

  return <BookView bookId={id} initial={initial} />;
}
