import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApproved } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export const GET = withApiHandler(async (_req, ctx) => {
  const { userId } = await requireApproved();
  const { id } = await ctx.params;
  const book = await prisma.book.findFirst({
    where: { id, userId },
    include: { recordings: { orderBy: { createdAt: "desc" } } },
  });
  if (!book) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(book);
});

export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  const { userId } = await requireApproved();
  const { id } = await ctx.params;
  const body = await req.json();
  if (typeof body?.reflection !== "string") {
    return NextResponse.json(
      { error: "reflection required" },
      { status: 400 },
    );
  }
  const book = await prisma.book.findFirst({ where: { id, userId } });
  if (!book) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const updated = await prisma.book.update({
    where: { id },
    data: { reflection: body.reflection },
  });
  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (_req, ctx) => {
  const { userId } = await requireApproved();
  const { id } = await ctx.params;
  const book = await prisma.book.findFirst({ where: { id, userId } });
  if (!book) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.book.delete({ where: { id } });
  logger.info("book:deleted", { bookId: id, userId });
  return NextResponse.json({ ok: true });
});
