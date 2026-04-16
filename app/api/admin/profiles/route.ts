import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const GET = withApiHandler(async () => {
  await requireSuperAdmin();
  const profiles = await prisma.profile.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(profiles);
});
