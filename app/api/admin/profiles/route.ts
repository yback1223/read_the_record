import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSuperAdmin();
    const profiles = await prisma.profile.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(profiles);
  } catch (err) {
    return authErrorResponse(err);
  }
}
