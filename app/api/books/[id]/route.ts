import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireApproved } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireApproved();
    const { id } = await params;
    const book = await prisma.book.findFirst({
      where: { id, userId },
      include: { recordings: { orderBy: { createdAt: "desc" } } },
    });
    if (!book) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(book);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireApproved();
    const { id } = await params;
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
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireApproved();
    const { id } = await params;
    const book = await prisma.book.findFirst({ where: { id, userId } });
    if (!book) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    await prisma.book.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
