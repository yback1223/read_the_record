import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { cacheDel } from "@/lib/cache";

export const runtime = "nodejs";

export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  const me = await requireSuperAdmin();
  const { userId } = await ctx.params;
  if (userId === me.userId) {
    return NextResponse.json(
      { error: "본인 계정은 변경할 수 없습니다." },
      { status: 400 },
    );
  }
  const body = await req.json();
  const action = body?.action as string | undefined;

  let data: Parameters<typeof prisma.profile.update>[0]["data"] | null = null;
  if (action === "approve") {
    data = { status: "approved", active: true, approvedAt: new Date() };
  } else if (action === "reject") {
    data = { status: "rejected", approvedAt: null };
  } else if (action === "deactivate") {
    data = { active: false };
  } else if (action === "activate") {
    data = { active: true };
  }
  if (!data) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const profile = await prisma.profile.update({
    where: { userId },
    data,
  });
  await cacheDel(`profile:${userId}`);
  logger.info("admin:profile-updated", { targetUserId: userId, action });
  return NextResponse.json(profile);
});
