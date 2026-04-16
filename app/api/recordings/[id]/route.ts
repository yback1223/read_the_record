import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApproved } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  const { userId } = await requireApproved();
  const { id } = await ctx.params;
  const body = await req.json();

  const data: { transcript?: string; page?: number | null } = {};
  if (typeof body?.transcript === "string") data.transcript = body.transcript;
  if ("page" in body) {
    if (body.page == null || body.page === "") {
      data.page = null;
    } else {
      const n = Number(body.page);
      if (!Number.isInteger(n) || n < 0 || n > 99999) {
        return NextResponse.json(
          { error: "invalid page" },
          { status: 400 },
        );
      }
      data.page = n;
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "nothing to update" },
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
    data,
  });
  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (_req, ctx) => {
  const { userId } = await requireApproved();
  const { id } = await ctx.params;
  const rec = await prisma.recording.findUnique({
    where: { id },
    include: { book: true },
  });
  if (!rec || rec.book.userId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.recording.delete({ where: { id } });
  if (rec.audioPath) {
    try {
      await getSupabaseAdmin()
        .storage.from(RECORDINGS_BUCKET)
        .remove([rec.audioPath]);
    } catch {
      // ignore storage cleanup failure
    }
  }
  logger.info("recording:deleted", { recordingId: id, bookId: rec.bookId, userId });
  return NextResponse.json({ ok: true });
});
