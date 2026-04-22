import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { prisma } from "@/lib/prisma";
import { requireApproved } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const OCR_PROMPT = `당신은 한국어 책 페이지에서 글자를 그대로 받아적는 OCR 도우미입니다.
이미지에 보이는 본문 텍스트를 가능한 한 정확히 추출해 주세요.

규칙:
- 줄바꿈과 문단 구분을 유지하세요.
- 페이지 번호가 보이면 맨 앞에 "[p.숫자]" 형태로 적어주세요.
- 추측하지 말고 명확히 보이는 글자만 적으세요.
- 설명이나 부연 없이 추출된 텍스트만 반환하세요.
- 한국어가 아닌 경우 원문 언어 그대로 적으세요.`;

type PageResult = {
  index: number;
  text: string;
  page: number | null;
  error?: string;
};

function extractPageNumber(text: string): number | null {
  const m = text.match(/^\s*\[p\.?\s*(\d+)\]/i);
  return m ? parseInt(m[1], 10) : null;
}

export const POST = withApiHandler(async (req: NextRequest, ctx) => {
  const { userId } = await requireApproved();
  const { id: bookId } = await ctx.params;

  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: { id: true },
  });
  if (!book) {
    return NextResponse.json({ error: "book not found" }, { status: 404 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not set." },
      { status: 500 },
    );
  }

  const body = await req.json();
  const images = (body?.images as string[] | undefined) ?? [];
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: "images required" }, { status: 400 });
  }
  if (images.length > 10) {
    return NextResponse.json(
      { error: "한 번에 최대 10장까지 올릴 수 있어요." },
      { status: 400 },
    );
  }

  const groq = new Groq({ apiKey });
  const results: PageResult[] = [];

  // Process pages sequentially to respect rate limits and stay within function time
  for (let i = 0; i < images.length; i++) {
    const dataUrl = images[i];
    if (!dataUrl?.startsWith?.("data:image/")) {
      results.push({
        index: i,
        text: "",
        page: null,
        error: "invalid image data",
      });
      continue;
    }

    try {
      const completion = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPT },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      });
      const text = completion.choices?.[0]?.message?.content ?? "";
      const page = extractPageNumber(text);
      // strip the [p.N] prefix from the returned text so the caller sees clean body
      const cleaned = text.replace(/^\s*\[p\.?\s*\d+\]\s*\n?/i, "").trim();
      results.push({ index: i, text: cleaned, page });
    } catch (err) {
      const message = err instanceof Error ? err.message : "ocr failed";
      logger.warn("ocr:page-failed", { bookId, pageIndex: i, message });
      results.push({ index: i, text: "", page: null, error: message });
    }
  }

  logger.info("ocr:done", {
    bookId,
    userId,
    pages: results.length,
    ok: results.filter((r) => !r.error).length,
  });

  return NextResponse.json({ results });
});
