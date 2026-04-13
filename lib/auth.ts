import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";
import type { Profile } from "@prisma/client";

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function isSuperAdminEmail(email: string): boolean {
  const list = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function ensureProfile(
  userId: string,
  email: string,
): Promise<Profile> {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) {
    if (
      isSuperAdminEmail(email) &&
      (existing.role !== "super_admin" || existing.status !== "approved")
    ) {
      return prisma.profile.update({
        where: { userId },
        data: {
          role: "super_admin",
          status: "approved",
          approvedAt: existing.approvedAt ?? new Date(),
        },
      });
    }
    return existing;
  }
  const isAdmin = isSuperAdminEmail(email);
  return prisma.profile.create({
    data: {
      userId,
      email,
      status: isAdmin ? "approved" : "pending",
      role: isAdmin ? "super_admin" : "user",
      approvedAt: isAdmin ? new Date() : null,
    },
  });
}

export async function requireUser(): Promise<{
  userId: string;
  email: string;
  profile: Profile;
}> {
  const user = await getCurrentUser();
  if (!user || !user.email) {
    throw new AuthError(401, "로그인이 필요합니다.");
  }
  const profile = await ensureProfile(user.id, user.email);
  return { userId: user.id, email: user.email, profile };
}

export async function requireApproved(): Promise<{
  userId: string;
  email: string;
  profile: Profile;
}> {
  const ctx = await requireUser();
  if (ctx.profile.status !== "approved") {
    throw new AuthError(403, "관리자 승인 대기 중입니다.");
  }
  if (!ctx.profile.active) {
    throw new AuthError(403, "비활성화된 계정입니다.");
  }
  return ctx;
}

export async function requireSuperAdmin(): Promise<{
  userId: string;
  email: string;
  profile: Profile;
}> {
  const ctx = await requireApproved();
  if (ctx.profile.role !== "super_admin") {
    throw new AuthError(403, "권한이 없습니다.");
  }
  return ctx;
}

export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}
