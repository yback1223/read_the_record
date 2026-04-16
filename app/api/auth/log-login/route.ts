import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export const POST = withApiHandler(async (req: NextRequest) => {
  const { userId } = await requireUser();
  const body = await req.json().catch(() => ({}));
  const kind = (body?.kind as string | undefined) ?? "login";
  const userAgent =
    req.headers.get("user-agent")?.slice(0, 500) ?? null;
  await prisma.loginEvent.create({
    data: { userId, kind, userAgent },
  });
  logger.info("auth:login-logged", { userId, kind });
  return NextResponse.json({ ok: true });
});
