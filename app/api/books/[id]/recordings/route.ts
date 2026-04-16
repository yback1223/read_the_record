import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { prisma } from "@/lib/prisma";
import { extFromMime } from "@/lib/audio";
import { authErrorResponse, requireApproved } from "@/lib/auth";
import { getSupabaseAdmin, RECORDINGS_BUCKET } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireApproved();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not set." },
        { status: 500 },
      );
    }

    const { id: bookId } = await params;
    const book = await prisma.book.findFirst({
      where: { id: bookId, userId },
    });
    if (!book) {
      return NextResponse.json({ error: "book not found" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const language = (form.get("language") as string | null) ?? "ko";
    const rawType = (form.get("type") as string | null) ?? "underline";
    const recordingType = rawType === "whisper" ? "whisper" : "underline";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const groq = new Groq({ apiKey });
    let transcript = "";
    try {
      const result = await groq.audio.transcriptions.create({
        file,
        model: "whisper-large-v3-turbo",
        language,
        response_format: "verbose_json",
        temperature: 0,
      });
      transcript = (result as { text: string }).text ?? "";
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "transcription failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const mime = file.type || "audio/webm";
    const ext = extFromMime(mime);
    const bytes = new Uint8Array(await file.arrayBuffer());

    const recording = await prisma.recording.create({
      data: {
        bookId,
        audioPath: "pending",
        mimeType: mime,
        transcript,
        type: recordingType,
      },
    });

    const objectPath = `${userId}/${recording.id}.${ext}`;
    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage
      .from(RECORDINGS_BUCKET)
      .upload(objectPath, bytes, { contentType: mime, upsert: true });
    if (uploadError) {
      await prisma.recording.delete({ where: { id: recording.id } });
      return NextResponse.json(
        { error: `storage upload failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const updated = await prisma.recording.update({
      where: { id: recording.id },
      data: { audioPath: objectPath },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
