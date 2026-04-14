import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireUser();
    const body = await req.json().catch(() => ({}));
    const kind = (body?.kind as string | undefined) ?? "login";
    const userAgent =
      req.headers.get("user-agent")?.slice(0, 500) ?? null;
    await prisma.loginEvent.create({
      data: { userId, kind, userAgent },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
