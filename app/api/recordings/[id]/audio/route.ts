import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApproved } from "@/lib/auth";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
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
    if (!rec || rec.book.userId !== userId || !rec.audioPath) {
      return new Response("not found", { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(RECORDINGS_BUCKET)
      .createSignedUrl(rec.audioPath, 60 * 60);
    if (error || !data) {
      return new Response("not found", { status: 404 });
    }
    return NextResponse.redirect(data.signedUrl, 302);
  } catch {
    return new Response("not found", { status: 404 });
  }
}
