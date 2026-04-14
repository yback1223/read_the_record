import { NextResponse } from "next/server";
import { cache } from "react";
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

export const ensureProfile = cache(async function ensureProfileImpl(
  userId: string,
  email: string,
  nickname?: string | null,
): Promise<Profile> {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) {
    const updates: { role?: "super_admin"; status?: "approved"; approvedAt?: Date; nickname?: string } = {};
    if (
      isSuperAdminEmail(email) &&
      (existing.role !== "super_admin" || existing.status !== "approved")
    ) {
      updates.role = "super_admin";
      updates.status = "approved";
      updates.approvedAt = existing.approvedAt ?? new Date();
    }
    if (nickname && !existing.nickname) {
      updates.nickname = nickname;
    }
    if (Object.keys(updates).length > 0) {
      return prisma.profile.update({ where: { userId }, data: updates });
    }
    return existing;
  }
  const isAdmin = isSuperAdminEmail(email);
  return prisma.profile.create({
    data: {
      userId,
      email,
      nickname: nickname ?? null,
      status: isAdmin ? "approved" : "pending",
      role: isAdmin ? "super_admin" : "user",
      approvedAt: isAdmin ? new Date() : null,
    },
  });
});

export async function requireUser(): Promise<{
  userId: string;
  email: string;
  profile: Profile;
}> {
  const user = await getCurrentUser();
  if (!user || !user.email) {
    throw new AuthError(401, "로그인이 필요합니다.");
  }
  const nickname =
    (user.user_metadata?.nickname as string | undefined) ?? null;
  const profile = await ensureProfile(user.id, user.email, nickname);
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
