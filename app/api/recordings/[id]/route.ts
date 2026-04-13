import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireApproved } from "@/lib/auth";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireApproved();
    const { id } = await params;
    const body = await req.json();
    if (typeof body?.transcript !== "string") {
      return NextResponse.json(
        { error: "transcript required" },
        { status: 400 },
      );
    }
    const rec = await prisma.recording.findUnique({
      where: { id },
      include: { book: true },
    });
    if (!rec || rec.book.userId !== userId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const updated = await prisma.recording.update({
      where: { id },
      data: { transcript: body.transcript },
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
    const rec = await prisma.recording.findUnique({
      where: { id },
      include: { book: true },
    });
    if (!rec || rec.book.userId !== userId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    await prisma.recording.delete({ where: { id } });
    try {
      await getSupabaseAdmin()
        .storage.from(RECORDINGS_BUCKET)
        .remove([rec.audioPath]);
    } catch {
      // ignore
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
