import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireApproved } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId } = await requireApproved();
    const books = await prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { recordings: true } } },
    });
    return NextResponse.json(books);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireApproved();
    const body = await req.json();
    const title = (body?.title ?? "").toString().trim();
    const author = (body?.author ?? "").toString().trim() || null;
    const isbn = (body?.isbn ?? "").toString().trim() || null;
    const coverUrl = (body?.coverUrl ?? "").toString().trim() || null;
    const publisher = (body?.publisher ?? "").toString().trim() || null;
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    const book = await prisma.book.create({
      data: { title, author, isbn, coverUrl, publisher, userId },
    });
    return NextResponse.json(book, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
